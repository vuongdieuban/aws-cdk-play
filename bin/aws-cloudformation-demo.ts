#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { AwsRegion } from '../lib/constants/aws-region.enum';
import { AuroraServerlessDatabaseDemo } from '../lib/deployment-units/aurora-serverless-database-demo';
import { MicroServicesWithEcsFargate } from '../lib/deployment-units/microservices-with-ecs';
import { MicroServicesWithEcsAndAppMesh } from '../lib/deployment-units/microservices-with-ecs-appmesh';

// NOTE: to deploy all and no approval prompt - cdk deploy --require-approval never --all (useful to pipeline)

const app = new cdk.App();

const env = {
  region: AwsRegion.CA_CENTRAL_1,
};

new MicroServicesWithEcsAndAppMesh(app, 'MicroServicesWithEcsAndAppMesh', { env });

// new MicroServicesWithEcsFargate(app, 'MicroServicesWithEcsFargate', { env });
// new AuroraServerlessDatabaseDemo(app, 'AuroraServerlessDatabaseDemo', { env });
