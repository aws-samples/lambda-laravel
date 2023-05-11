# Laravel on Lambda

Your Laravel can run directly on Lambda with [AWS Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter)

This is the code used for Laravel on Lambda with Snapstart.

## Prerequisites

To build and deploy this stack, please have the following tools installed.

- Docker
- Node.js
- AWS CLI
- AWS CDK

You also need a DNS domain hosted on Route53.

## Configuration Laravel

Set up your `.env` file.

```shell
$ cd src/laravel
$ cp .env.example .env
$ composer install --prefer-dist --optimize-autoloader --no-interaction
$ php artisan key:generate
```

Use S3 as Filesystem:

```dotenv
FILESYSTEM_DISK=s3
```

Use stdout as Log:

```dotenv
LOG_CHANNEL=stdout
```

Edit `config/logging.php` -> `channels`

```php
'channels' => [
    // ...
    'stdout' => [
        'driver' => 'monolog',
        'handler' => StreamHandler::class,
        'with' => [
            'stream' => 'php://stdout',
        ],
        'formatter' => env('LOG_STDOUT_FORMATTER'),
    ],
    // ...
]
```

Use `redis` as Cache and Session driver:

```dotenv
CACHE_DRIVER=redis
SESSION_DRIVER=redis
REDIS_PORT=6379
```

## Configuration CDK

This stack use `.env` file to provide configuration values.

Copy cdk/.env.example to cdk/.env and update the values to fit your needs.

Then install CDK dependencies

```shell
cd cdk

# Please follow the example to configure
cp .env.example .env

npm install
```

## Deployment

Preview the changes

```shell
make diff
```

Deploy the stack

```shell
make deploy
````

When the deployment is done, open `ROUTE53_SITENAME` to view the home page.

## Clean up

Run the following command to delete ALL the resources deployed for this project, including the database, redis cluster
and S3 bucket.

```shell
make destroy
```

## Security

See [CONTRIBUTING](CONTRIBUTING.md) for more information.

## License

This library is licensed under the MIT-0 License. See the [LICENSE](LICENSE) file.
