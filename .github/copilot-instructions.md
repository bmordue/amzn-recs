# amzn-recs Coding Instructions

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

amzn-recs is a TypeScript/Node.js application that crawls Amazon product recommendations and stores them in a Neo4j graph database. It provides a REST API for initiating crawl tasks and includes various utility scripts for data processing.

## Working Effectively

### Bootstrap and Build
- `npm install` -- takes 5-6 seconds on modern systems. Set timeout to 180+ seconds for slower environments.
- `npx tsc` -- compiles TypeScript to `built/` directory, takes 4-5 seconds.
- `mkdir -p temp/output temp/done temp/html` -- create required temp directories for scripts.

### Run Tests
- `npm test` -- runs Jest test suite, takes 1-2 seconds. 30 tests pass, 28 skipped (database tests).
- Tests run against both TypeScript source (`src/`) and compiled JavaScript (`built/`).

### Run the API Server
- ALWAYS run the bootstrapping steps first.
- `node built/api/crawl.js` -- starts API server on port 3000.
- API requires whitelisted tokens via `X-Api-Token` header.
- Add test token: `node built/scripts/add_to_api_whitelist.js 111111`

### Run Scripts
- ALWAYS compile TypeScript first: `npx tsc`
- ALWAYS create temp directories first: `mkdir -p temp/output temp/done temp/html`
- Crawl Amazon data: `OFFLINE=true node built/scripts/crawl.js <ASIN> [depth]` -- use OFFLINE=true for development
- Populate database: `node built/scripts/populate.js`
- All scripts log to console with structured JSON logging.
- Scripts require network access unless OFFLINE=true is set.

### Code Quality
- `npx eslint .` -- runs ESLint, may show warnings in built files (expected).
- Known ESLint issues in `built/lib/graphdb_connector.js` (fallthrough cases) are acceptable.
- TypeScript target is ES5 for compatibility.

## Validation

### Manual Testing Scenarios
- ALWAYS test the complete API workflow after making changes:
  1. Start server: `node built/api/crawl.js`
  2. Whitelist token: `node built/scripts/add_to_api_whitelist.js 111111`
  3. Test endpoint: `curl -H "X-Api-Token: 111111" http://localhost:3000/tasks` (may show token whitelisting error if database not configured)
- ALWAYS test script execution: `OFFLINE=true node built/scripts/crawl.js B000EXAMPLE 1`
- ALWAYS run the full test suite: `npm test`

### Build Validation
- Build succeeds without TypeScript compilation errors.
- All tests pass (30 passed, 28 skipped database tests is expected).
- ESLint warnings in built files are acceptable, errors should be investigated.
- API server starts and responds to health checks with proper authentication.

### Environment Dependencies
- **Node.js**: Supports 16+ (currently runs on 20 with warnings).
- **Neo4j**: Optional for basic functionality, required for full database operations.
- **Database tests**: Skipped unless `RUN_UNSAFE_TESTS=true` is set.
- **Amazon API**: Uses fake implementation by default for offline development.

## Common Tasks

### Repository Structure
```
src/
├── api/           # REST API server (crawl.ts)
├── lib/           # Core libraries (graphdb_connector, crawl_queue, etc.)
├── scripts/       # Utility scripts (crawl, populate, search, etc.)
├── test/          # Jest test suites
└── workers/       # Background processing workers
```

### Key Configuration Files
- `package.json` -- dependencies and scripts
- `tsconfig.json` -- TypeScript compilation to ES5 target
- `jest.config.ts` -- Jest test configuration
- `.eslintrc.json` -- ESLint rules and TypeScript parser
- `.env_example` -- environment variable template
- `docker-compose.yml` -- full stack with Neo4j and price service

### CI/CD Workflows
- **GitHub Actions**: `.github/workflows/build.yml` runs npm install, tsc, jest with coverage, SonarCloud
- **CircleCI**: `.circleci/config.yml` simple build pipeline
- **Jenkins**: `Jenkinsfile` comprehensive pipeline with Docker, coverage, analysis

### Docker Usage
- Build image: `export COMMIT=$(git rev-parse --short HEAD) && docker build -t amzn-recs-app:$COMMIT .`
- Run tests: `docker run --rm amzn-recs-app npm test`
- Run scripts: `docker run --rm --net=host amzn-recs-app node built/scripts/populate.js`

## Environment Variables
Copy `.env_example` to `.env` and configure:
- `DB_URL` -- Neo4j connection string (optional for basic development)
- `AMZN_ACCESS_KEY_ID`, `AMZN_ACCESS_KEY_SECRET` -- Amazon API credentials
- `AMZN_RECS_LOG_LEVEL` -- logging level (DEBUG, INFO, WARN, ERROR)
- `CRAWL_API_ENDPOINT` -- API endpoint for crawl requests

## Known Issues and Workarounds
- ESLint shows fallthrough warnings in `built/lib/graphdb_connector.js` -- these are intentional.
- Node.js 20 shows engine compatibility warnings -- application works correctly.
- Database tests are skipped by default -- set `RUN_UNSAFE_TESTS=true` to enable.
- API token whitelisting requires database setup or manual token addition via script.

## Development Workflow
1. Install dependencies: `npm install` (5-6 seconds on modern systems)
2. Create temp directories: `mkdir -p temp/output temp/done temp/html`
3. Compile TypeScript: `npx tsc` (4-5 seconds)
4. Run tests: `npm test` (1-2 seconds)
5. Start API: `node built/api/crawl.js`
6. Test changes with manual scenarios above (use OFFLINE=true for scripts)
7. Run linting: `npx eslint .` (accept known warnings in built files)