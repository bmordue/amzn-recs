docker run --rm -v $(pwd):/proj -w /proj node:8.10-alpine ./node_modules/.bin/nyc --reporter=lcov --reporter=text-lcov npm test

