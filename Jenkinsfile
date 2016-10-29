node {
 try {
  stage 'Checkout' 
    deleteDir()
    checkout scm

    sh "git rev-parse --short HEAD > commit_hash.txt"
    sh "git show -s --pretty=%ae > email.txt"
    def tag = readFile('commit_hash.txt').trim()
    def email = readFile('email.txt').trim()
    def image_name = "amzn-recs-app"

  stage 'Build Docker image'
    sh "docker build -t ${image_name}:${tag} ."

  stage 'Run tests'
    sh "docker run --rm -e RUN_UNSAFE_TESTS=true ${image_name}:${tag} npm test"
 
  stage 'Coverage'
    sh "docker run --rm ${image_name}:${tag} npm run-script coverage"
 }
 catch (err) {
  emailext body: "See ${env.BUILD_URL}", recipientProviders: [[$class: 'CulpritsRecipientProvider']], subject: "Build has finished with ${currentBuild.result}"
  throw err
 }
}
