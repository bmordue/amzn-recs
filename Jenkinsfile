node {
  stage('Checkout') {
    milestone milestone_count++
    checkout scm
    sh "mkdir -p temp"
  }

  stage ('Install') {
    milestone milestone_count++
    def volumes = "-v ${WORKSPACE}:/opt/src -w /opt/src"
    def tag = "8.10-alpine"
    def image_name = "node"
    def test_env_vars = "-e CRAWL_API_HOST=http://localhost:3000"
    def test_token = "111111"

    sh "docker run --rm ${volumes} ${image_name}:${tag} npm install > npm_install.log"
    sh "docker run --rm ${volumes} ${image_name}:${tag} node src/scripts/add_to_api_whitelist.js ${test_token}"

  }
  
  stage ('Run tests') {
    milestone milestone_count++
    sh "docker run --rm ${volumes} ${test_env_vars} --network=host ${image_name}:${tag} npm test"
    junit testResults: 'results_xunit.xml'
  }

  stage ('Coverage') {
    milestone milestone_count++
    sh "docker run --rm ${volumes} --network=host ${image_name}:${tag} npm run-script coverage"
    publishHTML([allowMissing: true, alwaysLinkToLastBuild: false, keepAll: false,
        reportDir: 'coverage/lcov-report', reportFiles: 'index.html', reportName: 'Coverage Report'])
  }

  stage ('Archive artifacts') {
    milestone milestone_count++
    archiveArtifacts artifacts: 'coverage/**/*', onlyIfSuccessful: true
  }
}
