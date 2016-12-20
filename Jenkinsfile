def milestone_count = 1

def tag = "4"
def image_name = "node"
def volumes = "-v ${env.WORKSPACE}:/opt/src -w /opt/src"
def net_name = "testnet"
def api_env_vars = "-e DB_USERNAME=${env.DB_USERNAME}"
            + " -e DB_PASSWORD=${env.DB_PASSWORD}"
            + " -e DB_URL=http://neo4j:7474"
def test_env_vars = "-e RUN_UNSAFE_TESTS=true"
            + "-e CRAWL_API_HOST=http://crawl_api:3000"
def test_token = "111111"

milestone milestone_count++

node {
 try {
  stage 'Checkout'
    milestone milestone_count++
    checkout scm
    sh "mkdir temp"

  stage 'Install'
    milestone milestone_count++
    sh "docker network rm ${net_name}"
    sh "docker network create ${net_name}"
    sh "docker run --rm ${volumes} ${image_name}:${tag} npm install > npm-install.log"
    sh "docker run --rm ${volumes} ${image_name}:${tag} node scripts/add_to_api_whitelist.js ${test_token}"

  stage 'Set up dependencies'
    milestone milestone_count++  
    sh "docker run -d -p 3000:3000 --network=${net_name} ${volumes} ${api_env_vars} --name crawl_api ${image_name}:${tag} node api/crawl.js > crawl_api.pid"
    sh "docker run -d -p 7474:7474 -p 7687:7687 --network=${net_name} -v $HOME/neo4j/data:/data -e NEO4J_AUTH=none --name neo4j neo4j > neo4j.pid"

  stage 'Run tests'
    milestone milestone_count++
    sh "docker run --rm ${volumes} ${test_env_vars} --network=${net_name} ${image_name}:${tag} npm test"

  stage 'Coverage'
    milestone milestone_count++
    sh "docker run --rm ${volumes} ${image_name}:${tag} npm run-script coverage"

  stage 'Archive artifacts'
    milestone milestone_count++
    archiveArtifacts artifacts: 'coverage/*', onlyIfSuccessful: true
 }
 catch (err) {
  stage 'Send error report'
    milestone milestone_count++
    sh "git config --get user.email > email.txt"
    def email = readFile('email.txt').trim()
    emailext body: "See ${env.BUILD_URL}", recipient: email, subject: "Build has finished with ${currentBuild.result}"
    throw err
 }
 finally {
  stage 'Clean up'
    milestone milestone_count++
    def crawl_api_pid = readFile('crawl_api.pid').trim()
    sh "docker rm -f ${crawl_api_pid}"
    def neo4j_pid = readFile('neo4j.pid').trim()
    sh "docker rm -f ${neo4j_pid}"
    sh "docker network rm ${net_name}"
    deleteDir()
 }
}
