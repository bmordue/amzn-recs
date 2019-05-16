NODE_VERSION=11.11-alpine
#rm -rf node_modules
docker run --rm -v $(pwd):/proj -w /proj node:$NODE_VERSION npm install

