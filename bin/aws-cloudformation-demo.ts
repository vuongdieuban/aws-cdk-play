#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { ApiGatewayLambdaStack } from '../lib/apigw-lambda-stack';

import { EcsFargateStack } from '../lib/ecs-fargate-stack';
import { VpcStack } from '../lib/vpc-stack';

// To deploy stack together, put stage into Stage (Stage construct aws cdk)
// Stage could be Staging, Production,....
// each stage can consist of different stack.
const app = new cdk.App();

const vpcStack = new VpcStack(app, 'VpcStack');
const { vpc } = vpcStack;

const ecsStack = new EcsFargateStack(app, 'EcsFargateStack', { vpc });
const { applicationListener } = ecsStack;

const apigwLambdaStack = new ApiGatewayLambdaStack(app, 'ApiGatewayLambdaStack', {
  vpc,
  applicationListener,
});
