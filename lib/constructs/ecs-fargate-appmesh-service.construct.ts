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
  public service: ecs.FargateService;
  public portNumber: number;
  public serviceName: string;
  public taskDefinition: ecs.Ec2TaskDefinition;
  public applicationContainer: ecs.ContainerDefinition;
  public virtualNode: appmesh.VirtualNode;
  public virtualService: appmesh.VirtualService;
  public securityGroup: ec2.SecurityGroup;

  constructor(scope: cdk.Construct, id: string, props: EcsFargateAppMeshServiceProps) {
    super(scope, id);

    const cluster = props.cluster;
    const mesh = props.mesh;
    const appContainerOptions = props.appContainerOptions;

    this.securityGroup = props.securityGroup;
    this.serviceName = id;
    this.portNumber = props.appPortNumber;

    this.taskDefinition = new ecs.FargateTaskDefinition(this, `${this.serviceName}-task-definition`, {
      proxyConfiguration: new ecs.AppMeshProxyConfiguration({
        containerName: 'envoy',
        properties: {
          appPorts: [this.portNumber],
          proxyEgressPort: 15001,
          proxyIngressPort: 15000,
          ignoredUID: 1337,
        },
      }),
    });

    this.applicationContainer = this.taskDefinition.addContainer('app', appContainerOptions);
    this.applicationContainer.addPortMappings({
      containerPort: this.portNumber,
      hostPort: this.portNumber,
    });

    this.taskDefinition.addContainer('envoy', {
      // name: 'envoy',
      image: ecs.ContainerImage.fromRegistry('public.ecr.aws/appmesh/aws-appmesh-envoy:v1.16.1.1-prod'),
      essential: true,
      environment: {
        APPMESH_VIRTUAL_NODE_NAME: `mesh/${mesh.meshName}/virtualNode/${this.serviceName}`,
        AWS_REGION: cdk.Stack.of(this).region,
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -s http://localhost:9901/server_info | grep state | grep -q LIVE'],
        startPeriod: cdk.Duration.seconds(10),
        interval: cdk.Duration.days(1),
        timeout: cdk.Duration.seconds(2),
        retries: 3,
      },
      memoryLimitMiB: 128,
      cpu: 128,
      user: '1337',
      logging: new ecs.AwsLogDriver({
        streamPrefix: `${this.serviceName}-envoy`,
      }),
    });

    this.service = new ecs.FargateService(this, `${this.serviceName}-service`, {
      cluster: cluster,
      desiredCount: 2,
      taskDefinition: this.taskDefinition,
      securityGroup: this.securityGroup,
      cloudMapOptions: {
        dnsRecordType: DnsRecordType.A,
        dnsTtl: cdk.Duration.seconds(10),
        failureThreshold: 2,
        name: this.serviceName,
      },
    });

    const serviceDiscovery = this.service.cloudMapService
      ? appmesh.ServiceDiscovery.cloudMap({ service: this.service.cloudMapService })
      : undefined;

    // Create a virtual node for the name service
    this.virtualNode = new appmesh.VirtualNode(this, `${this.serviceName}-virtual-node`, {
      mesh,
      virtualNodeName: this.serviceName,
      serviceDiscovery,
      listeners: [appmesh.VirtualNodeListener.http({ port: 3000 })],
    });

    // Create virtual service to make the virtual node accessible
    this.virtualService = new appmesh.VirtualService(this, `${this.serviceName}-virtual-service`, {
      virtualServiceProvider: appmesh.VirtualServiceProvider.virtualNode(this.virtualNode),
      virtualServiceName: `${this.serviceName}.${cluster.defaultCloudMapNamespace?.namespaceName}`,
    });
  }

  // Connect this mesh enabled service to another mesh enabled service.
  // This adjusts the security groups for both services so that they
  // can talk to each other. Also adjusts the virtual node for this service
  // so that its Envoy intercepts traffic that can be handled by the other
  // service's virtual service.
  public connectToMeshService(appMeshService: EcsFargateAppMeshService) {
    const trafficPort = new ec2.Port({
      stringRepresentation: 'port',
      protocol: ec2.Protocol.TCP,
      fromPort: appMeshService.portNumber,
      toPort: appMeshService.portNumber,
    });

    // Adjust security group to allow traffic from this app mesh enabled service
    // to the other app mesh enabled service.
    this.service.connections.allowTo(
      appMeshService.service,
      trafficPort,
      `Inbound traffic from the app mesh enabled ${this.serviceName}`,
    );

    // Adjust this app mesh service's virtual node to add a backend - that is the other service's virtual service
    // Backend allow this service to communicate to other service
    this.virtualNode.addBackend(appmesh.Backend.virtualService(appMeshService.virtualService));
  }
}
