import * as cdk from '@aws-cdk/core';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as appmesh from '@aws-cdk/aws-appmesh';
import { DnsRecordType } from '@aws-cdk/aws-servicediscovery';

export interface EcsFargateAppMeshServiceProps {
  cluster: ecs.Cluster;
  mesh: appmesh.Mesh;
  securityGroup: ec2.SecurityGroup;
  appContainerOptions: ecs.ContainerDefinitionOptions;
  appPortNumber: number;
}

export class EcsFargateAppMeshService extends cdk.Construct {
  public fargateService: ecs.FargateService;
  public appPortNumber: number;
  public serviceName: string;
  public virtualNode: appmesh.VirtualNode;
  public virtualService: appmesh.VirtualService;

  constructor(scope: cdk.Construct, id: string, props: EcsFargateAppMeshServiceProps) {
    super(scope, id);

    const { cluster, mesh, appPortNumber } = props;

    this.appPortNumber = appPortNumber;
    const serviceName = id;
    this.serviceName = serviceName;

    const appService = this.createFargateService(serviceName, props);
    const serviceDiscovery = this.getServiceDiscovery(appService);

    this.createVirtualNodes(serviceName, mesh, serviceDiscovery);
    this.createVirtualRouter();
    this.addRoutesToVirtualRouter();
    this.createVirtualService();

    // Create virtual service to make the virtual node accessible
    this.virtualService = new appmesh.VirtualService(this, `${serviceName}-virtual-service`, {
      virtualServiceProvider: appmesh.VirtualServiceProvider.virtualNode(this.virtualNode),
      virtualServiceName: `${serviceName}.${cluster.defaultCloudMapNamespace?.namespaceName}`,
    });
  }

  // Connect this mesh enabled service to another mesh enabled service.
  // This adjusts the security groups for both services so that they
  // can talk to each other. Also adjusts the virtual node for this service
  // so that its Envoy intercepts traffic that can be handled by the other
  // service's virtual service.
  public addBackend(backendService: EcsFargateAppMeshService) {
    const trafficPort = new ec2.Port({
      stringRepresentation: 'port',
      protocol: ec2.Protocol.TCP,
      fromPort: backendService.appPortNumber,
      toPort: backendService.appPortNumber,
    });

    // Adjust security group to allow traffic from this app mesh enabled service to the other app mesh enabled service.
    this.fargateService.connections.allowTo(
      backendService.fargateService,
      trafficPort,
      `Inbound traffic from the app mesh enabled ${this.serviceName}`,
    );

    // Adjust this app mesh service's virtual node to add a backend - that is the other service's virtual service
    // Backend allow this service to communicate to other service
    this.virtualNode.addBackend(appmesh.Backend.virtualService(backendService.virtualService));
  }

  private createFargateService(serviceName: string, props: EcsFargateAppMeshServiceProps) {
    const { securityGroup, cluster } = props;
    const taskDefinition = this.createFargateTaskDef(serviceName, props);

    // Running this in public subnet because if it is Private (by default), when it pulls docker image to build, it needs to go thru the NAT Gateway
    // NAT Gateway is expensive, so I make it public subnet so it can skip the NAT Gateway and just pull from normal Internet gatway
    this.fargateService = new ecs.FargateService(this, `${serviceName}-service`, {
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
        name: serviceName,
      },
    });

    return this.fargateService;
  }

  private createFargateTaskDef(
    serviceName: string,
    props: EcsFargateAppMeshServiceProps,
  ): ecs.FargateTaskDefinition {
    const { appContainerOptions, appPortNumber, mesh } = props;

    const taskDefinition = new ecs.FargateTaskDefinition(this, `${serviceName}-task-definition`, {
      proxyConfiguration: new ecs.AppMeshProxyConfiguration({
        containerName: 'envoy',
        properties: {
          appPorts: [appPortNumber],
          proxyEgressPort: 15001,
          proxyIngressPort: 15000,
          ignoredUID: 1337,
        },
      }),
    });

    const appContainer = taskDefinition.addContainer('app', appContainerOptions);
    appContainer.addPortMappings({
      containerPort: appPortNumber,
      hostPort: appPortNumber,
    });

    taskDefinition.addContainer('envoy', {
      image: ecs.ContainerImage.fromRegistry('public.ecr.aws/appmesh/aws-appmesh-envoy:v1.16.1.1-prod'),
      essential: true,
      environment: {
        APPMESH_VIRTUAL_NODE_NAME: `mesh/${mesh.meshName}/virtualNode/${serviceName}`,
        AWS_REGION: cdk.Stack.of(this).region,
      },
      memoryLimitMiB: 128,
      user: '1337',
      logging: new ecs.AwsLogDriver({
        streamPrefix: `${serviceName}-envoy`,
      }),
    });

    return taskDefinition;
  }

  private getServiceDiscovery(appService: ecs.FargateService): appmesh.ServiceDiscovery {
    if (!appService.cloudMapService) {
      throw new Error('Missing CloudMap Service Discovery');
    }
    return appmesh.ServiceDiscovery.cloudMap({ service: appService.cloudMapService });
  }

  private createVirtualNodes(
    serviceName: string,
    mesh: appmesh.IMesh,
    serviceDiscovery: appmesh.ServiceDiscovery,
  ) {
    // TODO: Pass in backend as params to props, ie: virtualNodeBackend: appmesh.VirtualService[]
    // Also pass in virtual nodes as array, with the backend as props.
    // Should loop thru array and create fargate service along side it.(one FargateService map to one VirtualNode)

    this.virtualNode = new appmesh.VirtualNode(this, `${serviceName}-virtual-node`, {
      mesh,
      virtualNodeName: serviceName,
      serviceDiscovery,
      listeners: [appmesh.VirtualNodeListener.http({ port: 3000 })],
    });
  }

  private createVirtualRouter() {}

  private addRoutesToVirtualRouter() {}

  private createVirtualService() {}
}
