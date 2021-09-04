import * as express from 'express';

const app = express();

const PORT = 3000;

const generateRandomNumer = (max: number) => {
  return Math.floor(Math.random() * max);
};

const colors = ['red', 'blue', 'green', 'black'];

app.get('/', (req, res) => {
  const colorIndex = generateRandomNumer(colors.length);
  const chosenColor = colors[colorIndex];
  res.json({
    color: chosenColor,
    version: 'v1',
  });
});

app.listen(PORT);
