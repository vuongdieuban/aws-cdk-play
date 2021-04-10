#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { EcsFargateStack } from '../lib/ecs-fargate-stack';
import { LambdaHandlerStack } from '../lib/lambda-handler-stack';
import { PersonalColorStack } from '../lib/ecs-app-mesh-stack';

// To deploy stack together, put stage into Stage (Stage construct aws cdk)
// Stage could be Staging, Production,....
// each stage can consist of different stack.
const app = new cdk.App();
new LambdaHandlerStack(app, 'LambdaHandlerStack');
new EcsFargateStack(app, 'EcsFargateStack');
new PersonalColorStack(app, 'PersonalColorStack');
