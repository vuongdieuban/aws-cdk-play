import { App, Stack, StackProps } from '@aws-cdk/core';
import { AppApiGatewayLambda } from '../stacks/app-apigw-lambda';
import { EcsFargateStack } from '../stacks/ecs-fargate-stack';
import { AppVpc } from '../stacks/vpc-stack';

export class MicroServicesWithEcsFargate extends Stack {
  constructor(scope: App, id: string, props: StackProps) {
    super(scope, id, props);

    const { env } = props;

    const vpcStack = new AppVpc(this, 'AppVpc');
    const { vpc } = vpcStack;

    const ecsStack = new EcsFargateStack(this, 'EcsFargateStack', {
      vpc,
    });
    const { applicationListener } = ecsStack;

    const apigwLambdaStack = new AppApiGatewayLambda(this, 'AppApiGatewayLambda', {
      vpc,
      applicationListener,
    });
  }
}
