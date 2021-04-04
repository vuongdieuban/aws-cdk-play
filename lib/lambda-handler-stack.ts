import { Stack, StackProps, App, CfnOutput } from '@aws-cdk/core';
import { Function as LambdaFunction, Runtime, Code } from '@aws-cdk/aws-lambda';
import { Vpc } from '@aws-cdk/aws-ec2';
import { LambdaProxyIntegration } from '@aws-cdk/aws-apigatewayv2-integrations';
import { HttpApi, CorsHttpMethod, HttpMethod } from '@aws-cdk/aws-apigatewayv2';
export class LambdaHandlerStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, 'GreetingVpc', {
      maxAzs: 1,
    });

    const helloHandler = new LambdaFunction(this, 'HelloHandler', {
      runtime: Runtime.NODEJS_14_X,
      code: Code.fromAsset('applications/lambda-handlers/deploy'),
      handler: 'hello-world.helloHandler', // hello-world.js file, helloHandler function,
      vpc,
    });

    // Add additional policy to existing role
    // helloHandler.role?.addToPrincipalPolicy(
    //   new PolicyStatement({
    //     resources: ['*'],
    //     actions: ['servicediscovery:*'],
    //   }),
    // );

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
