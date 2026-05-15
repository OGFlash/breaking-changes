import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cfOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as ses from 'aws-cdk-lib/aws-ses';
import { Construct } from 'constructs';

export interface BreakingChangesStackProps extends cdk.StackProps {
  domainName: string;
  adminPassword: string;
  jwtSecret: string;
  sesSenderEmail: string;
  adminEmail: string;
}

export class BreakingChangesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BreakingChangesStackProps) {
    super(scope, id, props);

    const { domainName, adminPassword, jwtSecret, sesSenderEmail, adminEmail } = props;

    // ─── S3 Buckets ──────────────────────────────────────────────────────────

    const contentBucket = new s3.Bucket(this, 'ContentBucket', {
      bucketName: `${domainName}-content`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const mediaBucket = new s3.Bucket(this, 'MediaBucket', {
      bucketName: `${domainName}-media`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      cors: [{
        allowedHeaders: ['*'],
        allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
        allowedOrigins: [`https://${domainName}`, `https://www.${domainName}`],
        maxAge: 3600,
      }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `${domainName}-frontend`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const artifactsBucket = new s3.Bucket(this, 'ArtifactsBucket', {
      bucketName: `${domainName}-artifacts`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [{ expiration: cdk.Duration.days(30) }],
    });

    // ─── DynamoDB ─────────────────────────────────────────────────────────────

    const viewsTable = new dynamodb.Table(this, 'ViewsTable', {
      tableName: `${domainName}-views`,
      partitionKey: { name: 'slug', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ─── Lambda ───────────────────────────────────────────────────────────────

    const backendFunction = new lambda.Function(this, 'BackendFunction', {
      functionName: `${domainName}-backend`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('../backend', {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          command: [
            'bash', '-c',
            'pip install -r requirements.txt -t /asset-output && cp -r app handler.py /asset-output',
          ],
        },
      }),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        CONTENT_BUCKET: contentBucket.bucketName,
        MEDIA_BUCKET: mediaBucket.bucketName,
        DYNAMODB_TABLE: viewsTable.tableName,
        JWT_SECRET: jwtSecret,
        ADMIN_PASSWORD: adminPassword,
        SES_SENDER_EMAIL: sesSenderEmail,
        ADMIN_EMAIL: adminEmail,
        CORS_ORIGINS: `https://${domainName},https://www.${domainName}`,
        FRONTEND_BUCKET: frontendBucket.bucketName,
      },
    });

    contentBucket.grantReadWrite(backendFunction);
    mediaBucket.grantReadWrite(backendFunction);
    frontendBucket.grantReadWrite(backendFunction);
    viewsTable.grantReadWriteData(backendFunction);

    backendFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));

    backendFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cloudfront:CreateInvalidation'],
      resources: ['*'],
    }));

    // ─── API Gateway HTTP API ─────────────────────────────────────────────────

    const httpApi = new apigateway.HttpApi(this, 'HttpApi', {
      apiName: `${domainName}-api`,
      corsPreflight: {
        allowHeaders: ['Authorization', 'Content-Type'],
        allowMethods: [apigateway.CorsHttpMethod.ANY],
        allowOrigins: [`https://${domainName}`, `https://www.${domainName}`],
      },
    });

    const lambdaIntegration = new apigatewayIntegrations.HttpLambdaIntegration(
      'LambdaIntegration',
      backendFunction,
    );

    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigateway.HttpMethod.ANY],
      integration: lambdaIntegration,
    });

    // ─── ACM Certificate (must be in us-east-1 for CloudFront) ───────────────

    // NOTE: Certificate must be created in us-east-1.
    // If deploying in another region, use DnsValidatedCertificate or create manually.
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName,
    });

    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName,
      subjectAlternativeNames: [`www.${domainName}`],
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // ─── CloudFront Distribution ──────────────────────────────────────────────

    // Route SPA paths correctly: /admin/* → /admin/index.html, everything else → /index.html
    const spaRoutingFunction = new cloudfront.Function(this, 'SpaRoutingFunction', {
      functionName: `${domainName.replace(/\./g, '-')}-spa-routing`,
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.match(/\/[^\/]+\.[^\/]+$/)) return request;
  if (uri === '/admin' || uri.startsWith('/admin/')) {
    request.uri = '/admin/index.html';
    return request;
  }
  request.uri = '/index.html';
  return request;
}
      `),
    });

    const s3FrontendOrigin = cfOrigins.S3BucketOrigin.withOriginAccessControl(frontendBucket);
    const s3MediaOrigin = cfOrigins.S3BucketOrigin.withOriginAccessControl(mediaBucket);
    const apiOrigin = new cfOrigins.HttpOrigin(
      `${httpApi.httpApiId}.execute-api.${this.region}.amazonaws.com`,
    );

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: s3FrontendOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
        functionAssociations: [{
          function: spaRoutingFunction,
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        }],
      },
      additionalBehaviors: {
        '/api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
        '/media/*': {
          origin: s3MediaOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
        },
      },
      domainNames: [domainName, `www.${domainName}`],
      certificate,
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // Store distribution ID in Lambda env after distribution is created
    backendFunction.addEnvironment('CLOUDFRONT_DISTRIBUTION_ID', distribution.distributionId);

    // ─── Route 53 Records ─────────────────────────────────────────────────────

    new route53.ARecord(this, 'ApexRecord', {
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
    });

    new route53.ARecord(this, 'WwwRecord', {
      zone: hostedZone,
      recordName: 'www',
      target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
    });

    // ─── GitHub Actions Deploy Role ───────────────────────────────────────────

    const githubProvider = new iam.OpenIdConnectProvider(this, 'GithubOIDC', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const deployRole = new iam.Role(this, 'GithubDeployRole', {
      roleName: `${domainName}-github-deploy`,
      assumedBy: new iam.WebIdentityPrincipal(
        githubProvider.openIdConnectProviderArn,
        {
          StringLike: {
            'token.actions.githubusercontent.com:sub': `repo:OGFlash/breaking-changes:*`,
          },
        },
      ),
    });

    frontendBucket.grantReadWrite(deployRole);
    frontendBucket.grantDelete(deployRole);
    artifactsBucket.grantReadWrite(deployRole);

    deployRole.addToPolicy(new iam.PolicyStatement({
      actions: ['cloudfront:CreateInvalidation'],
      resources: [`arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`],
    }));

    deployRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'lambda:UpdateFunctionCode',
        'lambda:UpdateFunctionConfiguration',
        'lambda:GetFunction',
        'lambda:PublishVersion',
      ],
      resources: [backendFunction.functionArn],
    }));

    // ─── Outputs ──────────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      exportName: 'CloudFrontDistributionId',
    });
    new cdk.CfnOutput(this, 'DistributionDomain', {
      value: distribution.distributionDomainName,
      exportName: 'CloudFrontDomain',
    });
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: httpApi.url ?? '',
      exportName: 'ApiEndpoint',
    });
    new cdk.CfnOutput(this, 'ContentBucketName', {
      value: contentBucket.bucketName,
      exportName: 'ContentBucketName',
    });
    new cdk.CfnOutput(this, 'MediaBucketName', {
      value: mediaBucket.bucketName,
      exportName: 'MediaBucketName',
    });
    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: frontendBucket.bucketName,
      exportName: 'FrontendBucketName',
    });
    new cdk.CfnOutput(this, 'ArtifactsBucketName', {
      value: artifactsBucket.bucketName,
      exportName: 'ArtifactsBucketName',
    });
    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: backendFunction.functionName,
      exportName: 'LambdaFunctionName',
    });
    new cdk.CfnOutput(this, 'DeployRoleArn', {
      value: deployRole.roleArn,
      exportName: 'GithubDeployRoleArn',
    });
  }
}
