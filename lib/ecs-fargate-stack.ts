import { App, Stack, StackProps } from '@aws-cdk/core';
import { Cluster as EcsCluster } from '@aws-cdk/aws-ecs';
import { ApplicationLoadBalancedFargateService } from '@aws-cdk/aws-ecs-patterns';

export class EcsFargateStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);
  }
}
