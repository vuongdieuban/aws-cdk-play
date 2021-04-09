import axios from 'axios';

export const helloHandler = async function (event: any) {
  try {
    console.log('request:', JSON.stringify(event, undefined, 2));
    const albUrl = 'http://greeting.internal:3000';
    const { data } = await axios.get(albUrl);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
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
