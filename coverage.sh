NODE_VERSION=11.11-alpine
docker run --rm -v $(pwd):/proj -w /proj node:$NODE_VERSION ./node_modules/.bin/nyc --reporter=lcov --reporter=text-lcov npm test

