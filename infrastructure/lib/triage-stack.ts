import * as path from 'node:path';
import {
  Stack,
  type StackProps,
  Duration,
  RemovalPolicy,
  CfnOutput,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Table, AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import {
  NodejsFunction,
  OutputFormat,
  type NodejsFunctionProps,
} from 'aws-cdk-lib/aws-lambda-nodejs';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
  HttpApi,
  HttpMethod,
  CorsHttpMethod,
} from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Bucket, BlockPublicAccess, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import {
  Distribution,
  ViewerProtocolPolicy,
  AllowedMethods,
  CachedMethods,
  CachePolicy,
  ResponseHeadersPolicy,
  HeadersFrameOption,
  HeadersReferrerPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';

const BACKEND_SRC = path.resolve(__dirname, '../../backend/src');
const FRONTEND_DIST = path.resolve(__dirname, '../../frontend/dist');
const BEDROCK_INFERENCE_PROFILE = 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';

export class TriageStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const tickets = new Table(this, 'TicketsTable', {
      tableName: 'TriageTickets',
      partitionKey: { name: 'ticketId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    tickets.addGlobalSecondaryIndex({
      indexName: 'StatusPriorityIndex',
      partitionKey: { name: 'status', type: AttributeType.STRING },
      sortKey: { name: 'priority', type: AttributeType.STRING },
    });

    const sprints = new Table(this, 'SprintsTable', {
      tableName: 'TriageSprints',
      partitionKey: { name: 'sprintId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const settings = new Table(this, 'SettingsTable', {
      tableName: 'TriageSettings',
      partitionKey: { name: 'settingKey', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const baseEnv: Record<string, string> = {
      TICKETS_TABLE: tickets.tableName,
      SPRINTS_TABLE: sprints.tableName,
      SETTINGS_TABLE: settings.tableName,
      BEDROCK_MODEL_ID: BEDROCK_INFERENCE_PROFILE,
      NODE_OPTIONS: '--enable-source-maps',
    };

    const baseFn: Pick<
      NodejsFunctionProps,
      'runtime' | 'memorySize' | 'timeout' | 'environment' | 'bundling' | 'logRetention'
    > = {
      runtime: Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: Duration.seconds(30),
      environment: baseEnv,
      logRetention: RetentionDays.TWO_WEEKS,
      bundling: {
        target: 'node22',
        format: OutputFormat.CJS,
        sourceMap: true,
        minify: false,
        externalModules: ['@aws-sdk/*'],
      },
    };

    const ticketsFn = new NodejsFunction(this, 'TicketsFn', {
      ...baseFn,
      entry: path.join(BACKEND_SRC, 'handlers/tickets.ts'),
      handler: 'handler',
      timeout: Duration.seconds(30),
      memorySize: 1024,
    });

    const sprintsFn = new NodejsFunction(this, 'SprintsFn', {
      ...baseFn,
      entry: path.join(BACKEND_SRC, 'handlers/sprints.ts'),
      handler: 'handler',
    });

    const settingsFn = new NodejsFunction(this, 'SettingsFn', {
      ...baseFn,
      entry: path.join(BACKEND_SRC, 'handlers/settings.ts'),
      handler: 'handler',
    });

    const aiFn = new NodejsFunction(this, 'AiFn', {
      ...baseFn,
      entry: path.join(BACKEND_SRC, 'handlers/ai.ts'),
      handler: 'handler',
      timeout: Duration.seconds(30),
      memorySize: 1024,
    });

    tickets.grantReadWriteData(ticketsFn);
    sprints.grantReadWriteData(ticketsFn);
    settings.grantReadData(ticketsFn);

    tickets.grantReadWriteData(sprintsFn);
    sprints.grantReadWriteData(sprintsFn);

    settings.grantReadWriteData(settingsFn);

    tickets.grantReadWriteData(aiFn);
    sprints.grantReadData(aiFn);
    settings.grantReadData(aiFn);

    // Inference profile name is `us.<model-id>`; foundation model ARN drops the regional prefix.
    const FOUNDATION_MODEL = BEDROCK_INFERENCE_PROFILE.replace(/^[a-z]{2}\./, '');
    const bedrockPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: [
        `arn:aws:bedrock:*::foundation-model/${FOUNDATION_MODEL}`,
        `arn:aws:bedrock:*:${this.account}:inference-profile/${BEDROCK_INFERENCE_PROFILE}`,
      ],
    });
    ticketsFn.addToRolePolicy(bedrockPolicy);
    aiFn.addToRolePolicy(bedrockPolicy);

    const api = new HttpApi(this, 'TriageApi', {
      apiName: 'triage-api',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PUT,
          CorsHttpMethod.DELETE,
          CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type'],
      },
    });

    const ticketsIntegration = new HttpLambdaIntegration('TicketsInt', ticketsFn);
    const sprintsIntegration = new HttpLambdaIntegration('SprintsInt', sprintsFn);
    const settingsIntegration = new HttpLambdaIntegration('SettingsInt', settingsFn);
    const aiIntegration = new HttpLambdaIntegration('AiInt', aiFn);

    const routes: { path: string; methods: HttpMethod[]; integration: HttpLambdaIntegration }[] = [
      { path: '/api/tickets', methods: [HttpMethod.GET, HttpMethod.POST], integration: ticketsIntegration },
      { path: '/api/tickets/{ticketId}', methods: [HttpMethod.PUT, HttpMethod.DELETE], integration: ticketsIntegration },
      { path: '/api/tickets/groom', methods: [HttpMethod.POST], integration: ticketsIntegration },
      { path: '/api/tickets/merge', methods: [HttpMethod.POST], integration: ticketsIntegration },
      { path: '/api/sprints', methods: [HttpMethod.GET, HttpMethod.POST], integration: sprintsIntegration },
      { path: '/api/sprints/{sprintId}', methods: [HttpMethod.PUT], integration: sprintsIntegration },
      { path: '/api/sprints/{sprintId}/complete', methods: [HttpMethod.POST], integration: sprintsIntegration },
      { path: '/api/settings', methods: [HttpMethod.GET, HttpMethod.PUT], integration: settingsIntegration },
      { path: '/api/ai/ask', methods: [HttpMethod.POST], integration: aiIntegration },
      { path: '/api/ai/digest', methods: [HttpMethod.POST], integration: aiIntegration },
      { path: '/api/ai/risk', methods: [HttpMethod.POST], integration: aiIntegration },
      { path: '/api/tickets/{ticketId}/ai-edit', methods: [HttpMethod.POST], integration: aiIntegration },
    ];
    for (const route of routes) api.addRoutes(route);

    new CfnOutput(this, 'ApiUrl', {
      value: api.apiEndpoint,
      description: 'HTTP API endpoint',
    });

    const siteBucket = new Bucket(this, 'SiteBucket', {
      bucketName: `triage-site-${this.account}`,
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const securityHeaders = new ResponseHeadersPolicy(this, 'SiteHeaders', {
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: HeadersFrameOption.DENY, override: true },
        referrerPolicy: {
          referrerPolicy: HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          override: true,
        },
      },
    });

    const distribution = new Distribution(this, 'SiteDistribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        compress: true,
        responseHeadersPolicy: securityHeaders,
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(1),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(1),
        },
      ],
      comment: 'Triage frontend',
    });

    new BucketDeployment(this, 'SiteDeployment', {
      sources: [Source.asset(FRONTEND_DIST)],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
      prune: true,
    });

    new CfnOutput(this, 'SiteUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront distribution URL',
    });

    new CfnOutput(this, 'SiteBucketName', {
      value: siteBucket.bucketName,
      description: 'S3 bucket holding the frontend build',
    });
  }
}
