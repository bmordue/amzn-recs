node {
 try {
  stage 'Checkout'
    deleteDir()
    checkout scm
    sh "mkdir temp"

    def tag = "4"
    def image_name = "node"
    def volumes = "-v ${env.WORKSPACE}:/opt/src -w /opt/src"

  stage 'Run tests'
    sh "docker run --rm ${volumes} ${image_name}:${tag} npm install > npm-install.log"
    sh "docker run -d -p 3000:3000 ${volumes} ${image_name}:${tag} node api/crawl.js > crawl_api.pid"
    sh "docker run --rm -e RUN_UNSAFE_TESTS=true ${volumes} ${image_name}:${tag} npm test"

  stage 'Coverage'
    sh "docker run --rm ${volumes} ${image_name}:${tag} npm run-script coverage"

  stage 'Clean up'
    def pid = readFile('crawl_api.pid').trim()
    sh "docker stop ${pid}"
    sh "docker rm ${pid}"
    sh "docker run --rm ${volumes} ${image_name}:${tag} rm -rf *"
    deleteDir()
 }
 catch (err) {
  sh "git show -s --pretty=%ae > email.txt"
  def email = readFile('email.txt').trim()

  emailext body: "See ${env.BUILD_URL}", recipient: email, subject: "Build has finished with ${currentBuild.result}"
  deleteDir()
  throw err
 }
}
