node {
 stage 'Checkout'
 deleteDir()
 checkout scm

 sh 'git rev-parse --short HEAD > commit_hash.txt'
 def tag = readFile('commit_hash.txt').trim()

 stage 'Build Docker image'
 sh 'docker build -t amzn-recs-apps:${tag} .'

 stage 'Run tests'
 sh 'docker run --rm amzn-recs-app:${tag} npm test'
 
 stage 'Coverage'
 sh 'docker run --rm amzn-recs-app:${tag} npm run-script coverage'
}
