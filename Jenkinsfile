node {
 try {
  stage 'Checkout' 
    deleteDir()
    checkout scm

  stage 'Run tests'
    def image = "node:4-onbuild"
    def volumes = "-v .:/usr/src/app"
    sh "docker run --rm ${volumes} -e RUN_UNSAFE_TESTS=true ${image} npm test"
 
  stage 'Coverage'
    sh "docker run --rm ${volumes} ${image} npm run-script coverage"
 }
 catch (err) {
  sh "git show -s --pretty=%ae > email.txt"
  def email = readFile('email.txt').trim()
  emailext body: "See ${env.BUILD_URL}", recipientProviders: [[$class: 'CulpritsRecipientProvider']], subject: "Build has finished with ${currentBuild.result}"
  throw err
 }
}
