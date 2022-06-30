# This a multi-stage build Dockerfile that incorporates Frontend and Modelo3d code into nGinx.

# 1. Create an intermediate container, build Frontend and Modelo3d code.
FROM neb636/chrome-headless-gulp AS test_build
ARG ENVIRONMENT=local
# Default value for BRANCH is develop if no --build-arg values are provied during building the image
ARG BRANCH=develop
ARG GITHUB_TOKEN
ARG BITBUCKET_CREDS
RUN yarn global add gulp

# Clone Frontend Repo
RUN git clone -b $BRANCH https://$GITHUB_TOKEN@github.com/modelo/MODELO_frontend.git
# Copy Modelo3d into needed Frontend folder
COPY ./ /MODELO_frontend/app/model/modelo3d

WORKDIR /MODELO_frontend
RUN yarn

RUN gulp build --buildEnv=$ENVIRONMENT
# This is not the best way to do it, but might work for now
RUN git clone -b $BRANCH https://$BITBUCKET_CREDS@bitbucket.org/modelo3d/reverse_proxy /reverse_proxy

# 2. Base nGinx image with primary nGinx configs
FROM nginx:alpine AS release
# Default value is local if no --build-arg values are provied during building the image
ARG ENVIRONMENT=local
ARG APP_FOLDER=build
WORKDIR /reverse_proxy
COPY --from=test_build /reverse_proxy/nginx.conf /etc/nginx/nginx.conf
COPY --from=test_build /reverse_proxy/$ENVIRONMENT/conf.d/ /etc/nginx/conf.d/
COPY --from=test_build /reverse_proxy/$ENVIRONMENT/sites-enabled/ /etc/nginx/sites-enabled/
COPY --from=test_build /MODELO_frontend/$APP_FOLDER /usr/share/nginx/html/$APP_FOLDER

# Instructions to build the image:
# docker build -f Dockerfile -t nginx:local .
# docker build -f Dockerfile -t nginx:develop --build-arg ENVIRONMENT=develop --build-arg BRANCH=develop .
# docker build -f Dockerfile -t nginx:prod --build-arg ENVIRONMENT=production --build-arg BRANCH=master .
