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
import {
  Function as LambdaFunction,
  Runtime,
  Code,
  type FunctionProps,
} from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import {
  HttpApi,
  HttpMethod,
  CorsHttpMethod,
} from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';

const BACKEND_DIST = path.resolve(__dirname, '../../backend/dist');
const BEDROCK_INFERENCE_PROFILE = 'us.anthropic.claude-sonnet-4-5';

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

    const baseFn: Pick<FunctionProps, 'runtime' | 'code' | 'memorySize' | 'timeout' | 'environment'> = {
      runtime: Runtime.NODEJS_22_X,
      code: Code.fromAsset(BACKEND_DIST),
      memorySize: 512,
      timeout: Duration.seconds(30),
      environment: baseEnv,
    };

    const ticketsFn = new LambdaFunction(this, 'TicketsFn', {
      ...baseFn,
      handler: 'handlers/tickets.handler',
      timeout: Duration.seconds(30),
      memorySize: 1024,
    });

    const sprintsFn = new LambdaFunction(this, 'SprintsFn', {
      ...baseFn,
      handler: 'handlers/sprints.handler',
    });

    const settingsFn = new LambdaFunction(this, 'SettingsFn', {
      ...baseFn,
      handler: 'handlers/settings.handler',
    });

    tickets.grantReadWriteData(ticketsFn);
    sprints.grantReadWriteData(ticketsFn);
    settings.grantReadData(ticketsFn);

    tickets.grantReadWriteData(sprintsFn);
    sprints.grantReadWriteData(sprintsFn);

    settings.grantReadWriteData(settingsFn);

    const bedrockPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: [
        `arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-5-*`,
        `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/${BEDROCK_INFERENCE_PROFILE}`,
      ],
    });
    ticketsFn.addToRolePolicy(bedrockPolicy);

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

    api.addRoutes({
      path: '/api/tickets',
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration: ticketsIntegration,
    });
    api.addRoutes({
      path: '/api/tickets/{ticketId}',
      methods: [HttpMethod.PUT, HttpMethod.DELETE],
      integration: ticketsIntegration,
    });
    api.addRoutes({
      path: '/api/tickets/groom',
      methods: [HttpMethod.POST],
      integration: ticketsIntegration,
    });
    api.addRoutes({
      path: '/api/tickets/merge',
      methods: [HttpMethod.POST],
      integration: ticketsIntegration,
    });

    api.addRoutes({
      path: '/api/sprints',
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration: sprintsIntegration,
    });
    api.addRoutes({
      path: '/api/sprints/{sprintId}',
      methods: [HttpMethod.PUT],
      integration: sprintsIntegration,
    });
    api.addRoutes({
      path: '/api/sprints/{sprintId}/complete',
      methods: [HttpMethod.POST],
      integration: sprintsIntegration,
    });

    api.addRoutes({
      path: '/api/settings',
      methods: [HttpMethod.GET, HttpMethod.PUT],
      integration: settingsIntegration,
    });

    new CfnOutput(this, 'ApiUrl', {
      value: api.apiEndpoint,
      description: 'HTTP API endpoint',
    });
  }
}
