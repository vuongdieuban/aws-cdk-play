#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { LambdaHandlerStack } from '../lib/lambda-handler-stack';

const app = new cdk.App();
new LambdaHandlerStack(app, 'LambdaHandlerStack');
