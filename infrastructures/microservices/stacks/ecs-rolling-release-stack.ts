import { Peer, Port, SecurityGroup, SubnetType, Vpc } from '@aws-cdk/aws-ec2';
import { App, CfnOutput, Duration, Stack, StackProps } from '@aws-cdk/core';
import { Cluster, ContainerImage, AwsLogDriver } from '@aws-cdk/aws-ecs';
import { NamespaceType } from '@aws-cdk/aws-servicediscovery';
import { EcsFargateService } from '../../shared-resources/ecs-fargate-service';
import { AppVpc } from '../../shared-resources/app-vpc';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import { ListenerAction, ListenerCondition } from '@aws-cdk/aws-elasticloadbalancingv2';
import * as servicediscovery from '@aws-cdk/aws-servicediscovery';
import { Runtime, Code, Tracing, Function as LambdaFunction } from '@aws-cdk/aws-lambda';

export class EcsRollingReleaseStack extends Stack {
  constructor(scope: App, id: string, props: StackProps) {
    super(scope, id, props);

    const vpcStack = new AppVpc(this, 'AppVpc');
    const { vpc } = vpcStack;

    const internalSecurityGroup = this.createInternalSecurityGroup(vpc);
    const ecsCluster = this.createEcsCluster(vpc);

    const colorService = this.createColorService(ecsCluster, internalSecurityGroup);

    // TODO: Try the following:
    // We can create a listern and add listerner into ALB in main stack
    // Then we can create TargetGroup and SeviceDiscovery inside the EcsService stack
    // We can then use the target group in EcsServiceStack to register the fargate service
    // We can then import Listener inside EcsServiceStack, then register the TargetGroup to that listener.
    // We can then define action pattern in EcsService
    const colorTG = new elbv2.ApplicationTargetGroup(this, 'ColorTG', {
      vpc,
      healthCheck: {
        enabled: true,
        path: '/health',
      },
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [colorService.fargateService],
    });

    const lb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      internetFacing: true,
    });

    const listener = lb.addListener('Listener', {
      port: 80,
      open: true,
    });

    listener.addAction('Color', {
      priority: 1,
      conditions: [ListenerCondition.hostHeaders(['color.*'])],
      action: ListenerAction.forward([colorTG]),
    });

    // default, no match condition go here
    listener.addAction('Fixed', {
      action: ListenerAction.fixedResponse(200, {
        contentType: 'text/plain',
        messageBody: 'OK',
      }),
    });

    new CfnOutput(this, 'ALb-DNS', {
      exportName: 'Alb-DNS',
      value: lb.loadBalancerDnsName,
    });

    const namespace = new servicediscovery.PrivateDnsNamespace(this, 'internal', {
      name: 'internal',
      vpc,
    });

    // Proxy to ALB, ALB then use the hostheader to route request
    const nsServiceColor = namespace.createService('color', {
      dnsRecordType: servicediscovery.DnsRecordType.A,
      dnsTtl: Duration.seconds(30),
      loadBalancer: true,
      name: 'color',
    });

    nsServiceColor.registerLoadBalancer('lb', lb);

    new LambdaFunction(this, 'ping-lambda', {
      runtime: Runtime.NODEJS_14_X,
      code: Code.fromAsset('applications/lambda-handlers/deploy'),
      handler: 'ping-internal.pingInternal',
      vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE,
      },
    });
  }

  private createEcsCluster(vpc: Vpc) {
    const cluster = new Cluster(this, 'color-cluster', {
      vpc,
      containerInsights: true,
    });

    return cluster;
  }

  private createColorService(cluster: Cluster, securityGroup: SecurityGroup) {
    return new EcsFargateService(this, 'color', {
      cluster,
      port: 3000,
      name: 'color',
      securityGroup,
      debugPort: 9229,
      containerOptions: {
        image: ContainerImage.fromRegistry('banvuong/color-v1:demo'),
        memoryLimitMiB: 128,
        logging: new AwsLogDriver({
          streamPrefix: 'color-v1-log',
        }),
        environment: {
          PORT: '3000',
        },
      },
    });
  }

  private createInternalSecurityGroup(vpc: Vpc) {
    const securityGroup = new SecurityGroup(this, 'ecs-internal-sg', {
      securityGroupName: 'ecs-internal-sg',
      allowAllOutbound: true,
      vpc,
    });

    securityGroup.addIngressRule(Peer.ipv4('0.0.0.0/0'), Port.tcp(3000), 'App Port');
    securityGroup.addIngressRule(Peer.ipv4('0.0.0.0/0'), Port.tcp(9229), 'Debug Port');

    return securityGroup;
  }
}
