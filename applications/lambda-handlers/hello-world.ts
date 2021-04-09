import axios from 'axios';

export const helloHandler = async function (event: any) {
  try {
    console.log('request:', JSON.stringify(event, undefined, 2));
    const internalDataPromise = axios.get('http://greeter.internal:3000');
    const externalDataPromise = axios.get('https://jsonplaceholder.typicode.com/todos/1');

    const [internalData, externalData] = await Promise.all([internalDataPromise, externalDataPromise]);
    const response = {
      internalData,
      externalData,
    };
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (err) {
    console.error('Error', err);
    const errorResponse = {
      data: err.message,
    };
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorResponse),
    };
  }
};
