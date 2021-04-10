import * as express from 'express';

const app = express();

const PORT = 3000;
const HOST = '0.0.0.0';

const generateRandomNumer = (max: number) => {
  return Math.floor(Math.random() * max);
};

const colors = ['red', 'blue', 'green', 'black'];

app.get('/', (req, res) => {
  const colorIndex = generateRandomNumer(colors.length);
  const chosenColor = colors[colorIndex];
  res.json({
    color: chosenColor.toUpperCase(),
    version: 'v2',
  });
});

app.listen(PORT, HOST);
