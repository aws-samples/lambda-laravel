import {
    aws_certificatemanager as acm,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_ec2 as ec2,
    aws_elasticache as elasticache,
    aws_lambda as lambda,
    aws_rds as rds,
    aws_route53 as route53,
    aws_route53_targets as route53targets,
    aws_s3 as s3,
    CfnOutput,
    CfnResource,
    custom_resources as cr,
    Duration,
    Lazy,
    RemovalPolicy,
    Stack,
    StackProps,
} from "aws-cdk-lib";
import {InstanceType} from "aws-cdk-lib/aws-ec2";
import {Construct} from "constructs";
import * as path from "path";
import {S3Origin} from "aws-cdk-lib/aws-cloudfront-origins";

export class LaravelStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // VPC
        const lVPC = new ec2.Vpc(this, "vpc", {
            maxAzs: 2,
            natGateways: 1,
            gatewayEndpoints: {
                S3: {
                    service: ec2.GatewayVpcEndpointAwsService.S3,
                },
            },
        });

        // default security group
        const lDefaultSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
            this,
            "defaultsg",
            lVPC.vpcDefaultSecurityGroup
        );

        // Aurora Mysql Database
        const dbClusterInstanceCount: number = 1;
        const laravelRds = new rds.DatabaseCluster(this, "Database", {
            engine: rds.DatabaseClusterEngine.auroraMysql({
                version: rds.AuroraMysqlEngineVersion.of(
                    "8.0.mysql_aurora.3.02.0",
                    "8.0"
                ),
            }),
            credentials: rds.Credentials.fromGeneratedSecret(
                this.node.tryGetContext("DB_USER")
            ),
            defaultDatabaseName: "laravel",
            instances: dbClusterInstanceCount,
            instanceProps: {
                instanceType: new InstanceType("serverless"),
                securityGroups: [lDefaultSecurityGroup],
                vpc: lVPC,
                vpcSubnets: {
                    subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
                },
            },
        });

        const serverlessV2ScalingConfiguration = {
            MinCapacity: 0.5,
            MaxCapacity: 32,
        };

        const dbScalingConfigure = new cr.AwsCustomResource(
            this,
            "DbScalingConfigure",
            {
                onCreate: {
                    service: "RDS",
                    action: "modifyDBCluster",
                    parameters: {
                        DBClusterIdentifier: laravelRds.clusterIdentifier,
                        ServerlessV2ScalingConfiguration: serverlessV2ScalingConfiguration,
                    },
                    physicalResourceId: cr.PhysicalResourceId.of(
                        laravelRds.clusterIdentifier
                    ),
                },
                onUpdate: {
                    service: "RDS",
                    action: "modifyDBCluster",
                    parameters: {
                        DBClusterIdentifier: laravelRds.clusterIdentifier,
                        ServerlessV2ScalingConfiguration: serverlessV2ScalingConfiguration,
                    },
                    physicalResourceId: cr.PhysicalResourceId.of(
                        laravelRds.clusterIdentifier
                    ),
                },
                policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
                    resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
                }),
            }
        );

        const cfnDbCluster = laravelRds.node.defaultChild as rds.CfnDBCluster;
        const dbScalingConfigureTarget = dbScalingConfigure.node.findChild(
            "Resource"
        ).node.defaultChild as CfnResource;

        cfnDbCluster.addPropertyOverride("EngineMode", "provisioned");
        dbScalingConfigure.node.addDependency(cfnDbCluster);

        for (let i = 1; i <= dbClusterInstanceCount; i++) {
            (
                laravelRds.node.findChild(`Instance${i}`) as rds.CfnDBInstance
            ).addDependsOn(dbScalingConfigureTarget);
        }

        // remove database when the stack is deleted
        laravelRds.applyRemovalPolicy(RemovalPolicy.DESTROY);

        // ElastiCache
        const lCacheSubnetGroup = new elasticache.CfnSubnetGroup(
            this,
            "lCacheSubnetGroup",
            {
                cacheSubnetGroupName: this.stackName + "-lCacheSubnetGroup",
                description: "Cache Subnet Group for" + this.stackName,
                subnetIds: lVPC.privateSubnets.map((subnet) => subnet.subnetId),
            }
        );

        const laravelCache = new elasticache.CfnCacheCluster(
            this,
            "vwCacheCluster",
            {
                cacheNodeType: "cache.t3.micro",
                engine: "redis",
                numCacheNodes: 1,
                cacheSubnetGroupName: lCacheSubnetGroup.cacheSubnetGroupName,
                vpcSecurityGroupIds: [lDefaultSecurityGroup.securityGroupId],
            }
        );

        // remove the redis when the stack is deleted
        laravelCache.applyRemovalPolicy(RemovalPolicy.DESTROY);

        laravelCache.addDependsOn(lCacheSubnetGroup);

        // S3 Bucket
        const lBucket = new s3.Bucket(this, "bucket", {
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            blockPublicAccess: {
                blockPublicAcls: true,
                ignorePublicAcls: true,
                blockPublicPolicy: true,
                restrictPublicBuckets: true,
            }
        });

        const layer = new lambda.LayerVersion(this, 'layer', {
            code: lambda.Code.fromAsset(path.join(__dirname, "../layer")),
            compatibleRuntimes: [lambda.Runtime.JAVA_11],
            license: 'Apache-2.0',
            description: 'PHP 7.4',
        });

        // Lambda Function
        const laravelFunction = new lambda.Function(this, "laravel", {
            functionName: this.stackName + 'Web',
            architecture: lambda.Architecture.X86_64,
            code: lambda.Code.fromAsset(path.join(__dirname, "../../src/laravel")),
            runtime: lambda.Runtime.JAVA_11,
            handler: "/opt/bootstrap",
            memorySize: 4048,
            timeout: Duration.seconds(300),
            vpc: lVPC,
            vpcSubnets: {subnetType: ec2.SubnetType.PRIVATE_WITH_NAT},
            securityGroups: [lDefaultSecurityGroup],
            layers: [layer],
            environment: {
                LATENCY_VERSION: this.node.tryGetContext("LATENCY_VERSION"),
                RUST_LOG: this.node.tryGetContext("RUST_LOG"),
                READINESS_CHECK_PATH: this.node.tryGetContext("READINESS_CHECK_PATH"),
                AWS_LAMBDA_EXEC_WRAPPER: "/opt/bootstrap",
                PRELOAD_DISABLE: this.node.tryGetContext("PRELOAD_DISABLE"),
                DB_HOST: laravelRds.secret!.secretValueFromJson("host").toString(),
                DB_PORT: laravelRds.secret!.secretValueFromJson("port").toString(),
                DB_DATABASE: laravelRds.secret!.secretValueFromJson("dbname").toString(),
                DB_USERNAME: laravelRds.secret!.secretValueFromJson("username").toString(),
                DB_PASSWORD: laravelRds.secret!.secretValueFromJson("password").toString(),
                REDIS_HOST: laravelCache.attrRedisEndpointAddress,
                REDIS_PORT: laravelCache.attrRedisEndpointPort,
                REDIS_TIMEOUT: "1",
                REDIS_READ_TIMEOUT: "1",
                REDIS_DATABASE: "0",
                FILESYSTEM_DISK: "s3",
                AWS_BUCKET: lBucket.bucketName,
                LOG_CHANNEL: "stdout",
                CACHE_DRIVER: "redis",
                SESSION_DRIVER: "redis",
            },
            currentVersionOptions: {
                removalPolicy: RemovalPolicy.DESTROY,
                retryAttempts: 1,
            },
        });

        if (this.node.tryGetContext("SNAPSTART_ENABLE") === 'true') {
            (laravelFunction.node.defaultChild as lambda.CfnFunction).addPropertyOverride('SnapStart', {
                ApplyOn: 'PublishedVersions',
            });
        }

        // Lambda Alias
        const liveAlias = laravelFunction.addAlias("live");
        // Add Lambda Function URL to this alias
        const fUrl = liveAlias.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
        });

        // Grant Lambda read/write access to the s3 bucket
        lBucket.grantReadWrite(laravelFunction);
        lBucket.grantPutAcl(laravelFunction);

        // Route53 Domain
        const zoneName = this.node.tryGetContext("ROUTE53_HOSTEDZONE");
        if (!zoneName) {
            throw new Error(`ROUTE53_HOSTEDZONE not found`);
        }

        const lHostedZone = route53.HostedZone.fromLookup(this, "hostedzone", {
            domainName: zoneName,
        });

        // ACM Certification
        const lDomainName = this.node.tryGetContext("ROUTE53_SITENAME");
        const lCertificate = new acm.DnsValidatedCertificate(this, "certificate", {
            domainName: lDomainName,
            hostedZone: lHostedZone,
            region: "us-east-1",
        });

        // CloudFront
        const lDefaultCachePolicy = new cloudfront.CachePolicy(
            this,
            "lDefaultCachePolicy",
            {
                cachePolicyName: this.stackName + "-lDefaultCachePolicy",
                comment: "default cache policy for " + this.stackName,
                defaultTtl: Duration.seconds(0),
                minTtl: Duration.seconds(0),
                maxTtl: Duration.days(365),
                queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
                headerBehavior:
                    cloudfront.CacheHeaderBehavior.allowList("Authorization"),
                cookieBehavior: cloudfront.CacheCookieBehavior.allowList(
                    "laravel_*",
                ),
                enableAcceptEncodingGzip: true,
                enableAcceptEncodingBrotli: true,
            }
        );
        const fUrlOriginRequestPolicy = new cloudfront.OriginRequestPolicy(
            this,
            "fUrlOriginRequestPolicy",
            {
                originRequestPolicyName: this.stackName + "-fUrlOriginRequestPolicy",
                comment: "api gateway origin request policy for " + this.stackName,
                queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
                headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
                    "Accept",
                    "Cache-Control",
                    "Content-Encoding",
                    "Content-Type",
                    "Origin",
                    "Referer",
                    "User-Agent",
                    "X-Forwarded-Host",
                ),
                cookieBehavior: cloudfront.OriginRequestCookieBehavior.all(),
            }
        );

        const lForwardedHostFunction = new cloudfront.Function(
            this,
            "lForwardedHostFunction",
            {
                code: cloudfront.FunctionCode.fromInline(
                    "function handler(event) { \
                  var request = event.request; \
                  request.headers['x-forwarded-host'] = {value: request.headers.host.value}; \
                  return request; \
                }"
                ),
            }
        );

        const apiDomain = Lazy.uncachedString({
            produce: (context) => {
                const resolved = context.resolve(fUrl.url);
                return {"Fn::Select": [2, {"Fn::Split": ["/", resolved]}]} as any;
            },
        });

        const lCFDistribution = new cloudfront.Distribution(this, "distribution", {
            domainNames: [lDomainName],
            certificate: lCertificate,
            comment: "Distribution for " + this.stackName,
            defaultBehavior: {
                origin: new origins.HttpOrigin(apiDomain, {
                    readTimeout: Duration.seconds(60),
                }),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
                cachePolicy: lDefaultCachePolicy,
                originRequestPolicy: fUrlOriginRequestPolicy,
                compress: true,
                functionAssociations: [
                    {
                        function: lForwardedHostFunction,
                        eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
                    },
                ],
            },
            additionalBehaviors: {
                '/uploads/*': {
                    origin: new S3Origin(lBucket),
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                    cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                },
            },
        });

        // Route53 record for Cloudfront Distribution
        new route53.ARecord(this, "Alias", {
            zone: lHostedZone,
            recordName: lDomainName,
            target: route53.RecordTarget.fromAlias(
                new route53targets.CloudFrontTarget(lCFDistribution)
            ),
        });

        new CfnOutput(this, "home", {
            value: 'https://' + this.node.tryGetContext("ROUTE53_SITENAME"),
        });

        new CfnOutput(this, "lambda_furl", {
            value: fUrl.url,
        });
    }
}
