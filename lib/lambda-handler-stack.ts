import { Stack, StackProps, App } from '@aws-cdk/core';
import { Function as LambdaFunction, Runtime, Code } from '@aws-cdk/aws-lambda';
import { LambdaRestApi } from '@aws-cdk/aws-apigateway';

export class LambdaHandlerStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    const helloHandler = new LambdaFunction(this, 'HelloHandler', {
      runtime: Runtime.NODEJS_14_X,
      code: Code.fromAsset('applications/lambda-handlers/dist'),
      handler: 'hello-world.helloHandler', // hello-world.js file, helloHandler function,
    });

    new LambdaRestApi(this, 'Endpoint', {
      handler: helloHandler,
    });
  }
}
