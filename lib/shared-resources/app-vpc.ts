import { Vpc, SubnetType } from '@aws-cdk/aws-ec2';
import { Construct } from '@aws-cdk/core';

export class AppVpc extends Construct {
  public vpc: Vpc;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Default Max Availability zone is 3, default to 1 NAT Gateway per Az
    // NAT gateway is charged even if it is not used - expensive
    this.vpc = new Vpc(this, 'AppVpc', {
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
