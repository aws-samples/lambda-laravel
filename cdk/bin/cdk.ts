#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {LaravelStack} from '../lib/laravel-stack';

const app = new cdk.App();

const env_development = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
};

const appName = process.env.APP_NAME || 'LaravelDemo'

new LaravelStack(app, appName, {env: env_development});
