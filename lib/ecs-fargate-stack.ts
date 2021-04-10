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
    const dockerImage = new AssetImage(__dirname + '/../applications/nodejs-apps/color-v1');
    const container = taskDefinition.addContainer('WebServer', { image: dockerImage });
    container.addPortMappings({ containerPort: 3000 });

    // Takes a very long time to deploy  because it has to create and boot up the vpc, if vpc exist might low down the time
    // Since we didn't specify the vpc, it always create one for us.
    // We can pass VPC as variable, or use ARN look up for existed one (ARN = Amazon resource number, uniquely identify a resource)
    // Becareful with ARN because if we destroy it or ARN changes, this code would break because of non-existed resources
    const fargateService = new ApplicationLoadBalancedFargateService(this, 'EcsFargateService', {
      cluster,
      taskDefinition,
      desiredCount: 1,
      publicLoadBalancer: true,
    });
  }
}
