import { Stack, StackProps, App, CfnOutput } from '@aws-cdk/core';
import { Function as LambdaFunction, Runtime, Code } from '@aws-cdk/aws-lambda';
import { Peer, Port, SecurityGroup, SubnetType, Vpc } from '@aws-cdk/aws-ec2';
import { LambdaProxyIntegration } from '@aws-cdk/aws-apigatewayv2-integrations';
import { HttpApi, CorsHttpMethod, HttpMethod, HttpStage } from '@aws-cdk/aws-apigatewayv2';
export class LambdaHandlerStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, 'HelloVpc', {
      cidr: '10.0.0.0/16',
      maxAzs: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: SubnetType.PRIVATE,
        },
      ],
    });

    const lambdaSg = new SecurityGroup(this, 'lambda-sg', {
      securityGroupName: 'lambda-web-access',
      allowAllOutbound: true,
      vpc,
    });
    lambdaSg.addIngressRule(Peer.anyIpv4(), Port.tcp(80), 'http port');
    lambdaSg.addIngressRule(Peer.anyIpv4(), Port.tcp(443), 'https port');

    const helloHandler = new LambdaFunction(this, 'HelloHandler', {
      runtime: Runtime.NODEJS_14_X,
      code: Code.fromAsset('applications/lambda-handlers/deploy'),
      handler: 'hello-world.helloHandler', // hello-world.js file, helloHandler function,
      vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE,
      },
      securityGroups: [lambdaSg],
    });

    const helloIntegration = new LambdaProxyIntegration({
      handler: helloHandler,
    });

    const httpApi = new HttpApi(this, 'HttpApi', {
      corsPreflight: {
        allowHeaders: ['*'],
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
        allowOrigins: ['*'],
      },
    });

    httpApi.addRoutes({
      path: '/',
      methods: [HttpMethod.GET],
      integration: helloIntegration,
    });

    new CfnOutput(this, 'RestApi', {
      exportName: 'rest-api-dns',
      value: httpApi.url || 'no-url-found',
    });
  }
}
