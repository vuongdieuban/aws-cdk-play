#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { Environment } from '@aws-cdk/core';
import { AwsRegion } from '../lib/constants/aws-region.enum';
import { MicroServicesWithEcsFargateStack } from '../lib/microservices/stacks/microservices-with-ecs-stack';
import { MicroServicesWithEcsAndAppMeshStack } from '../lib/microservices/stacks/microservices-with-ecs-appmesh-stack';
import { AuroraServerlessDatabaseDemoStack } from '../lib/rds/stacks/aurora-serverless-database-demo-stack';
import { ImportExistedResourcesDemo } from '../lib/system-manager/import-existed-resources-demo';
import { VpcWithEcsClusterStack } from '../lib/system-manager/vpc-with-ecs-cluster-stack';

// NOTE: to deploy all and no approval prompt - cdk deploy --require-approval never --all (useful to pipeline)

const app = new cdk.App();

const env: Environment = {
  region: process.env.CDK_DEFAULT_REGION || AwsRegion.CA_CENTRAL_1,
  account: process.env.CDK_DEFAULT_ACCOUNT,
};

// new VpcWithEcsClusterStack(app, 'VpcWithEcsClusterStack', { env });
// new ImportExistedResourcesDemo(app, 'ImportExistedResourcesDemo', { env });

new MicroServicesWithEcsAndAppMeshStack(app, 'MicroServicesWithEcsAndAppMeshStack', { env });
// new MicroServicesWithEcsFargateStack(app, 'MicroServicesWithEcsFargateStack', { env });
// new AuroraServerlessDatabaseDemoStack(app, 'AuroraServerlessDatabaseDemoStack', { env });
