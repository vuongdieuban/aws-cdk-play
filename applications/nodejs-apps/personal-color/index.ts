import * as express from 'express';

const app = express();

const PORT = 3000;
const HOST = '0.0.0.0';

app.get('/', (req, res) => {
  res.send('hello world from express app');
});

app.listen(PORT, HOST);
