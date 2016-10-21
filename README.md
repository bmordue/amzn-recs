# amzn-recs

## Bootstrap from a clean DB
* make sure a Neo4j server is available in the location specified eg in `.env`  

## Project layout
- api: nodejs server to provide /crawl API
- lib:
- scripts: 

## Tests for api/
* make the API available on localhost: `node api/crawl.js`
* run the tests: `mocha test/api_tests`

## Tests for lib/
* make sure a Neo4j server is available in the location specified eg in `.env`  
* run the tests: `mocha test/lib_tests`

## TODO
- move /crawl API to separate 'microservice'
- website to generate token by OAuth login (eg Google, Facebook etc as auth provider)
-- any way to provide status updates?? (ie through queue...)

- API/script: add all books by author

- also maintain price history separately, and price last checked date in graphdb
-- don't bother repeatedly checking price for anything < £2

- graph: series -- :IN_SERIES_WITH, properties sequence and series name

- script: expand entire graph by crawling each leaf node to depth n

## Docker

Build a Docker image for this app:
`docker build -t amzn-recs-app .`
Run eg the `populate` script in a container using that image:
`docker run -it --rm --name populate --net=host amzn-recs-app node scripts/populate.js`
or tests:
`docker run -it --rm --name populate --net=host amzn-recs-app npm test`

