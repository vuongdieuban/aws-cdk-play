import * as express from 'express';
import axios from 'axios';

interface Name {
  name: string;
}

interface Color {
  color: string;
  version: string;
}

const app = express();

const PORT = 3000;
const HOST = '0.0.0.0';

const NAME_URL = process.env.NAME_URL;
const COLOR_URL = process.env.COLOR_URL;

app.get('/', async (req, res) => {
  if (!NAME_URL || !COLOR_URL) {
    console.log('Name_Url', NAME_URL);
    console.log('Color_Url', COLOR_URL);
    throw new Error('Missing environment variable');
  }

  const namePromise = axios.get<Name>(NAME_URL);
  const colorPromise = axios.get<Color>(COLOR_URL);

  const [{ data: nameData }, { data: colorData }] = await Promise.all([namePromise, colorPromise]);

  const personalColor = `${nameData.name} likes ${colorData.color}`;

  res.json({
    colorData,
    nameData,
    personalColor,
  });
});

app.listen(PORT, HOST);
