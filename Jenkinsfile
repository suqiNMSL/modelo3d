pipeline {
  agent any
  environment {
    GITHUB_TOKEN = credentials('GitHub_Token');
    BITBUCKET_CREDS = credentials('BitBucket_Login');
  }
  stages {
    stage('Dynamically set vars') {
      //when { branch 'develop' }
      when { anyOf { branch 'develop'; branch 'master' } }
      steps {
          script {
            // Set name of the image here after the /
              env.IMAGE_ENDING = "-registry.modelo.io:5000/nginx"
            // We define if we need the China prefix for the registry here
              env.PR_REGISTRY = "${ (env.AWS_REGION == 'us') ? '': 'china-'}"
            // We convert the github branch names to the environment names we use
              env.PR_ENV = "${ (env.GIT_BRANCH == 'master' || env.GIT_BRANCH == 'develop') ? (env.GIT_BRANCH == 'master') ? 'prod' : 'dev' : ''}"
            // Full image name is created here based on previus variables
              env.IMAGE = "${env.PR_REGISTRY}${env.PR_ENV}${IMAGE_ENDING}"
              echo "GIT_BRANCH: ${env.GIT_BRANCH}"
              echo "Image: ${env.IMAGE}"
            // We choose deploy key location based on previous steps
              env.DEPLOY_KEY = "/run/secrets/${env.PR_ENV}-key.pem"
            // We determine which instance we need to deploy to
              env.DEPLOY_INSTANCE = "${ (env.PR_ENV == 'prod' || env.PR_ENV == 'dev') ? (env.PR_ENV == 'prod') ? env.PROD_LEADER : env.DEV_LEADER : ''}"
              echo "DEPLOY_INSTANCE: ${env.DEPLOY_INSTANCE}"
            // Docker Build Environment is established here
              env.DOCKER_BUILD_ENV = "${ (env.PR_ENV == 'prod' || env.PR_ENV == 'dev') ? (env.PR_ENV == 'prod') ? 'production' : 'develop' : ''}"
              echo "DOCKER_BUILD_ENV: ${env.DOCKER_BUILD_ENV}"
            // 2 steps below create image tag
              env.SHORT_COMMIT = sh(returnStdout: true, script: "git log -n 1 --pretty=format:'%h'")
              env.IMAGE_TAG = "$env.GIT_BRANCH-$env.SHORT_COMMIT-$env.BUILD_ID"
            // We determine Swarm ENV name
              env.DEPLOY_COMMAND = "'sudo ENVIRONMENT=${env.PR_ENV} docker stack deploy --with-registry-auth -c docker/dstack3-proxy.yml proxy'"
              echo "DEPLOY_COMMAND: ${env.DEPLOY_COMMAND}"
          }
      }
    }
    stage('Build') {
        when { anyOf { branch 'develop'; branch 'master' } }
        // TODO: Introduce more complicated logic not to build Develop in China
        steps {
            sh '''
                docker build --no-cache -t ${IMAGE}:${IMAGE_TAG} --build-arg ENVIRONMENT=${DOCKER_BUILD_ENV} --build-arg BRANCH=${GIT_BRANCH} --build-arg GITHUB_TOKEN=${GITHUB_TOKEN} --build-arg BITBUCKET_CREDS=${BITBUCKET_CREDS} .
                docker tag ${IMAGE}:${IMAGE_TAG} ${IMAGE}:latest
            '''
        }
    }
    stage('Push Containers') {
        //when { branch 'develop' }
        when { anyOf { branch 'develop'; branch 'master' } }
        steps {
            sh "docker --config /run/secrets/ push ${IMAGE}:${env.IMAGE_TAG}"
            sh "docker --config /run/secrets/ push ${IMAGE}:latest"
        }
    }
    stage('Deploy') {
        when { anyOf { branch 'develop'; branch 'master' } }
        steps {
            sh "ssh -i ${DEPLOY_KEY} -o StrictHostKeyChecking=no ubuntu@${DEPLOY_INSTANCE} ${DEPLOY_COMMAND}"
        }
    }
  }
  post {
      always {
          echo 'Put something useful here later'
      }
      failure {
        slackSend baseUrl: 'https://modelo.slack.com/services/hooks/jenkins-ci/',
          teamDomain: 'modelo.slack.com',
          channel:'#pull-request-reviews',
          color: 'danger',
          message: "Jenkins build failed for ${IMAGE}:${IMAGE_TAG}."
        /*
        mail to: 'team@example.com',
            subject: 'Failed Pipeline',
            body: "Something is wrong"
         */
      }
      success {
        slackSend baseUrl: 'https://modelo.slack.com/services/hooks/jenkins-ci/',
            teamDomain: 'modelo.slack.com',
            channel:'#pull-request-reviews',
            color: 'good',
            message: "Your Jenkins build succeeded for ${IMAGE}:${IMAGE_TAG}."
      }
  }
  options {
      // retry(3)
      timeout(time: 10, unit: 'MINUTES')
  }
}
