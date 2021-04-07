import * as cdk from '@aws-cdk/core';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as appmesh from '@aws-cdk/aws-appmesh';
import { DnsRecordType } from '@aws-cdk/aws-servicediscovery';
import { PolicyStatement } from '@aws-cdk/aws-iam';

interface FargateServiceDefinition {
  name: string; // name will be used to register with service discovery
  port: number;
  securityGroup: ec2.SecurityGroup;
  containerOptions: ecs.ContainerDefinitionOptions;
}

export interface EcsFargateAppMeshServiceProps {
  cluster: ecs.Cluster;
  mesh: appmesh.Mesh;
  fargateServices: FargateServiceDefinition[];
}

export class EcsFargateAppMeshService extends cdk.Construct {
  public fargateServices: ecs.FargateService[] = [];
  public virtualNodes: appmesh.VirtualNode[];
  public virtualService: appmesh.VirtualService;

  constructor(scope: cdk.Construct, id: string, props: EcsFargateAppMeshServiceProps) {
    super(scope, id);
    const { cluster, mesh, fargateServices } = props;
    const serviceName = id;
    const cloudmapNameSpace = cluster.defaultCloudMapNamespace?.namespaceName;
    if (!cloudmapNameSpace) {
      throw new Error('No CloudMapNameSpace');
    }

    this.virtualNodes = fargateServices.map(serviceDefinition => {
      const { name, port } = serviceDefinition;
      const appService = this.createFargateService(cluster, mesh, serviceDefinition);
      const serviceDiscovery = this.getServiceDiscovery(appService);
      this.fargateServices.push(appService);
      return this.createVirtualNode(name, port, mesh, serviceDiscovery);
    });

    const virtualRouter = this.createVirtualRouterAndAddRoutes(mesh, this.virtualNodes);
    this.virtualService = this.createVirtualService(cloudmapNameSpace, serviceName, virtualRouter);
  }

  public addBackend(backendService: EcsFargateAppMeshService) {
    this.virtualNodes.forEach(node => {
      node.addBackend(appmesh.Backend.virtualService(backendService.virtualService));
    });
  }

  private createFargateService(
    cluster: ecs.Cluster,
    mesh: appmesh.Mesh,
    serviceDefinition: FargateServiceDefinition,
  ) {
    const { name, securityGroup } = serviceDefinition;
    const taskDefinition = this.createFargateTaskDef(mesh, serviceDefinition);

    // Running this in public subnet because if it is Private (by default), when it pulls docker image to build, it needs to go thru the NAT Gateway
    // NAT Gateway is expensive, so I make it public subnet so it can skip the NAT Gateway and just pull from normal Internet gatway
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

  private createFargateTaskDef(
    mesh: appmesh.Mesh,
    serviceDefinition: FargateServiceDefinition,
  ): ecs.FargateTaskDefinition {
    const { name, port, containerOptions } = serviceDefinition;

    const taskDefinition = new ecs.FargateTaskDefinition(this, `${name}-task-definition`, {
      proxyConfiguration: new ecs.AppMeshProxyConfiguration({
        containerName: 'envoy',
        properties: {
          appPorts: [port],
          proxyEgressPort: 15001,
          proxyIngressPort: 15000,
          ignoredUID: 1337,
        },
      }),
    });

    const appContainer = taskDefinition.addContainer('app', containerOptions);
    appContainer.addPortMappings({
      containerPort: port,
      hostPort: port,
    });

    taskDefinition.addContainer('envoy', {
      image: ecs.ContainerImage.fromRegistry('public.ecr.aws/appmesh/aws-appmesh-envoy:v1.16.1.1-prod'),
      essential: true,
      environment: {
        // https://docs.aws.amazon.com/app-mesh/latest/userguide/envoy-config.html
        // APPMESH_VIRTUAL_NODE_NAME - deprecated, see if it can remove
        APPMESH_VIRTUAL_NODE_NAME: `mesh/${mesh.meshName}/virtualNode/${name}`,
        AWS_REGION: cdk.Stack.of(this).region,
        ENABLE_ENVOY_XRAY_TRACING: '1',
      },
      memoryLimitMiB: 128,
      user: '1337',
      logging: new ecs.AwsLogDriver({
        streamPrefix: `${name}-envoy`,
      }),
    });

    const xrayContainer = taskDefinition.addContainer('xray', {
      image: ecs.ContainerImage.fromRegistry('amazon/aws-xray-daemon'),
      user: '1337',
      memoryLimitMiB: 128,
      essential: true,
      logging: new ecs.AwsLogDriver({
        streamPrefix: `${name}-xray`,
      }),
    });
    xrayContainer.addPortMappings({
      containerPort: 2000,
      hostPort: 2000,
      protocol: ecs.Protocol.UDP,
    });

    taskDefinition.taskRole.addToPrincipalPolicy(
      new PolicyStatement({
        resources: ['*'],
        actions: [
          'logs:*', // full access to cloudwatch logs
          'xray:*', // full access xray
          'appmesh:*', // full access appmesh
        ],
      }),
    );

    return taskDefinition;
  }

  private getServiceDiscovery(appService: ecs.FargateService): appmesh.ServiceDiscovery {
    if (!appService.cloudMapService) {
      throw new Error('Missing CloudMap Service Discovery');
    }
    return appmesh.ServiceDiscovery.cloudMap({ service: appService.cloudMapService });
  }

  private createVirtualNode(
    name: string,
    appPort: number,
    mesh: appmesh.IMesh,
    serviceDiscovery: appmesh.ServiceDiscovery,
  ) {
    return new appmesh.VirtualNode(this, `${name}-virtual-node`, {
      mesh,
      virtualNodeName: name,
      serviceDiscovery,
      listeners: [appmesh.VirtualNodeListener.http({ port: appPort })],
    });
  }

  private createVirtualRouterAndAddRoutes(
    mesh: appmesh.Mesh,
    virtualNodes: appmesh.VirtualNode[],
  ): appmesh.VirtualRouter {
    const router = new appmesh.VirtualRouter(this, 'router', {
      mesh,
      listeners: [appmesh.VirtualRouterListener.http(3000)],
    });

    const avgWeight = 100 / virtualNodes.length;
    const weightedTargets = virtualNodes.map(node => ({
      virtualNode: node,
      weight: avgWeight,
    }));

    router.addRoute('route-http', {
      routeSpec: appmesh.RouteSpec.http({
        weightedTargets,
        match: {
          prefixPath: '/',
        },
      }),
    });

    return router;
  }

  private createVirtualService(
    cloudmapNameSpace: string,
    serviceName: string,
    virtualRouter: appmesh.VirtualRouter,
  ): appmesh.VirtualService {
    return new appmesh.VirtualService(this, `${serviceName}-virtual-service`, {
      virtualServiceProvider: appmesh.VirtualServiceProvider.virtualRouter(virtualRouter),
      virtualServiceName: `${serviceName}.${cloudmapNameSpace}`,
    });
  }
}
