#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { Environment } from '@aws-cdk/core';
import { AwsRegion } from '../lib/constants/aws-region.enum';
import { AuroraServerlessDatabaseDemo } from '../lib/deployment-units/aurora-serverless-database-demo';
import { ImportExistedResourcesDemo } from '../lib/deployment-units/import-existed-resources-demo';
import { MicroServicesWithEcsFargate } from '../lib/deployment-units/microservices-with-ecs';
import { MicroServicesWithEcsAndAppMesh } from '../lib/deployment-units/microservices-with-ecs-appmesh';
import { VpcWithEcsClusterStack } from '../lib/stacks/vpc-with-ecs-cluster-stack';

// NOTE: to deploy all and no approval prompt - cdk deploy --require-approval never --all (useful to pipeline)

const app = new cdk.App();

const env: Environment = {
  region: process.env.CDK_DEFAULT_REGION || AwsRegion.CA_CENTRAL_1,
  account: process.env.CDK_DEFAULT_ACCOUNT,
};

new VpcWithEcsClusterStack(app, 'VpcWithEcsClusterStack', { env });
new ImportExistedResourcesDemo(app, 'ImportExistedResourcesDemo', { env });

// new MicroServicesWithEcsAndAppMesh(app, 'MicroServicesWithEcsAndAppMesh', { env });
// new MicroServicesWithEcsFargate(app, 'MicroServicesWithEcsFargate', { env });
// new AuroraServerlessDatabaseDemo(app, 'AuroraServerlessDatabaseDemo', { env });
