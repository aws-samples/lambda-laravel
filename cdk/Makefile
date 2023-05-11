include .env
export

.EXPORT_ALL_VARIABLES:
DOCKER_BUILDKIT = 1

build: php-layer
	cd ../
	docker compose up release
	docker compose down

php-layer:
	docker build --platform=linux/amd64 ../ --platform=linux/amd64 --tag php-layer --file ../layer.Dockerfile
	rm -rf layer
	docker run --platform=linux/amd64 --volume ${PWD}:/tmp/ --entrypoint /bin/cp php-layer -r /opt /tmp/layer
	docker stop php-layer || true && docker rm php-layer || true
	cp -f ../src/runtime/bootstrap layer/bootstrap
	cp -f ../src/runtime/nginx.conf layer/nginx/conf/
	cp -f ../src/runtime/php.ini layer/php/php.ini
	cp -f ../src/runtime/php-fpm.conf layer/php/etc/
	cp -f ../src/runtime/preload.php layer/php/preload.php

diff: php-layer build
	cdk diff \
  -c LATENCY_VERSION=$(LATENCY_VERSION) \
  -c DB_USER=$(DB_USER) \
  -c RUST_LOG=$(RUST_LOG) \
  -c READINESS_CHECK_PATH=$(READINESS_CHECK_PATH) \
  -c ROUTE53_HOSTEDZONE=$(ROUTE53_HOSTEDZONE) \
  -c ROUTE53_SITENAME=$(ROUTE53_SITENAME) \
  -c PRELOAD_DISABLE=$(PRELOAD_DISABLE) \
  -c SNAPSTART_ENABLE=$(SNAPSTART_ENABLE) \
  -c APP_NAME=$(APP_NAME)

deploy: php-layer build
	cdk deploy \
  -c LATENCY_VERSION=$(LATENCY_VERSION) \
  -c DB_USER=$(DB_USER) \
  -c RUST_LOG=$(RUST_LOG) \
  -c READINESS_CHECK_PATH=$(READINESS_CHECK_PATH) \
  -c ROUTE53_HOSTEDZONE=$(ROUTE53_HOSTEDZONE) \
  -c ROUTE53_SITENAME=$(ROUTE53_SITENAME) \
  -c PRELOAD_DISABLE=$(PRELOAD_DISABLE) \
  -c SNAPSTART_ENABLE=$(SNAPSTART_ENABLE) \
  -c APP_NAME=$(APP_NAME)

destroy:
	cdk destroy \
  -c LATENCY_VERSION=$(LATENCY_VERSION) \
  -c DB_USER=$(DB_USER) \
  -c RUST_LOG=$(RUST_LOG) \
  -c READINESS_CHECK_PATH=$(READINESS_CHECK_PATH) \
  -c ROUTE53_HOSTEDZONE=$(ROUTE53_HOSTEDZONE) \
  -c ROUTE53_SITENAME=$(ROUTE53_SITENAME) \
  -c PRELOAD_DISABLE=$(PRELOAD_DISABLE) \
  -c SNAPSTART_ENABLE=$(SNAPSTART_ENABLE) \
  -c APP_NAME=$(APP_NAME)
