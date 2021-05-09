import { App, Stack, StackProps } from '@aws-cdk/core';
import { RdsAuroraStack } from '../stacks/rds-aurora-stack';
import { VpcStack } from '../stacks/vpc-stack';

export class AuroraServerlessDatabaseDemo extends Stack {
  constructor(scope: App, id: string, props: StackProps) {
    super(scope, id, props);

    const { env } = props;

    const { vpc } = new VpcStack(scope, 'VpcStack', {
      env,
    });

    const rdsAuroraStack = new RdsAuroraStack(scope, 'RdsAuroraStack', {
      vpc,
      env,
    });
  }
}
