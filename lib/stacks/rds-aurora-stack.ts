import { App, CfnOutput, SecretValue, Stack, StackProps } from '@aws-cdk/core';
import { InstanceClass, InstanceSize, InstanceType, Port, SubnetType, Vpc } from '@aws-cdk/aws-ec2';
import {
  DatabaseCluster,
  DatabaseClusterEngine,
  AuroraPostgresEngineVersion,
  Credentials,
} from '@aws-cdk/aws-rds';

export interface RdsAuroraStackProps extends StackProps {
  vpc: Vpc;
}

export class RdsAuroraStack extends Stack {
  constructor(scope: App, id: string, props: RdsAuroraStackProps) {
    super(scope, id, props);
    const { vpc } = props;

    // just for testing, use Secret Manger for password in prod
    const password = SecretValue.plainText('postgres');

    const cluster = new DatabaseCluster(this, 'Database', {
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_12_4,
      }),
      credentials: Credentials.fromPassword('postgres', password),
      instanceProps: {
        instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MEDIUM),
        vpcSubnets: {
          subnetType: SubnetType.PUBLIC,
        },
        publiclyAccessible: true,
        vpc,
      },
    });

    cluster.connections.allowFromAnyIpv4(Port.allTcp(), 'Open to the world');

    const writeAddress = cluster.clusterEndpoint.socketAddress; // "HOSTNAME:PORT"

    new CfnOutput(this, 'DatabaseHostPort', {
      exportName: 'DatabaseHostPort',
      value: writeAddress,
    });
  }
}
