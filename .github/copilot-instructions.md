# Amazon Recommendations Crawler (amzn-recs)

Amazon Recommendations Crawler is a Node.js/TypeScript application that crawls Amazon product recommendations and stores the data in a Neo4j graph database. The application includes a REST API server, various data processing scripts, and comprehensive testing infrastructure.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Bootstrap, Build, and Test the Repository
- Install dependencies: `npm install` -- takes 6 seconds locally, up to 10 minutes in Docker. NEVER CANCEL. Set timeout to 15+ minutes.
- Compile TypeScript: `npx tsc` -- takes 4 seconds. Set timeout to 30+ seconds.
- Run tests: `npm test` -- takes 3-4 seconds for 58 tests (30 pass, 28 skip). Set timeout to 30+ seconds.
- Run tests with coverage: `npm test -- --coverage` -- takes 3-4 seconds. Set timeout to 30+ seconds.

### Lint and Code Quality
- Run ESLint: `npx eslint . --config .eslintrc.json --ext .js,.jsx,.ts,.tsx` -- takes 2 seconds. Set timeout to 30+ seconds.
- Note: There are currently 6 ESLint errors and 14 warnings that do not block builds or functionality.
- Always run `npx eslint .` before committing changes or the CI will fail.

### Environment Setup
- Copy environment template: `cp .env_example .env`
- The application requires AWS credentials and Neo4j connection details for full functionality.
- Many features work with mock/fake implementations when external services are unavailable.

### Database Requirements
- Neo4j database is required for full functionality
- Start Neo4j with Docker: `docker run -d --name neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=none neo4j:3.5.3`
- Neo4j web interface available at: http://localhost:7474
- Database connection: bolt://localhost:7687
- Some tests skip database operations when `RUN_UNSAFE_TESTS` is not set to `true`

### Running the Application
- Start API server: `node built/api/crawl.js` or `node src/api/crawl.ts`
- API listens on port 3000
- API requires X-Api-Token header for authentication
- Test API: `curl -H "X-Api-Token: your-token" http://localhost:3000`

### Available Scripts
All scripts are located in `src/scripts/` and `built/scripts/`:
- `node built/scripts/populate.js` - Populate graph DB from JSON files
- `node built/scripts/count.js` - Count nodes in database (requires Neo4j)
- `node built/scripts/crawl.js` - Main crawling script
- `node built/scripts/search.js` - Search functionality
- `node built/scripts/seed.js` - Seed database with initial data

## Validation

### Manual Testing Requirements
- ALWAYS test that the API server starts successfully: `node built/api/crawl.js`
- Verify API responds with authentication error: `curl http://localhost:3000` should return `{"error":"Missing X-Api-Token header"}`
- For database operations, ensure Neo4j is running: `docker run -d --name neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=none neo4j:3.5.3`
- Neo4j web interface should be accessible at: http://localhost:7474 (returns JSON with "data", "management", "bolt" fields)
- NEVER rely on starting/stopping the application as sufficient validation - always test real functionality
- Always verify the API returns proper JSON error messages, not connection failures

### Complete Development Workflow
1. Make code changes to TypeScript files in `src/`
2. Compile: `npx tsc`
3. Lint: `npx eslint .`
4. Test: `npm test`
5. Test API startup: `node built/api/crawl.js` (verify it starts)
6. Stop API server and validate the changes work as expected

### CI Pipeline Validation
- Always run `npx eslint .` before committing - the CI includes ESLint scanning
- Always run `npx tsc` to ensure TypeScript compilation succeeds
- Always run `npm test` to ensure all tests pass
- The GitHub Actions build pipeline runs: compile TypeScript → run tests with coverage → SonarCloud scan

## Common Tasks

### Repo Structure
```
.
├── README.md              # Basic project documentation
├── package.json           # Node.js dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── .eslintrc.json         # ESLint configuration
├── jest.config.ts         # Jest test configuration
├── docker-compose.yml     # Docker services (Neo4j, app)
├── Dockerfile             # Application Docker image
├── .env_example           # Environment variables template
├── build.sh               # Docker build script
├── install.sh             # Docker-based npm install
├── coverage.sh            # Coverage testing script
├── sonar.sh               # SonarCloud analysis script
├── src/                   # TypeScript source code
│   ├── api/               # REST API server
│   ├── lib/               # Core libraries and utilities
│   ├── scripts/           # Command-line scripts
│   ├── test/              # Test files
│   └── workers/           # Background workers
├── built/                 # Compiled JavaScript output (generated)
└── .github/
    └── workflows/         # CI/CD pipelines
```

### Key Libraries and Modules
- **API**: `src/api/crawl.ts` - Main REST API server
- **Database**: `src/lib/graphdb_connector.ts` - Neo4j database connector  
- **AWS Integration**: `src/lib/aws.ts` - Amazon Product Advertising API
- **Logging**: `src/lib/log.ts` - Structured logging
- **Configuration**: `src/lib/config.ts` - Environment configuration
- **Message Queue**: `src/lib/message_queue.ts` - Task queue management
- **Crawling**: `src/lib/crawl_queue.ts` - Web crawling logic

### Important Configuration Files
- `package.json` - Requires Node.js ^16 || ^18 (currently using v20 with warnings)
- `tsconfig.json` - Compiles to ES5, outputs to `./built`
- `.eslintrc.json` - Uses TypeScript parser with recommended rules
- `jest.config.ts` - Minimal Jest configuration with 500ms open handles timeout

### Docker Usage
- Build image: `docker build -t bmordue/amzn-recs:$(git rev-parse --short HEAD) .` -- takes 10+ minutes. NEVER CANCEL. Set timeout to 20+ minutes.
- Run with docker-compose: `docker compose up` (requires external monitoring network modification)
- Direct Neo4j run: `docker run -d --name neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=none neo4j:3.5.3` -- takes 10-15 seconds to be ready

### Testing Notes
- 58 total tests: 30 pass, 28 skip (due to missing database or unsafe test flag)
- Some tests require `RUN_UNSAFE_TESTS=true` environment variable
- Coverage report shows ~24% overall coverage
- Tests run against both `src/` TypeScript and `built/` JavaScript files

### Known Issues and Workarounds
- ESLint reports TypeScript version compatibility warnings (using 5.3.3, supported <5.2.0)
- Some switch/case statements missing break statements (ESLint errors)
- TSLint is deprecated in favor of ESLint
- Node.js version warning: package requires ^16||^18, running v20
- External networks in docker-compose may not exist in all environments

### Timing Expectations
- npm install: 6 seconds locally, up to 10 minutes in Docker - NEVER CANCEL
- TypeScript compilation: 4 seconds
- ESLint: 2 seconds  
- Test suite: 3-4 seconds
- Coverage tests: 3-4 seconds
- Docker image build: 10+ minutes - NEVER CANCEL
- Neo4j startup: 10-15 seconds

## Critical Warnings
- NEVER CANCEL build or test commands - they complete quickly
- ALWAYS validate API functionality by testing actual endpoints, not just startup
- ALWAYS ensure Neo4j is running before testing database-dependent scripts
- ALWAYS run linting before committing changes to avoid CI failures