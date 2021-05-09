import { Vpc } from '@aws-cdk/aws-ec2';
import { Cluster } from '@aws-cdk/aws-ecs';
import { NamespaceType } from '@aws-cdk/aws-servicediscovery';
import { Stack, App, StackProps } from '@aws-cdk/core';
import { AppVpc } from '../../shared-resources/app-vpc';
import { ParameterTier, StringParameter } from '@aws-cdk/aws-ssm';

export class SsmCreateParamsStack extends Stack {
  private privateCloudMapNamespace = 'internal';
  private ecsClusterName = 'DemoCluster';

  private paramNameOfVpcId = 'AppVpcId';
  private paramNameOfClusterArn = 'AppEcsClusterArn';
  private paramNameOfClusterName = 'AppEcsClusterName';

  constructor(scope: App, id: string, props: StackProps) {
    super(scope, id, props);

    // Imagine vpc and ecs cluster being created in a different stack
    // We want to import and use them to create a fargate service.
    // When we first create Vpc and Cluster, we store VpcId and ClusterArn and ClusterName into SSM Parameter Store
    // We can import them through reference vpcId and cluserArn by retreiving them from SSM
    const { vpc } = this.createVpc();
    const ecsCluster = this.createEcsCluster(vpc);
    this.createSsmParamsForVpcAndCluster(vpc, ecsCluster);
  }

  private createVpc() {
    return new AppVpc(this, 'AppVpcDemo');
  }

  private createEcsCluster(vpc: Vpc) {
    return new Cluster(this, 'AppDemoCluster', {
      vpc,
      defaultCloudMapNamespace: {
        name: this.privateCloudMapNamespace,
        type: NamespaceType.DNS_PRIVATE,
      },
      clusterName: this.ecsClusterName,
    });
  }

  private createSsmParamsForVpcAndCluster(vpc: Vpc, ecsCluster: Cluster) {
    const { vpcId } = vpc;
    const { clusterArn, clusterName } = ecsCluster;

    // Public non encrypted string value, use secret manager for secrets
    new StringParameter(this, this.paramNameOfVpcId, {
      description: 'The value of app vpcId',
      parameterName: this.paramNameOfVpcId,
      stringValue: vpcId,
      tier: ParameterTier.STANDARD,
    });

    new StringParameter(this, this.paramNameOfClusterArn, {
      description: 'The value of ecs cluster ARN',
      parameterName: this.paramNameOfClusterArn,
      stringValue: clusterArn,
      tier: ParameterTier.STANDARD,
    });

    new StringParameter(this, this.paramNameOfClusterName, {
      description: 'The value of ecs cluster name',
      parameterName: this.paramNameOfClusterName,
      stringValue: clusterName,
      tier: ParameterTier.STANDARD,
    });
  }
}
