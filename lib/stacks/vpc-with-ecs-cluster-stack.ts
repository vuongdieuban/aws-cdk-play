import { Vpc } from '@aws-cdk/aws-ec2';
import { Cluster } from '@aws-cdk/aws-ecs';
import { NamespaceType } from '@aws-cdk/aws-servicediscovery';
import { Construct, Stack } from '@aws-cdk/core';
import { AppVpc } from './vpc-stack';

export class VpcWithEcsClusterStack extends Stack {
  public vpc: Vpc;
  public ecsCluster: Cluster;
  private readonly privateCloudMapNamespace = 'internal';

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const { vpc } = new AppVpc(scope, 'DemoVpc');

    const cluster = new Cluster(this, 'DemoCluster', {
      vpc,
      containerInsights: true,
      defaultCloudMapNamespace: {
        name: this.privateCloudMapNamespace,
        type: NamespaceType.DNS_PRIVATE,
      },
      clusterName: 'DemoCluster',
    });
  }
}
