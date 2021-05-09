import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { RdsAuroraStack } from '../stacks/rds-aurora-stack';
import { AppVpc } from '../stacks/vpc-stack';

export class AuroraServerlessDatabaseDemo extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const { vpc } = new AppVpc(this, 'AppVpc');

    const rdsAuroraStack = new RdsAuroraStack(this, 'RdsAuroraStack', {
      vpc,
    });
  }
}
