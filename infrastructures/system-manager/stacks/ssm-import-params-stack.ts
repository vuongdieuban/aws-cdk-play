import { IVpc, Vpc } from '@aws-cdk/aws-ec2';
import { Cluster, ContainerImage, FargateTaskDefinition, ICluster } from '@aws-cdk/aws-ecs';
import { ApplicationLoadBalancedFargateService } from '@aws-cdk/aws-ecs-patterns';
import { Stack, App, StackProps } from '@aws-cdk/core';
import { StringParameter } from '@aws-cdk/aws-ssm';

export class SsmImportParamsStack extends Stack {
  private paramNameOfVpcId = 'AppVpcId';
  private paramNameOfClusterArn = 'AppEcsClusterArn';
  private paramNameOfClusterName = 'AppEcsClusterName';

  constructor(scope: App, id: string, props: StackProps) {
    super(scope, id, props);

    /* NOTE: 
    For this to work, SsmCreateParams stack has to be deployed first and completed.
    Otherwise, it will complain that we are reference non existed Vpc and Cluster.
    Vpc and Cluster is created in SsmCreateParams Stack
    */

    // Import existed VPC and Cluster through importing the VpcId and ClusterArn from SSM
    // Use the existed cluster to create a fargate service
    const existedVpc = this.importExistedVpc();
    const existedCluster = this.importExistedCluster(existedVpc);
    this.createFargateService(existedCluster);
  }

  private importExistedVpc() {
    const existedVpcId = StringParameter.valueFromLookup(this, this.paramNameOfVpcId);
    return Vpc.fromLookup(this, 'ExistedVpc', {
      vpcId: existedVpcId,
    });
  }

  private importExistedCluster(existedVpc: IVpc) {
    const existedClusterArn = StringParameter.valueFromLookup(this, this.paramNameOfClusterArn);
    const existedClusterName = StringParameter.valueFromLookup(this, this.paramNameOfClusterName);

    return Cluster.fromClusterAttributes(this, 'ExistedCluster', {
      clusterName: existedClusterName,
      clusterArn: existedClusterArn,
      vpc: existedVpc,
      securityGroups: [],
    });
  }

  private createFargateService(cluster: ICluster) {
    const taskDefinition = new FargateTaskDefinition(this, `app-task-definition`);

    const appContainer = taskDefinition.addContainer('app', {
      image: ContainerImage.fromRegistry('banvuong/name:demo'),
      environment: {
        PORT: '3000',
      },
    });
    appContainer.addPortMappings({
      containerPort: 3000,
      hostPort: 3000,
    });

    const app = new ApplicationLoadBalancedFargateService(this, 'MyApp', {
      taskDefinition,
      cluster,
    });
  }
}
