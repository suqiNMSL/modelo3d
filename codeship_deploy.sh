
#!/usr/bin/env bash

deploy_environment=$1

# Install dependencies
npm install -g gulp

if [[ $deploy_environment == "production" ]]; then

    git clone -b master git@github.com:modelo/MODELO_frontend.git
elif [[ $deploy_environment == "develop" ]]; then

    git clone -b develop git@github.com:modelo/MODELO_frontend.git
else

    echo "No valid deploy_environment command was entered. Valid commands are 'production' and 'develop'"
    exit 128
fi

# The master build process is MODELO_frontend repo so run codeship_deploy.sh from there
cd MODELO_frontend
npm install
bash codeship_deploy.sh $deploy_environment
