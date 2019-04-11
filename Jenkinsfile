node {
  stage('Checkout') {
    checkout scm
    sh "mkdir -p temp"
  }

  def volumes = "-v ${WORKSPACE}:/opt/src -w /opt/src"
  def tag = "11.11-alpine"
  def image_name = "node"
  def test_env_vars = "-e CRAWL_API_HOST=http://localhost:3000"
  def test_token = "111111"

  def DOCKER_HOME = tool 'docker'
  def DOCKER_BIN = "${DOCKER_HOME}/bin/docker"

  stage ('Install') {
    docker.image("${image_name}:${tag}").inside("${volumes}") {
      sh "npm install > npm_install.log"
      sh "node src/scripts/add_to_api_whitelist.js ${test_token}"
    }
  }
  
  stage ('Run tests') {
    docker.image("${image_name}:${tag}").inside("${volumes} ${test_env_vars} --network=host") {
      sh "./node_modules/.bin/mocha --exit --reporter mocha-junit-reporter src/test/lib_tests"
    }
    junit testResults: 'test-results.xml'
  }

  stage ('Coverage') {
    docker.image("${image_name}:${tag}").inside("${volumes}") {
      sh "./node_modules/.bin/nyc --reporter=lcov npm test"
    }
    publishHTML([allowMissing: true, alwaysLinkToLastBuild: false, keepAll: false,
        reportDir: 'coverage/lcov-report', reportFiles: 'index.html', reportName: 'Coverage Report'])
  }

  stage ('Analysis') {
    def sonarProperties = "-v ${WORKSPACE}/conf:/root/sonar-scanner/conf"
    def sonarParams = ""
    if (env.BRANCH_NAME != 'master') {
        sonarParams = " -Dsonar.pullrequest.branch=${env.BRANCH_NAME}" +
            " -Dsonar.pullrequest.key=${env.CHANGE_ID}" +
            " -Dsonar.pullrequest.base=${env.CHANGE_TARGET}"
    }
    withCredentials([string(credentialsId: 'SONAR_LOGIN', variable: 'SONAR_LOGIN')]) {
      docker.image("newtmitch/sonar-scanner:3.2.0-alpine").inside("${volumes} ${sonarProperties}") {
        sh "sonar-scanner -Dsonar.login=${SONAR_LOGIN} ${sonarParams}"
      }
    }
  }

  stage ('Archive artifacts') {
    archiveArtifacts artifacts: 'coverage/**/*,*xml', onlyIfSuccessful: true, allowEmptyArchive: true
  }
}
