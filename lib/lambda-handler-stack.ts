import { Stack, StackProps, App, CfnOutput } from '@aws-cdk/core';
import { Function as LambdaFunction, Runtime, Code } from '@aws-cdk/aws-lambda';
import { LambdaRestApi } from '@aws-cdk/aws-apigateway';
import { SubnetType, Vpc } from '@aws-cdk/aws-ec2';

export class LambdaHandlerStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, 'GreetingVpc', {
      maxAzs: 1,
    });

    const helloHandler = new LambdaFunction(this, 'HelloHandler', {
      runtime: Runtime.NODEJS_14_X,
      code: Code.fromAsset('applications/lambda-handlers/dist'),
      handler: 'hello-world.helloHandler', // hello-world.js file, helloHandler function,
      vpc,
    });

    const restApi = new LambdaRestApi(this, 'Endpoint', {
      handler: helloHandler,
    });

    new CfnOutput(this, 'RestApi', {
      exportName: 'rest-api-dns',
      value: restApi.url || 'no-url-found',
    });
  }
}
