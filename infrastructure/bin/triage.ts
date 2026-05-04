#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { TriageStack } from '../lib/triage-stack';

const app = new App();

new TriageStack(app, 'TriageStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-west-2',
  },
  description: 'Triage — AI-native project tracker',
});
