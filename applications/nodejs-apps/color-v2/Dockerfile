FROM node:14-alpine

ENV NODE_VERSION 14.16.1

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000
EXPOSE 9228
CMD [ "npm", "run", "dev:debug" ]