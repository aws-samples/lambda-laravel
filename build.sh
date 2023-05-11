#!/bin/sh

composer install --prefer-dist --no-dev --no-interaction &&
  php artisan route:clear &&
  php artisan view:clear

rm -rf vendor/aws/aws-crt-php
rm -rf vendor/composer/installers
rm -rf vendor/bin

/lambda-layer php_aws_sdk_only S3 Ecr
/lambda-layer php_strip_package vendor
