FROM node:14-alpine

ENV NODE_VERSION 14.16.1

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000
CMD [ "node", "dist/index.js" ]