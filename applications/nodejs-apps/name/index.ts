import * as express from 'express';

const app = express();

const PORT = 3000;
const HOST = '0.0.0.0';

const generateRandomNumer = (max: number) => {
  return Math.floor(Math.random() * max);
};

const names = ['Ban', 'Stephen', 'David', 'Sanjith'];

app.get('/', (req, res) => {
  const nameIndex = generateRandomNumer(names.length);
  const name = names[nameIndex];
  res.json({
    name,
  });
});

app.listen(PORT, HOST);
