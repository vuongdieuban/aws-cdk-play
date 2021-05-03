import { App, CfnOutput, SecretValue, Stack, StackProps } from '@aws-cdk/core';
import {
  AmazonLinuxGeneration,
  Instance,
  InstanceClass,
  InstanceSize,
  InstanceType,
  MachineImage,
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
  Vpc,
} from '@aws-cdk/aws-ec2';
import {
  DatabaseClusterEngine,
  AuroraPostgresEngineVersion,
  Credentials,
  ServerlessCluster,
} from '@aws-cdk/aws-rds';

export interface RdsAuroraStackProps extends StackProps {
  vpc: Vpc;
}

// NOTE: To connect to serverless aurora db, use port forwarding/ssh tunneling
// ssh -i /paths/<key-file>.pem ec2-user@<EC2-PublicIp> -L 5432:<DB-Cluster-Uri>:5432
// Access to localhost:5432 in Dbeaver or typeorm will directly connect to the aurora serverless db
// Refer to setupEc2Host() function to see comment about the key pair file

export class RdsAuroraStack extends Stack {
  constructor(scope: App, id: string, props: RdsAuroraStackProps) {
    super(scope, id, props);
    const { vpc } = props;
    this.setupEc2Host(vpc);
    this.setupServerlessDbCluster(vpc);
  }

  private setupEc2Host(vpc: Vpc) {
    const securityGroup = new SecurityGroup(this, 'simple-instance-sg', {
      vpc,
      allowAllOutbound: true,
      securityGroupName: 'simple-instance-sg',
    });

    securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(22), 'Allows SSH access from Internet');

    const instance = new Instance(this, 'simple-instance', {
      vpc,
      securityGroup,
      instanceName: 'simple-instance',
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      machineImage: MachineImage.latestAmazonLinux({
        generation: AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC,
      },

      // NOTE: Create this in the console (EC2 key pair) with the same keyName (simple-instance-key) before we deploy,
      // After download the pem file, run "sudo chmod 600 /path/to/my/key.pem"
      // To SSH: ssh -i /path/simple-instance-key.pem ec2-user@<EC2-Ip>
      keyName: 'simple-instance-key',
    });

    new CfnOutput(this, 'simple-instance-output', {
      exportName: 'simple-instance-publicIp',
      value: instance.instancePublicIp,
    });
  }

  private setupServerlessDbCluster(vpc: Vpc) {
    // just for testing, use Secret Manger for password in prod
    const password = SecretValue.plainText('postgres');

    const cluster = new ServerlessCluster(this, 'Database', {
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_10_12,
      }),
      credentials: Credentials.fromPassword('postgres', password),
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC,
      },
      vpc,
    });

    cluster.connections.allowFromAnyIpv4(Port.allTcp(), 'Open to the world');

    const writeAddress = cluster.clusterEndpoint.socketAddress; // "HOSTNAME:PORT"

    new CfnOutput(this, 'DatabaseHostPort', {
      exportName: 'DatabaseHostPort',
      value: writeAddress,
    });
  }
}
