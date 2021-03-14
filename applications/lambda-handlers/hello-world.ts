export const helloHandler = async function (event: any) {
  console.log('request:', JSON.stringify(event, undefined, 2));
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/plain' },
    body: `Hello, CDK! This is our lambda function - YEEEEETT\n`,
  };
};
