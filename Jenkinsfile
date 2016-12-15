node {
 try {
  stage 'Checkout'
    checkout scm

    def tag = "4"
    def image_name = "node"
    def volumes = "-v ${env.WORKSPACE}:/opt/src -w /opt/src"
    def api_env_vars = "-e DB_USERNAME=${DB_USERNAME}"
                + " -e DB_PASSWORD=${DB_PASSWORD}"
                + " -e DB_URL=${DB_URL}"
    def test_env_vars = "-e RUN_UNSAFE_TESTS=true"
    def test_token = "111111"

  stage 'Run tests'
    sh "docker run --rm ${volumes} ${image_name}:${tag} npm install > npm-install.log"
    sh "docker run --rm ${volumes} ${image_name}:${tag} node scripts/add_to_api_whitelist.js ${test_token}"
    sh "docker run -d -p 3000:3000 --network=host ${volumes} ${api_env_vars} ${image_name}:${tag} node api/crawl.js > crawl_api.pid"
    sh "docker run -d -p 7474:7474 -p 7687:7687 --network=host -v $HOME/neo4j/data:/data -e NEO4J_AUTH=none neo4j"
    sh "docker run --rm ${volumes} ${test_env_vars} --network=host ${image_name}:${tag} npm test"

  stage 'Coverage'
    sh "docker run --rm ${volumes} ${image_name}:${tag} npm run-script coverage"

  stage 'Archive artifacts'
    archiveArtifacts artifacts: 'coverage/*', onlyIfSuccessful: true
 }
 catch (err) {
  stage 'Send error report'
    sh "git show -s --pretty=%ae > email.txt"
    def email = readFile('email.txt').trim()
    emailext body: "See ${env.BUILD_URL}", recipient: email, subject: "Build has finished with ${currentBuild.result}"
    throw err
 }
 finally {
  stage 'Clean up'
    def pid = readFile('crawl_api.pid').trim()
    sh "docker rm -f ${pid}"
    deleteDir()
 }
}
