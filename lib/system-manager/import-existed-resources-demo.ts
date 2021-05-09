import { Vpc } from '@aws-cdk/aws-ec2';
import { Cluster, ContainerImage, FargateTaskDefinition, TaskDefinition } from '@aws-cdk/aws-ecs';
import { ApplicationLoadBalancedFargateService } from '@aws-cdk/aws-ecs-patterns';
import { App, CfnOutput, Stack, StackProps } from '@aws-cdk/core';

export class ImportExistedResourcesDemo extends Stack {
  constructor(scope: App, id: string, props: StackProps) {
    super(scope, id, props);

    const vpc = Vpc.fromLookup(this, 'ExistedVpc', {
      vpcId: 'vpc-0726eaf1d6412e534',
    });

    // Import cluster without passing it as parameter.
    const cluster = Cluster.fromClusterAttributes(this, 'ExistedCluster', {
      clusterName: 'DemoCluster',
      securityGroups: [],
      vpc,
    });

    const taskDefinition = new FargateTaskDefinition(this, `app-task-definition`);

    const appContainer = taskDefinition.addContainer('app', {
      image: ContainerImage.fromRegistry('banvuong/name:demo'),
      environment: {
        PORT: '3000',
      },
    });
    appContainer.addPortMappings({
      containerPort: 3000,
      hostPort: 3000,
    });

    const app = new ApplicationLoadBalancedFargateService(this, 'MyApp', {
      taskDefinition,
      cluster,
    });
  }
}
