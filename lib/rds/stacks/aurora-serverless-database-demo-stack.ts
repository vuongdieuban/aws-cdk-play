import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { AppVpc } from '../../shared-resources/app-vpc';
import { RdsAuroraWithTunneling } from '../constructs/rds-aurora-with-tunneling';

export class AuroraServerlessDatabaseDemoStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const { vpc } = new AppVpc(this, 'AppVpc');

    const rdsAuroraStack = new RdsAuroraWithTunneling(this, 'RdsAuroraWithTunneling', {
      vpc,
    });
  }
}
