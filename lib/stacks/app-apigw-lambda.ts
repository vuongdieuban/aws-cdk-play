import { HttpAlbIntegration, LambdaProxyIntegration } from '@aws-cdk/aws-apigatewayv2-integrations';
import { Peer, Port, SecurityGroup, SubnetType, Vpc } from '@aws-cdk/aws-ec2';
import { Runtime, Code, Tracing, Function as LambdaFunction } from '@aws-cdk/aws-lambda';
import { CfnOutput, Construct } from '@aws-cdk/core';
import { HttpApi, CorsHttpMethod, HttpMethod } from '@aws-cdk/aws-apigatewayv2';
import { IApplicationListener } from '@aws-cdk/aws-elasticloadbalancingv2';

interface Props {
  vpc: Vpc;
  applicationListener: IApplicationListener;
}

export class AppApiGatewayLambda extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);
    const { vpc, applicationListener } = props;

    const webfacingSecurityGroup = this.createWebFacingSecurityGroup(vpc);

    const personalColorLambda = this.createPersonalColorLambda(vpc, [webfacingSecurityGroup]);

    const lambdaProxyApiGw = this.createLambdaProxyApiGateway(personalColorLambda);

    const httpProxyPrivateApiGw = this.createHttpProxyPrivateApiGateway(applicationListener);
  }

  private createWebFacingSecurityGroup(vpc: Vpc) {
    const lambdaSg = new SecurityGroup(this, 'lambda-sg', {
      securityGroupName: 'lambda-web-access',
      allowAllOutbound: true,
      vpc,
    });

    lambdaSg.addIngressRule(Peer.anyIpv4(), Port.tcp(80), 'http port');
    lambdaSg.addIngressRule(Peer.anyIpv4(), Port.tcp(443), 'https port');

    return lambdaSg;
  }

  private createPersonalColorLambda(vpc: Vpc, securityGroups: SecurityGroup[]) {
    return new LambdaFunction(this, 'personal-color-lambda', {
      runtime: Runtime.NODEJS_14_X,
      code: Code.fromAsset('applications/lambda-handlers/deploy'),
      handler: 'personal-color.personalColorHandler', // personal-color.js file, personalColorHandler function,
      vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE,
      },
      securityGroups: securityGroups,
      tracing: Tracing.ACTIVE, // xray tracing
      environment: {
        PERSONAL_COLOR_URL: 'http://personal-color.internal:3000',
      },
    });
  }

  private createLambdaProxyApiGateway(lambdaHandler: LambdaFunction) {
    const lambdaIntegration = new LambdaProxyIntegration({
      handler: lambdaHandler,
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
      integration: lambdaIntegration,
    });

    new CfnOutput(this, 'LambdaProxyApiGw', {
      exportName: 'lambda-proxy-apigw',
      value: httpApi.url || 'no-url-found',
    });

    return httpApi;
  }

  private createHttpProxyPrivateApiGateway(listener: IApplicationListener) {
    // Use VPC to proxy proxy all request into Private ALB (ALB in VPC)
    const httpApi = new HttpApi(this, 'HttpProxyPrivateApi', {
      defaultIntegration: new HttpAlbIntegration({
        listener,
      }),
    });

    new CfnOutput(this, 'PrivateAlbProxyApiGw', {
      exportName: 'private-alb-proxy-apigw',
      value: httpApi.url || 'no-url-found',
    });

    return httpApi;
  }
}
