import { Vpc } from '@aws-cdk/aws-ec2';
import { Cluster } from '@aws-cdk/aws-ecs';
import { NamespaceType } from '@aws-cdk/aws-servicediscovery';
import { App, Stack, StackProps } from '@aws-cdk/core';
import { VpcStack } from './vpc-stack';

export class VpcWithEcsClusterStack extends Stack {
  public vpc: Vpc;
  public ecsCluster: Cluster;
  private readonly privateCloudMapNamespace = 'internal';

  constructor(scope: App, id: string, props: StackProps) {
    super(scope, id, props);

    const { vpc } = new VpcStack(scope, 'DemoVpc', {
      env: props.env,
    });

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
