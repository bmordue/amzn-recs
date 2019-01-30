FROM node:8

COPY ./package.json .

RUN npm install

COPY . .

CMD ["node", "api/crawl.js"]
