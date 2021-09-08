import * as express from 'express';

function sleep(timeMs: number) {
  return new Promise(res => {
    setTimeout(res, timeMs);
  });
}

const app = express();

const PORT = 3000;

const generateRandomNumer = (max: number) => {
  return Math.floor(Math.random() * max);
};

const colors = ['red', 'blue', 'green', 'black'];

app.get('/health', (req, res) => {
  res.json({
    health: true,
    version: 'v2',
  });
});

app.get('/', async (req, res) => {
  const colorIndex = generateRandomNumer(colors.length);
  const chosenColor = colors[colorIndex];
  await sleep(60 * 1000);
  console.log('-----About to response-----');
  res.json({
    color: chosenColor.toUpperCase(),
    version: 'v2',
  });
});

app.listen(PORT);
