import { App, Stack, StackProps } from '@aws-cdk/core';
import { AssetImage, Cluster as EcsCluster, FargateTaskDefinition } from '@aws-cdk/aws-ecs';
import { ApplicationLoadBalancedFargateService } from '@aws-cdk/aws-ecs-patterns';

export class EcsFargateStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    const cluster = new EcsCluster(this, 'EcsCluster');

    const taskDefinition = new FargateTaskDefinition(this, 'FargateTaskDef', {
      cpu: 256,
      memoryLimitMiB: 512,
    });

    // If pull from upstream dockerhub or ecr, use ContainerImage.fromRegistry
    const dockerImage = new AssetImage(__dirname + '/../applications/nodejs-app');
    const container = taskDefinition.addContainer('WebServer', { image: dockerImage });
    container.addPortMappings({ containerPort: 3000 });

    // Takes a very long time to deploy  because it has to create and boot up the vpc, if vpc exist might low down the time
    // Since we didn't specify the vpc, it always create one for us.
    const fargateService = new ApplicationLoadBalancedFargateService(this, 'EcsFargateService', {
      cluster,
      taskDefinition,
      desiredCount: 2,
      publicLoadBalancer: true,
    });
  }
}
