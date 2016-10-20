node {
 stage 'Tests for amzn-recs/lib'
 checkout scm
 sh 'npm install'
 sh 'npm test'
 
 stage 'Coverage'
 sh 'npm run-script coverage'
}
