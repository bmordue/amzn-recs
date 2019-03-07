source .env
sudo docker run --rm -v $(pwd):/proj -w /proj \
  -v $(pwd)/.sonarcloud.properties:/root/sonar-scanner/conf/sonar-scanner.properties \
  newtmitch/sonar-scanner:3.2.0-alpine \
  sonar-scanner \
  -Dsonar.login=$SONAR_LOGIN
