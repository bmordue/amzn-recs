FROM node:8.10-alpine

COPY ./package.json .

RUN npm install

COPY . .

CMD ["node", "src/api/crawl.js"]
