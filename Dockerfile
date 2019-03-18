FROM node:11.11-alpine

COPY ./package.json .

RUN npm install

COPY . .

CMD ["node", "src/api/crawl.js"]
