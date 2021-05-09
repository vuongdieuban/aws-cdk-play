import { App, Stack, StackProps } from '@aws-cdk/core';
import { AppApiGatewayLambda } from '../constructs/app-apigw-lambda';
import { AppFargateCluster } from '../constructs/app-fargate-cluster';
import { AppVpc } from '../../shared-resources/app-vpc';

export class MicroServicesWithEcsFargateStack extends Stack {
  constructor(scope: App, id: string, props: StackProps) {
    super(scope, id, props);

    const vpcStack = new AppVpc(this, 'AppVpc');
    const { vpc } = vpcStack;

    const ecsStack = new AppFargateCluster(this, 'AppFargateCluster', {
      vpc,
    });
    const { applicationListener } = ecsStack;

    const apigwLambdaStack = new AppApiGatewayLambda(this, 'AppApiGatewayLambda', {
      vpc,
      applicationListener,
    });
  }
}
