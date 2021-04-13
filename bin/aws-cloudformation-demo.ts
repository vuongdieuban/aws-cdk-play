#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { ApiGatewayLambdaStack } from '../lib/apigw-lambda-stack';

import { EcsFargateStack } from '../lib/ecs-fargate-stack';
import { VpcStack } from '../lib/vpc-stack';

// NOTE: to deploy all and no approval prompt - cdk deploy --require-approval never --all (useful to pipeline)

// To deploy stack together, put stage into Stage (Stage construct aws cdk)
// Stage could be Staging, Production,....
// each stage can consist of different stacks.
const app = new cdk.App();

const vpcStack = new VpcStack(app, 'VpcStack');
const { vpc } = vpcStack;

const ecsStack = new EcsFargateStack(app, 'EcsFargateStack', { vpc });
const { applicationListener } = ecsStack;

const apigwLambdaStack = new ApiGatewayLambdaStack(app, 'ApiGatewayLambdaStack', {
  vpc,
  applicationListener,
});
