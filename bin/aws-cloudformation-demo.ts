#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { ApiGatewayLambdaStack } from '../lib/stacks/apigw-lambda-stack';
import { AwsRegion } from '../lib/constants/aws-region.enum';

import { EcsFargateAppMeshStack } from '../lib/stacks/ecs-fargate-appmesh-stack';
import { EcsFargateStack } from '../lib/stacks/ecs-fargate-stack';
import { RdsAuroraStack } from '../lib/stacks/rds-aurora-stack';
import { VpcStack } from '../lib/stacks/vpc-stack';

// NOTE: to deploy all and no approval prompt - cdk deploy --require-approval never --all (useful to pipeline)

// To deploy stack together, put stage into Stage (Stage construct aws cdk)
// Stage could be Staging, Production,....
// each stage can consist of different stacks.

const app = new cdk.App();

const env = {
  region: AwsRegion.CA_CENTRAL_1,
};

const vpcStack = new VpcStack(app, 'VpcStack', {
  env,
});
const { vpc } = vpcStack;

// // With AppMesh
const ecsStack = new EcsFargateAppMeshStack(app, 'EcsFargateAppMeshStack', {
  vpc,
  env,
});

// Without AppMesh
// const ecsStack = new EcsFargateStack(app, 'EcsFargateStack', {
//   vpc,
//   env,
// });
const { applicationListener } = ecsStack;

const apigwLambdaStack = new ApiGatewayLambdaStack(app, 'ApiGatewayLambdaStack', {
  vpc,
  applicationListener,
  env,
});

const rdsAuroraStack = new RdsAuroraStack(app, 'RdsAuroraStack', { vpc, env });
