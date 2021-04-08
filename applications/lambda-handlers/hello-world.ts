import axios from 'axios';

export const helloHandler = async function (event: any) {
  try {
    console.log('request:', JSON.stringify(event, undefined, 2));
    const { data } = await axios.get('https://jsonplaceholder.typicode.com/todos/1');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error('Error', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: {
        data: err.message,
      },
    };
  }
};
