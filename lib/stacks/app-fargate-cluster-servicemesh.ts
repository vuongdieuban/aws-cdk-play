import { InstanceClass, InstanceSize, InstanceType, Peer, Port, SecurityGroup, Vpc } from '@aws-cdk/aws-ec2';
import { CfnOutput, Construct, Duration } from '@aws-cdk/core';
import { Cluster, ContainerImage, AwsLogDriver, FargateService, HealthCheck } from '@aws-cdk/aws-ecs';
import { Mesh, VirtualService } from '@aws-cdk/aws-appmesh';
import { NamespaceType } from '@aws-cdk/aws-servicediscovery';
import { ApplicationLoadBalancer, IApplicationListener } from '@aws-cdk/aws-elasticloadbalancingv2';
import { EcsFargateAppMeshService } from '../shared-resources/ecs-fargate-appmesh-service.construct';

interface Props {
  vpc: Vpc;
}

export class AppFargateClusterWithServiceMesh extends Construct {
  public applicationListener: IApplicationListener;
  public externalDNS: CfnOutput;
  public httpApiGwEndpointsDNS: CfnOutput;

  private readonly privateCloudMapNamespace = 'internal'; // personal-color.internal:3000

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);
    const { vpc } = props;

    const internalSecurityGroup = this.createInternalSecurityGroup(vpc);
    const ecsCluster = this.createEcsCluster(vpc);
    const serviceMesh = this.createAppMesh();
    const healthCheck = this.createGenericApplicationHealthCheck();

    const nameService = this.createNameService(ecsCluster, serviceMesh, internalSecurityGroup);

    const colorService = this.createColorService(ecsCluster, serviceMesh, internalSecurityGroup);

    const personalColorService = this.createPersonalColorService(
      ecsCluster,
      serviceMesh,
      internalSecurityGroup,
      [nameService.virtualService, colorService.virtualService],
    );

    this.createALB(vpc, personalColorService.fargateServices[0]);
  }

  private createEcsCluster(vpc: Vpc) {
    // Create an ECS cluster
    const cluster = new Cluster(this, 'personal-color-cluster', {
      vpc,
      containerInsights: true,
      defaultCloudMapNamespace: {
        name: this.privateCloudMapNamespace,
        type: NamespaceType.DNS_PRIVATE,
      },
    });

    // Add capacity/auto-scaling to it
    // This is the default auto scaling group, to create customize one, use autoscaling.AutoScalingGroup (@aws-cdk/aws-autoscalling)
    // cluster.addAutoScalingGroup
    cluster.addCapacity('personal-color-capacity', {
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      minCapacity: 1,
      maxCapacity: 1,
    });

    return cluster;
  }

  private createAppMesh() {
    return new Mesh(this, 'personal-color-mesh', {
      meshName: 'personal-color-mesh',
    });
  }

  private createInternalSecurityGroup(vpc: Vpc) {
    const securityGroup = new SecurityGroup(this, 'ecs-internal-sg', {
      securityGroupName: 'ecs-internal-sg',
      allowAllOutbound: true,
      vpc,
    });

    // allow any ipv4 address (for tighter control, can just allow certain ip addresses)
    // alternatively, can use Peer.anyIpv4() (same as 0.0.0.0/0)
    securityGroup.addIngressRule(Peer.ipv4('0.0.0.0/0'), Port.tcp(3000), 'App Port');

    return securityGroup;
  }

  private createALB(vpc: Vpc, personalColorService: FargateService) {
    // ALB is no longer necessary once we put lambda inside VPC
    // Lambda can directly invoke internal resources such as http://greeting.internal:3000
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

  private createGenericApplicationHealthCheck(): HealthCheck {
    return {
      command: ['curl localhost:3000'],
      startPeriod: Duration.seconds(10),
      interval: Duration.seconds(300),
      timeout: Duration.seconds(2),
      retries: 3,
    };
  }

  private createNameService(cluster: Cluster, mesh: Mesh, securityGroup: SecurityGroup) {
    // SplunkLogDriver - sends log to splunk (need Splunk auth token)
    // Right now we log to a file system inside the container, but we cannot ssh into that container to get the file
    // Might as well use AWS Splunk Log Driver and let AWS manage the splunk log

    return new EcsFargateAppMeshService(this, 'name', {
      cluster,
      mesh,
      fargateServices: [
        {
          port: 3000,
          name: 'name',
          securityGroup,
          containerOptions: {
            image: ContainerImage.fromRegistry('banvuong/name:demo'),
            // healthCheck,
            memoryLimitMiB: 128,
            logging: new AwsLogDriver({
              streamPrefix: 'name-log',
            }),
            environment: {
              PORT: '3000',
            },
          },
        },
      ],
    });
  }

  private createColorService(cluster: Cluster, mesh: Mesh, securityGroup: SecurityGroup) {
    return new EcsFargateAppMeshService(this, 'color', {
      cluster,
      mesh,
      fargateServices: [
        {
          port: 3000,
          name: 'color',
          securityGroup,
          containerOptions: {
            image: ContainerImage.fromRegistry('banvuong/color-v1:demo'),
            // healthCheck,
            memoryLimitMiB: 128,
            logging: new AwsLogDriver({
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
            image: ContainerImage.fromRegistry('banvuong/color-v2:demo'),
            // healthCheck,
            memoryLimitMiB: 128,
            logging: new AwsLogDriver({
              streamPrefix: 'color-v2-log',
            }),
            environment: {
              PORT: '3000',
            },
          },
        },
      ],
    });
  }

  private createPersonalColorService(
    cluster: Cluster,
    mesh: Mesh,
    securityGroup: SecurityGroup,
    backends: VirtualService[],
  ) {
    const personalColorService = new EcsFargateAppMeshService(this, 'personal-color', {
      cluster,
      mesh,
      fargateServices: [
        {
          port: 3000,
          name: 'personal-color',
          securityGroup,
          containerOptions: {
            image: ContainerImage.fromRegistry('banvuong/personal-color:demo'),
            // healthCheck,
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
        },
      ],
    });

    backends.forEach(virtualService => {
      personalColorService.addBackend(virtualService);
    });

    return personalColorService;
  }
}
