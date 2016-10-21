node {
 stage 'Tests for amzn-recs/lib'
 checkout scm
 sh 'npm install'
 sh 'mkdir temp'
 sh 'npm test'
 
 stage 'Coverage'
 sh 'npm run-script coverage'
}
