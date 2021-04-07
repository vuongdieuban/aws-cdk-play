import * as cdk from '@aws-cdk/core';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as appmesh from '@aws-cdk/aws-appmesh';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as servicediscovery from '@aws-cdk/aws-servicediscovery';
import { SecurityGroup, SubnetType } from '@aws-cdk/aws-ec2';
import { EcsFargateAppMeshService } from './constructs/ecs-fargate-appmesh-service.construct';
import { HttpAlbIntegration } from '@aws-cdk/aws-apigatewayv2-integrations';
import { HttpApi, CorsHttpMethod } from '@aws-cdk/aws-apigatewayv2';

// ** IMPORTANT: Make sure all package have same version (1.95 across everything, remove the ^ symbol, 1.95.0 !== 1.95.1)

export class GreetingStack extends cdk.Stack {
  public externalDNS: cdk.CfnOutput;
  public httpApiGwEndpointsDNS: cdk.CfnOutput;

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Default Max Availability zone is 3, default to 1 NAT Gateway per Az
    // NAT gateway is charged even if it is not used - expensive
    const vpc = new ec2.Vpc(this, 'GreetingVpc', {
      cidr: '10.0.0.0/16',
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: SubnetType.PRIVATE,
        },
      ],
    });

    const securityGroup = new SecurityGroup(this, 'ecs-appmesh-sg', {
      securityGroupName: 'appmesh-sg',
      allowAllOutbound: true,
      vpc,
    });

    // allow any ipv4 address (for tighter control, can just allow certain ip addresses)
    // alternatively, can use Peer.anyIpv4() (same as 0.0.0.0/0)
    securityGroup.addIngressRule(ec2.Peer.ipv4('0.0.0.0/0'), ec2.Port.tcp(3000), 'App Port');

    // Create an ECS cluster
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      containerInsights: true,
      defaultCloudMapNamespace: {
        name: 'internal',
        type: servicediscovery.NamespaceType.DNS_PRIVATE,
      },
    });

    // Create an App Mesh
    const mesh = new appmesh.Mesh(this, 'app-mesh', {
      meshName: 'greeting-app-mesh',
    });

    // Add capacity/auto-scaling to it
    // This is the default auto scaling group, to create customize one, use autoscaling.AutoScalingGroup (@aws-cdk/aws-autoscalling)
    // cluster.addAutoScalingGroup
    cluster.addCapacity('greeter-capacity', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      minCapacity: 1,
      maxCapacity: 1,
    });

    const healthCheck = {
      command: ['curl localhost:3000'],
      startPeriod: cdk.Duration.seconds(10),
      interval: cdk.Duration.seconds(300),
      timeout: cdk.Duration.seconds(2),
      retries: 3,
    };

    // We could create an ecr, then when application code changes, build and publish the docker image to ecr with a new tag name/version
    // then in the pipeline, add an env for the new image tag name, this code here will read the tag name from env
    // since the new tag name version is different than the deployed one, this code will run again to deploy new image.
    // We can just git clone this repo in the pipeline when needed

    // ecs.SplunkLogDriver - sends log to splunk (need Splunk auth token)
    // Right now we log to a file system inside the container, but we cannot ssh into that container to get the file
    // Might as well log directly to splunk
    const nameService = new EcsFargateAppMeshService(this, 'name', {
      cluster,
      mesh,
      fargateServices: [
        {
          port: 3000,
          name: 'name',
          securityGroup,
          containerOptions: {
            image: ecs.ContainerImage.fromRegistry('nathanpeck/name'),
            // healthCheck,
            memoryLimitMiB: 128,
            logging: new ecs.AwsLogDriver({
              streamPrefix: 'app-mesh-name',
            }),
            environment: {
              PORT: '3000',
            },
          },
        },
      ],
    });

    const greetingService = new EcsFargateAppMeshService(this, 'greeting', {
      cluster,
      mesh,
      fargateServices: [
        {
          port: 3000,
          name: 'greeting',
          securityGroup,
          containerOptions: {
            image: ecs.ContainerImage.fromRegistry('nathanpeck/greeting'),
            // healthCheck,
            memoryLimitMiB: 128,
            logging: new ecs.AwsLogDriver({
              streamPrefix: 'app-mesh-greeting',
            }),
            environment: {
              PORT: '3000',
            },
          },
        },
        {
          port: 3000,
          name: 'greeting_v2',
          securityGroup,
          containerOptions: {
            image: ecs.ContainerImage.fromRegistry('nathanpeck/name'),
            // healthCheck,
            memoryLimitMiB: 128,
            logging: new ecs.AwsLogDriver({
              streamPrefix: 'app-mesh-name',
            }),
            environment: {
              PORT: '3000',
            },
          },
        },
      ],
    });

    const greeterService = new EcsFargateAppMeshService(this, 'greeter', {
      cluster,
      mesh,
      fargateServices: [
        {
          port: 3000,
          name: 'greeter',
          securityGroup,
          containerOptions: {
            image: ecs.ContainerImage.fromRegistry('nathanpeck/greeter'),
            // healthCheck,
            memoryLimitMiB: 128,
            logging: new ecs.AwsLogDriver({
              streamPrefix: 'app-mesh-greeter',
            }),
            environment: {
              GREETING_URL: 'http://greeting.internal:3000',
              NAME_URL: 'http://name.internal:3000',
              PORT: '3000',
            },
          },
        },
      ],
    });

    greeterService.addBackend(nameService);
    greeterService.addBackend(greetingService);

    // Setup an internet facing load balancer for exposing the public facing greeter service to the public.
    // Right now it is set to false because we get traffic from Api Gateway thru VPC Link (ApiGateway directly proxy public traffic to this ALB)
    const externalLB = new elbv2.ApplicationLoadBalancer(this, 'external', {
      internetFacing: false,
      vpc,
    });

    const externalListener = externalLB.addListener('PublicListener', { port: 80 });
    externalListener.addTargets('greeter', {
      port: 80,
      targets: [greeterService.fargateServices[0]],
    });

    this.externalDNS = new cdk.CfnOutput(this, 'ExternalDNS', {
      exportName: 'greeter-app-external',
      value: externalLB.loadBalancerDnsName,
    });

    const httpEndpoint = new HttpApi(this, 'HttpApiPrivateItg', {
      corsPreflight: {
        allowHeaders: ['*'],
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
        allowOrigins: ['*'],
      },
      defaultIntegration: new HttpAlbIntegration({
        listener: externalListener,
      }),
    });

    this.httpApiGwEndpointsDNS = new cdk.CfnOutput(this, 'HttpApiGwDNS', {
      exportName: 'http-api-dns',
      value: httpEndpoint.url || 'no-url-found',
    });
  }
}
