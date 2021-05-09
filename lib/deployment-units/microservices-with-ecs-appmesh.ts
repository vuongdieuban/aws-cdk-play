import { App, Stack, StackProps } from '@aws-cdk/core';
import { ApiGatewayLambdaStack } from '../stacks/apigw-lambda-stack';
import { EcsFargateAppMeshStack } from '../stacks/ecs-fargate-appmesh-stack';
import { VpcStack } from '../stacks/vpc-stack';

export class MicroServicesWithEcsAndAppMesh extends Stack {
  constructor(scope: App, id: string, props: StackProps) {
    super(scope, id, props);

    const { env } = props;

    const vpcStack = new VpcStack(scope, 'VpcStack', {
      env,
    });
    const { vpc } = vpcStack;

    const ecsStack = new EcsFargateAppMeshStack(scope, 'EcsFargateAppMeshStack', {
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
