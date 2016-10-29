node {
 try {
  stage 'Checkout'
  deleteDir()
  checkout scm

  sh 'git rev-parse --short HEAD > commit_hash.txt'
  sh 'git show -s --pretty=%ae > email.txt'
  def tag = readFile('commit_hash.txt').trim()
  def email = readFile('email.txt').trim()

  stage 'Build Docker image'
  sh 'docker build -t amzn-recs-apps:${tag} .'

  stage 'Run tests'
  sh 'docker run --rm -e RUN_UNSAFE_TESTS=true amzn-recs-app:${tag} npm test'
 
  stage 'Coverage'
  sh 'docker run --rm amzn-recs-app:${tag} npm run-script coverage'
 }
 catch (err) {
  mail body: "project build error is here: ${env.BUILD_URL}" ,
  from: 'jenkins@blackbox',
  subject: 'project build failed',
  to: '${email}'

  throw err
 }
}
