import * as cdk from '@aws-cdk/core';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as appmesh from '@aws-cdk/aws-appmesh';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as servicediscovery from '@aws-cdk/aws-servicediscovery';
import { SecurityGroup } from '@aws-cdk/aws-ec2';
import { EcsFargateAppMeshService } from './constructs/ecs-fargate-appmesh-service.construct';
export class GreetingStack extends cdk.Stack {
  public externalDNS: cdk.CfnOutput;
  constructor(parent: any, id: string, props?: any) {
    super(parent, id, props);

    const vpc = new ec2.Vpc(this, 'GreetingVpc', { maxAzs: 2 });

    const securityGroup = new SecurityGroup(this, 'ecs-appmesh-sg', {
      securityGroupName: 'appmesh-sg',
      vpc,
      allowAllOutbound: true,
    });

    // TODO: This allow 80 and 3000 to all service, maybe only need 3000, doesn't need 80.
    // 80 port is for the public listener
    securityGroup.addIngressRule(ec2.Peer.ipv4('0.0.0.0/0'), ec2.Port.tcp(3000), 'App Port');

    // Create an ECS cluster
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: vpc,
      defaultCloudMapNamespace: {
        name: 'internal',
        type: servicediscovery.NamespaceType.DNS_PRIVATE,
      },
    });

    // Create an App Mesh
    const mesh = new appmesh.Mesh(this, 'app-mesh', {
      meshName: 'greeting-app-mesh',
      //egressFilter: appmesh.MeshFilterType.DROP_ALL
    });

    // Add capacity to it
    cluster.addCapacity('greeter-capacity', {
      instanceType: new ec2.InstanceType('t3.xlarge'),
      minCapacity: 3,
      maxCapacity: 3,
    });

    const healthCheck = {
      command: ['curl localhost:3000'],
      startPeriod: cdk.Duration.seconds(10),
      interval: cdk.Duration.seconds(5),
      timeout: cdk.Duration.seconds(2),
      retries: 3,
    };

    const nameService = new EcsFargateAppMeshService(this, 'name', {
      cluster: cluster,
      mesh: mesh,
      portNumber: 3000,
      securityGroup,
      applicationContainer: {
        image: ecs.ContainerImage.fromRegistry('nathanpeck/name'),
        healthCheck: healthCheck,
        memoryLimitMiB: 128,
        logging: new ecs.AwsLogDriver({
          streamPrefix: 'app-mesh-name',
        }),
        environment: {
          PORT: '3000',
        },
      },
    });

    const greetingService = new EcsFargateAppMeshService(this, 'greeting', {
      cluster: cluster,
      mesh: mesh,
      portNumber: 3000,
      securityGroup,
      applicationContainer: {
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
      cluster: cluster,
      mesh: mesh,
      portNumber: 3000,
      securityGroup,
      applicationContainer: {
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

    // Last but not least setup an internet facing load balancer for
    // exposing the public facing greeter service to the public.
    const externalLB = new elbv2.NetworkLoadBalancer(this, 'external', {
      vpc,
      internetFacing: true, // TODO: try make this false and create VpcLink from ApiGateway to access it
    });

    const externalListener = externalLB.addListener('PublicListener', { port: 80 });

    externalListener.addTargets('greeter', {
      port: 3000,
      targets: [greeterService.service],
    });

    this.externalDNS = new cdk.CfnOutput(this, 'ExternalDNS', {
      exportName: 'greeter-app-external',
      value: externalLB.loadBalancerDnsName,
    });
  }
}
