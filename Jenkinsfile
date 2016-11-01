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
    def env_vars = "-e RUN_UNSAFE_TESTS=true"

  stage 'Build Docker image'
    sh "docker build -t ${image_name}:${tag} ."

  stage 'Run tests'
    sh "docker run --rm ${env_vars} --net=host ${image_name}:${tag} npm test"
 
  stage 'Coverage'
    sh "docker run --rm ${env_vars} --net=host ${image_name}:${tag} npm run-script coverage"

  stage 'Archive artifacts'
    archiveArtifacts artifacts: 'coverage/*', onlyIfSuccessful: true

 }
 catch (err) {
  emailext body: "See ${env.BUILD_URL}", recipientProviders: [[$class: 'CulpritsRecipientProvider']], subject: "Build has finished with ${currentBuild.result}"
  throw err
 }
}
