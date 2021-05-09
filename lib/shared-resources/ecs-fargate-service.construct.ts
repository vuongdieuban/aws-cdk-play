import * as cdk from '@aws-cdk/core';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ec2 from '@aws-cdk/aws-ec2';
import { DnsRecordType } from '@aws-cdk/aws-servicediscovery';
import { PolicyStatement } from '@aws-cdk/aws-iam';

export interface EcsFargateServiceProps {
  cluster: ecs.Cluster;
  name: string; // name will be used to register with service discovery
  port: number;
  securityGroup: ec2.SecurityGroup;
  containerOptions: ecs.ContainerDefinitionOptions;
}

export class EcsFargateService extends cdk.Construct {
  public fargateService: ecs.FargateService;

  constructor(scope: cdk.Construct, id: string, props: EcsFargateServiceProps) {
    super(scope, id);
    const { cluster } = props;
    const cloudmapNameSpace = cluster.defaultCloudMapNamespace?.namespaceName;
    if (!cloudmapNameSpace) {
      throw new Error('CloudMapNameSpace is required');
    }

    this.fargateService = this.createFargateService(props);
  }

  private createFargateService(serviceProps: EcsFargateServiceProps) {
    const { cluster, name, securityGroup } = serviceProps;
    const taskDefinition = this.createFargateTaskDef(serviceProps);

    return new ecs.FargateService(this, `${name}-service`, {
      cluster,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC, // default is Private
      },
      assignPublicIp: true, // remove if SubnetType is Private
      desiredCount: 1, // number of task that keep running
      taskDefinition,
      securityGroup,
      cloudMapOptions: {
        dnsRecordType: DnsRecordType.A,
        dnsTtl: cdk.Duration.seconds(10),
        failureThreshold: 2,
        name,
      },
    });
  }

  private createFargateTaskDef(serviceProps: EcsFargateServiceProps): ecs.FargateTaskDefinition {
    const { name, port, containerOptions } = serviceProps;

    const taskDefinition = new ecs.FargateTaskDefinition(this, `${name}-task-definition`);

    const appContainer = taskDefinition.addContainer('app', containerOptions);
    appContainer.addPortMappings({
      containerPort: port,
      hostPort: port,
    });

    taskDefinition.taskRole.addToPrincipalPolicy(
      new PolicyStatement({
        resources: ['*'],
        actions: [
          'logs:*', // full access to cloudwatch logs
        ],
      }),
    );

    return taskDefinition;
  }
}
