node {
 try {
  stage 'Checkout'
    deleteDir()
    checkout scm

    sh "git rev-parse --short HEAD > commit_hash.txt"
    sh "git show -s --pretty=%ae > email.txt"
    def tag = "4"
    def email = readFile('email.txt').trim()
    def image_name = "node"
    def volumes = "-v .:/opt/src"

  stage 'Run tests'
    sh "docker run -d -p 3000:3000 ${volumes} ${image_name}:${tag} node api/crawl.js > crawl_api.pid"
    sh "docker run --rm -e RUN_UNSAFE_TESTS=true ${volumes} ${image_name}:${tag} npm test"

  stage 'Coverage'
    sh "docker run --rm ${volumes} ${image_name}:${tag} npm run-script coverage"

  stage 'Clean up'
    sh "docker stop $(cat crawl_api.pid)"
    sh "docker rm $(crawl_api.pid)"
 }
 catch (err) {
  sh "git show -s --pretty=%ae > email.txt"
  def email = readFile('email.txt').trim()

  emailext body: "See ${env.BUILD_URL}", recipient: ${email}, subject: "Build has finished with ${currentBuild.result}"
  throw err
 }
}
