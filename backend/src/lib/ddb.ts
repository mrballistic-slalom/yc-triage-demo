import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const region = process.env.AWS_REGION ?? 'us-west-2';

const raw = new DynamoDBClient({ region });
export const ddb = DynamoDBDocumentClient.from(raw, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});

export const TABLES = {
  tickets: process.env.TICKETS_TABLE ?? 'TriageTickets',
  sprints: process.env.SPRINTS_TABLE ?? 'TriageSprints',
  settings: process.env.SETTINGS_TABLE ?? 'TriageSettings',
};

export const SETTINGS_KEY = 'singleton';
