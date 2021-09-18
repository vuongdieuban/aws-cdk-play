import axios from 'axios';

export const pingInternal = async function (event: any) {
  try {
    console.log('request made');
    const internalUrl = 'http://color.internal/health'; // will go to ALB, ALB proxy to

    const { data } = await axios.get(internalUrl);
    console.log('respones', data);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    const error = err as Error;
    console.error('Error', error);
    const errorResponse = {
      data: error.message,
    };
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorResponse),
    };
  }
};
