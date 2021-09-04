import { InstanceClass, InstanceSize, InstanceType, Peer, Port, SecurityGroup, Vpc } from '@aws-cdk/aws-ec2';
import { App, CfnOutput, Construct } from '@aws-cdk/core';
import { Cluster, ContainerImage, AwsLogDriver, FargateService } from '@aws-cdk/aws-ecs';
import { NamespaceType } from '@aws-cdk/aws-servicediscovery';
import { ApplicationLoadBalancer, IApplicationListener } from '@aws-cdk/aws-elasticloadbalancingv2';
import { EcsFargateService } from '../../shared-resources/ecs-fargate-service';

interface Props {
  vpc: Vpc;
}

export class AppFargateCluster extends Construct {
  public applicationListener: IApplicationListener;
  public externalDNS: CfnOutput;
  public httpApiGwEndpointsDNS: CfnOutput;

  private readonly privateCloudMapNamespace = 'internal'; // personal-color.internal:3000

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);
    const { vpc } = props;

    const internalSecurityGroup = this.createInternalSecurityGroup(vpc);
    const ecsCluster = this.createEcsCluster(vpc);

    const nameService = this.createNameService(ecsCluster, internalSecurityGroup);

    const colorService = this.createColorService(ecsCluster, internalSecurityGroup);

    const personalColorService = this.createPersonalColorService(ecsCluster, internalSecurityGroup);

    this.createALB(vpc, personalColorService.fargateService);
  }

  private createEcsCluster(vpc: Vpc) {
    const cluster = new Cluster(this, 'personal-color-cluster', {
      vpc,
      containerInsights: true,
      defaultCloudMapNamespace: {
        name: this.privateCloudMapNamespace,
        type: NamespaceType.DNS_PRIVATE,
      },
    });

    cluster.addCapacity('personal-color-capacity', {
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      minCapacity: 1,
      maxCapacity: 1,
    });

    return cluster;
  }

  private createInternalSecurityGroup(vpc: Vpc) {
    const securityGroup = new SecurityGroup(this, 'ecs-internal-sg', {
      securityGroupName: 'ecs-internal-sg',
      allowAllOutbound: true,
      vpc,
    });

    securityGroup.addIngressRule(Peer.ipv4('0.0.0.0/0'), Port.tcp(3000), 'App Port');

    return securityGroup;
  }

  private createALB(vpc: Vpc, personalColorService: FargateService) {
    const externalLB = new ApplicationLoadBalancer(this, 'private-alb', {
      internetFacing: false,
      vpc,
    });

    const externalListener = externalLB.addListener('private-alb-listener', { port: 80 });
    externalListener.addTargets('private-alb-targets', {
      port: 80,
      targets: [personalColorService],
    });

    this.externalDNS = new CfnOutput(this, 'alb-dns', {
      exportName: 'private-alb-dns',
      value: externalLB.loadBalancerDnsName,
    });

    this.applicationListener = externalListener;

    return externalLB;
  }

  private createNameService(cluster: Cluster, securityGroup: SecurityGroup) {
    return new EcsFargateService(this, 'name', {
      cluster,
      port: 3000,
      name: 'name',
      securityGroup,
      containerOptions: {
        image: ContainerImage.fromRegistry('banvuong/name:demo'),
        memoryLimitMiB: 128,
        logging: new AwsLogDriver({
          streamPrefix: 'name-log',
        }),
        environment: {
          PORT: '3000',
        },
      },
    });
  }

  private createColorService(cluster: Cluster, securityGroup: SecurityGroup) {
    return new EcsFargateService(this, 'color', {
      cluster,
      port: 3000,
      name: 'color',
      securityGroup,
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

  private createPersonalColorService(cluster: Cluster, securityGroup: SecurityGroup) {
    return new EcsFargateService(this, 'personal-color', {
      cluster,
      port: 3000,
      name: 'personal-color',
      securityGroup,
      containerOptions: {
        image: ContainerImage.fromRegistry('banvuong/personal-color:demo'),
        memoryLimitMiB: 128,
        logging: new AwsLogDriver({
          streamPrefix: 'personal-color-log',
        }),
        environment: {
          NAME_URL: 'http://name.internal:3000',
          COLOR_URL: 'http://color.internal:3000',
          PORT: '3000',
        },
      },
    });
  }
}
