import * as cdk from '@aws-cdk/core';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as appmesh from '@aws-cdk/aws-appmesh';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as servicediscovery from '@aws-cdk/aws-servicediscovery';
import * as apigw from '@aws-cdk/aws-apigatewayv2';
import { HttpAlbIntegration } from '@aws-cdk/aws-apigatewayv2-integrations';
import { SecurityGroup } from '@aws-cdk/aws-ec2';
import { EcsFargateAppMeshService } from './constructs/ecs-fargate-appmesh-service.construct';

// ** IMPORTANT: Make sure all package have same version (1.95 across everything, remove the ^ symbol, 1.95.0 !== 1.95.1)

export class GreetingStack extends cdk.Stack {
  public externalDNS: cdk.CfnOutput;
  public httpApiGwEndpointsDNS: cdk.CfnOutput;

  constructor(scope: cdk.Stack, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Default Max Availability zone is 3, also default to 1 NAT Gateway per Az
    // NAT gateway is charged even if it is not used - expensive
    const vpc = new ec2.Vpc(this, 'GreetingVpc', {
      maxAzs: 1,
      natGateways: 0,
    });

    const securityGroup = new SecurityGroup(this, 'ecs-appmesh-sg', {
      securityGroupName: 'appmesh-sg',
      allowAllOutbound: true,
      vpc,
    });

    securityGroup.addIngressRule(ec2.Peer.ipv4('0.0.0.0/0'), ec2.Port.tcp(3000), 'App Port');

    // Create an ECS cluster
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
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
    cluster.addCapacity('greeter-capacity', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      minCapacity: 1,
      maxCapacity: 2,
    });

    const healthCheck = {
      command: ['curl localhost:3000'],
      startPeriod: cdk.Duration.days(1),
      interval: cdk.Duration.days(1), // should be Duration.seconds but its expensive since it call the service every specified seconds
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
      appPortNumber: 3000,
      securityGroup,
      appContainerOptions: {
        image: ecs.ContainerImage.fromRegistry('nathanpeck/name'),
        healthCheck: healthCheck,
        memoryLimitMiB: 128,
        cpu: 128,
        logging: new ecs.AwsLogDriver({
          streamPrefix: 'app-mesh-name',
        }),
        environment: {
          PORT: '3000',
        },
      },
    });

    const greetingService = new EcsFargateAppMeshService(this, 'greeting', {
      cluster,
      mesh,
      appPortNumber: 3000,
      securityGroup,
      appContainerOptions: {
        image: ecs.ContainerImage.fromRegistry('nathanpeck/greeting'),
        healthCheck: healthCheck,
        memoryLimitMiB: 128,
        logging: new ecs.AwsLogDriver({
          streamPrefix: 'app-mesh-greeting',
        }),
        environment: {
          PORT: '3000',
        },
      },
    });

    const greeterService = new EcsFargateAppMeshService(this, 'greeter', {
      cluster,
      mesh,
      appPortNumber: 3000,
      securityGroup,
      appContainerOptions: {
        image: ecs.ContainerImage.fromRegistry('nathanpeck/greeter'),
        healthCheck: healthCheck,
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
    });

    greeterService.connectToMeshService(nameService);
    greeterService.connectToMeshService(greetingService);

    // Setup an internet facing load balancer for exposing the public facing greeter service to the public.
    // Right now it is set to false because we get traffic from Api Gateway thru VPC Link (ApiGateway directly proxy public traffic to this ALB)
    const externalLB = new elbv2.ApplicationLoadBalancer(this, 'external', {
      internetFacing: false,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC, // default is Private
      },
    });

    const externalListener = externalLB.addListener('PublicListener', { port: 80 });
    externalListener.addTargets('greeter', {
      port: 80,
      targets: [greeterService.service],
    });

    this.externalDNS = new cdk.CfnOutput(this, 'ExternalDNS', {
      exportName: 'greeter-app-external',
      value: externalLB.loadBalancerDnsName,
    });

    // Use VPC Link to proxy all request from api gatway to private Load balancer
    const httpEndpoint = new apigw.HttpApi(this, 'HttpProxyPrivateApi', {
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
