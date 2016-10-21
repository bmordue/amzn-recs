node {
 stage 'Checkout'
 deleteDir()
 checkout scm

 stage 'Run tests'
 sh 'docker run -it --rm --net=host amzn-recs-app npm test'
 
 stage 'Coverage'
 sh 'docker run -it --rm --net=host amzn-recs-app npm run-script coverage
}
