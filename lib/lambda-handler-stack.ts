import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigw from '@aws-cdk/aws-apigateway';

export class LambdaHandlerStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const helloHandler = new lambda.Function(this, 'HelloHandler', {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset('applications/lambda-handlers/dist'),
      handler: 'hello-world.helloHandler', // hello-world.js file, helloHandler function
    });

    new apigw.LambdaRestApi(this, 'Endpoint', {
      handler: helloHandler,
    });
  }
}
