import { Vpc, SubnetType } from '@aws-cdk/aws-ec2';
import { App, Stack, StackProps } from '@aws-cdk/core';

export class VpcStack extends Stack {
  public vpc: Vpc;

  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    // Default Max Availability zone is 3, default to 1 NAT Gateway per Az
    // NAT gateway is charged even if it is not used - expensive
    this.vpc = new Vpc(this, 'personal-color-vpc', {
      cidr: '10.0.0.0/16',
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: SubnetType.PRIVATE,
        },
      ],
    });
  }
}
