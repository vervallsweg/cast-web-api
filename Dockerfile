FROM node:8-stretch

WORKDIR /usr/src/app

COPY . /usr/src/app

RUN npm install

EXPOSE 3000

ENTRYPOINT ["node", "castWebApi.js"]
