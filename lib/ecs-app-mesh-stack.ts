import * as cdk from '@aws-cdk/core';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as appmesh from '@aws-cdk/aws-appmesh';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as servicediscovery from '@aws-cdk/aws-servicediscovery';
import { Peer, Port, SecurityGroup, SubnetType } from '@aws-cdk/aws-ec2';
import { EcsFargateAppMeshService } from './constructs/ecs-fargate-appmesh-service.construct';
import { HttpAlbIntegration, LambdaProxyIntegration } from '@aws-cdk/aws-apigatewayv2-integrations';
import { CfnOutput } from '@aws-cdk/core';
import { Function as LambdaFunction, Runtime, Code, Tracing } from '@aws-cdk/aws-lambda';
import { HttpApi, CorsHttpMethod, HttpMethod } from '@aws-cdk/aws-apigatewayv2';

// ** IMPORTANT: Make sure all package have same version (1.95 across everything, remove the ^ symbol, 1.95.0 !== 1.95.1)

export class PersonalColorStack extends cdk.Stack {
  public externalDNS: cdk.CfnOutput;
  public httpApiGwEndpointsDNS: cdk.CfnOutput;

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Default Max Availability zone is 3, default to 1 NAT Gateway per Az
    // NAT gateway is charged even if it is not used - expensive
    const vpc = new ec2.Vpc(this, 'personal-color-vpc', {
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
    const cluster = new ecs.Cluster(this, 'personal-color-cluster', {
      vpc,
      containerInsights: true,
      defaultCloudMapNamespace: {
        name: 'internal',
        type: servicediscovery.NamespaceType.DNS_PRIVATE,
      },
    });

    // Create an App Mesh
    const mesh = new appmesh.Mesh(this, 'app-mesh-demo', {
      meshName: 'personal-color-mesh',
    });

    // Add capacity/auto-scaling to it
    // This is the default auto scaling group, to create customize one, use autoscaling.AutoScalingGroup (@aws-cdk/aws-autoscalling)
    // cluster.addAutoScalingGroup
    cluster.addCapacity('personal-color-capacity', {
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
            image: ecs.ContainerImage.fromRegistry('banvuong/name:demo'),
            // healthCheck,
            memoryLimitMiB: 128,
            logging: new ecs.AwsLogDriver({
              streamPrefix: 'name-log',
            }),
            environment: {
              PORT: '3000',
            },
          },
        },
      ],
    });

    const colorService = new EcsFargateAppMeshService(this, 'color', {
      cluster,
      mesh,
      fargateServices: [
        {
          port: 3000,
          name: 'color',
          securityGroup,
          containerOptions: {
            image: ecs.ContainerImage.fromRegistry('banvuong/color-v1:demo'),
            // healthCheck,
            memoryLimitMiB: 128,
            logging: new ecs.AwsLogDriver({
              streamPrefix: 'color-v1-log',
            }),
            environment: {
              PORT: '3000',
            },
          },
        },
        {
          port: 3000,
          name: 'color-v2',
          securityGroup,
          containerOptions: {
            image: ecs.ContainerImage.fromRegistry('banvuong/color-v2:demo'),
            // healthCheck,
            memoryLimitMiB: 128,
            logging: new ecs.AwsLogDriver({
              streamPrefix: 'color-v2-log',
            }),
            environment: {
              PORT: '3000',
            },
          },
        },
      ],
    });

    const personalColorService = new EcsFargateAppMeshService(this, 'personal-color', {
      cluster,
      mesh,
      fargateServices: [
        {
          port: 3000,
          name: 'personal-color',
          securityGroup,
          containerOptions: {
            image: ecs.ContainerImage.fromRegistry('banvuong/personal-color:demo'),
            // healthCheck,
            memoryLimitMiB: 128,
            logging: new ecs.AwsLogDriver({
              streamPrefix: 'personal-color-log',
            }),
            environment: {
              NAME_URL: 'http://name.internal:3000',
              COLOR_URL: 'http://color.internal:3000',
              PORT: '3000',
            },
          },
        },
      ],
    });

    personalColorService.addBackend(nameService);
    personalColorService.addBackend(colorService);

    // ALB is no longer necessary once we put lambda inside VPC
    // Lambda can directly invoke internal resources such as http://greeting.internal:3000
    const externalLB = new elbv2.ApplicationLoadBalancer(this, 'external', {
      internetFacing: true,
      vpc,
    });

    const externalListener = externalLB.addListener('PublicListener', { port: 80 });
    externalListener.addTargets('greeter', {
      port: 80,
      targets: [personalColorService.fargateServices[0]],
    });

    this.externalDNS = new cdk.CfnOutput(this, 'ExternalDNS', {
      exportName: 'greeter-app-external',
      value: externalLB.loadBalancerDnsName,
    });

    const lambdaSg = new SecurityGroup(this, 'lambda-sg', {
      securityGroupName: 'lambda-web-access',
      allowAllOutbound: true,
      vpc,
    });
    lambdaSg.addIngressRule(Peer.anyIpv4(), Port.tcp(80), 'http port');
    lambdaSg.addIngressRule(Peer.anyIpv4(), Port.tcp(443), 'https port');

    const helloHandler = new LambdaFunction(this, 'HelloHandler', {
      runtime: Runtime.NODEJS_14_X,
      code: Code.fromAsset('applications/lambda-handlers/deploy'),
      handler: 'hello-world.helloHandler', // hello-world.js file, helloHandler function,
      vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE,
      },
      securityGroups: [lambdaSg],
      tracing: Tracing.ACTIVE, // xray tracing
      environment: {
        PERSONAL_COLOR_URL: 'http://personal-color.internal:3000',
      },
    });

    const helloIntegration = new LambdaProxyIntegration({
      handler: helloHandler,
    });

    const httpApi = new HttpApi(this, 'HttpApi', {
      corsPreflight: {
        allowHeaders: ['*'],
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
        allowOrigins: ['*'],
      },
    });

    httpApi.addRoutes({
      path: '/',
      methods: [HttpMethod.GET],
      integration: helloIntegration,
    });

    new CfnOutput(this, 'RestApi', {
      exportName: 'rest-api-dns',
      value: httpApi.url || 'no-url-found',
    });
  }
}
