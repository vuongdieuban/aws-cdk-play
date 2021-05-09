import { App, Stack, StackProps } from '@aws-cdk/core';
import { AppVpc } from '../../shared-resources/app-vpc';
import { AppApiGatewayLambda } from '../constructs/app-apigw-lambda';
import { AppFargateClusterWithServiceMesh } from '../constructs/app-fargate-cluster-servicemesh';

export class MicroServicesWithEcsAndAppMeshStack extends Stack {
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
