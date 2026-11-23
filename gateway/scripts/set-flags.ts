import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const env = process.env.APP_ENV || 'dev';
const endpoint = process.env.AWS_ENDPOINT_URL || 'http://localhost:4566';
const region = process.env.AWS_REGION || 'us-east-1';
const table = `aegisvolt-flags-${env}`;
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region, endpoint, credentials: { accessKeyId: 'test', secretAccessKey: 'test' } }));
const defaults = env === 'dev'
  ? { ENABLE_DYNAMIC_SURGE_PRICING: true, ENABLE_FAST_CHARGE_BOOST: true, SIMULATE_CHARGER_HARDWARE_FAULT: false }
  : env === 'test'
    ? { ENABLE_DYNAMIC_SURGE_PRICING: true, ENABLE_FAST_CHARGE_BOOST: false, SIMULATE_CHARGER_HARDWARE_FAULT: false }
    : { ENABLE_DYNAMIC_SURGE_PRICING: false, ENABLE_FAST_CHARGE_BOOST: false, SIMULATE_CHARGER_HARDWARE_FAULT: false };

async function main() {
  for (const [name, enabled] of Object.entries(defaults)) {
    await db.send(new PutCommand({ TableName: table, Item: { pk: name, sk: 'CURRENT', enabled, updated_at: new Date().toISOString(), updated_by: 'defaults-script' } }));
  }
  console.log(JSON.stringify({ env, table, flags: defaults }));
}
main().catch(error => { console.error(error); process.exit(1); });
