import { Construct } from '@aws-cdk/core';
import { stackEnv } from '../constants/stack-env';
import { RdsAuroraStack } from '../stacks/rds-aurora-stack';
import { VpcStack } from '../stacks/vpc-stack';

class RdsAuroraDeploy extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);
  }
}
