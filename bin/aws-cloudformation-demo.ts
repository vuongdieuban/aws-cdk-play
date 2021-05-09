#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { Environment } from '@aws-cdk/core';
import { AwsRegion } from '../lib/constants/aws-region.enum';
import { MicroServicesWithEcsFargateStack } from '../lib/microservices/stacks/microservices-with-ecs-stack';
import { MicroServicesWithEcsAndAppMeshStack } from '../lib/microservices/stacks/microservices-with-ecs-appmesh-stack';
import { AuroraServerlessDatabaseDemoStack } from '../lib/rds/stacks/aurora-serverless-database-demo-stack';
import { SsmCreateParamsStack } from '../lib/system-manager/stacks/ssm-create-params-stack';
import { SsmImportParamsStack } from '../lib/system-manager/stacks/ssm-import-params-stack';

// NOTE: to deploy all and no approval prompt - cdk deploy --require-approval never --all (useful to pipeline)

const app = new cdk.App();

const env: Environment = {
  region: process.env.CDK_DEFAULT_REGION || AwsRegion.CA_CENTRAL_1,
  account: process.env.CDK_DEFAULT_ACCOUNT,
};

/* NOTE for Ssm: 
  For this to work, SsmCreateParams stack has to be deployed first and completed.
  Otherwise, it will complain that we are reference non existed Vpc and Cluster in SsmImportParamsStack.
  Vpc and Cluster is created in SsmCreateParams Stack

  cdk deploy "SsmCreateParamsStack"
  wait for that to be done then
  cdk deploy "SsmImportParamsStack"
*/
// new SsmCreateParamsStack(app, 'SsmCreateParamsStack', { env });
// new SsmImportParamsStack(app, 'SsmImportParamsStack', { env });

//----------------------------------------------------------------------------------------------
new MicroServicesWithEcsAndAppMeshStack(app, 'MicroServicesWithEcsAndAppMeshStack', { env });

// new MicroServicesWithEcsFargateStack(app, 'MicroServicesWithEcsFargateStack', { env });

// new AuroraServerlessDatabaseDemoStack(app, 'AuroraServerlessDatabaseDemoStack', { env });
