#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { AwsCloudformationDemoStack } from '../lib/aws-cloudformation-demo-stack';

const app = new cdk.App();
new AwsCloudformationDemoStack(app, 'AwsCloudformationDemoStack');
