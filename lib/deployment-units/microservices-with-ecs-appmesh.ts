import { App, Stack, StackProps } from '@aws-cdk/core';
import { AppApiGatewayLambda } from '../stacks/app-apigw-lambda';
import { AppFargateClusterWithServiceMesh } from '../stacks/app-fargate-cluster-servicemesh';
import { AppVpc } from '../stacks/vpc-stack';

export class MicroServicesWithEcsAndAppMesh extends Stack {
  constructor(scope: App, id: string, props: StackProps) {
    super(scope, id, props);

    const appVpc = new AppVpc(this, 'AppVpc');
    const { vpc } = appVpc;

    const fargateCluster = new AppFargateClusterWithServiceMesh(this, 'AppFargateClusterWithServiceMesh', {
      vpc,
    });
    const { applicationListener } = fargateCluster;

    new AppApiGatewayLambda(this, 'AppApiGatewayLambda', {
      vpc,
      applicationListener,
    });
  }
}
