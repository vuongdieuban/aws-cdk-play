import { App, Stack, StackProps } from '@aws-cdk/core';
import { ApiGatewayLambdaStack } from '../stacks/apigw-lambda-stack';
import { EcsFargateStack } from '../stacks/ecs-fargate-stack';
import { VpcStack } from '../stacks/vpc-stack';

export class MicroServicesWithEcsFargate extends Stack {
  constructor(scope: App, id: string, props: StackProps) {
    super(scope, id, props);

    const { env } = props;

    const vpcStack = new VpcStack(scope, 'VpcStack', {
      env,
    });
    const { vpc } = vpcStack;

    const ecsStack = new EcsFargateStack(scope, 'EcsFargateStack', {
      vpc,
      env,
    });
    const { applicationListener } = ecsStack;

    const apigwLambdaStack = new ApiGatewayLambdaStack(scope, 'ApiGatewayLambdaStack', {
      vpc,
      applicationListener,
      env,
    });
  }
}
