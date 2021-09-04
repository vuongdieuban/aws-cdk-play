import { Peer, Port, SecurityGroup, Vpc } from '@aws-cdk/aws-ec2';
import { App, Stack, StackProps } from '@aws-cdk/core';
import { Cluster, ContainerImage, AwsLogDriver } from '@aws-cdk/aws-ecs';
import { NamespaceType } from '@aws-cdk/aws-servicediscovery';
import { EcsFargateService } from '../../shared-resources/ecs-fargate-service';
import { AppVpc } from '../../shared-resources/app-vpc';

export class EcsRollingReleaseStack extends Stack {
  private readonly privateCloudMapNamespace = 'internal'; // personal-color.internal:3000

  constructor(scope: App, id: string, props: StackProps) {
    super(scope, id, props);

    const vpcStack = new AppVpc(this, 'AppVpc');
    const { vpc } = vpcStack;

    const internalSecurityGroup = this.createInternalSecurityGroup(vpc);
    const ecsCluster = this.createEcsCluster(vpc);

    const colorService = this.createColorService(ecsCluster, internalSecurityGroup);
  }

  private createEcsCluster(vpc: Vpc) {
    const cluster = new Cluster(this, 'color-cluster', {
      vpc,
      containerInsights: true,
      defaultCloudMapNamespace: {
        name: this.privateCloudMapNamespace,
        type: NamespaceType.DNS_PRIVATE,
      },
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
