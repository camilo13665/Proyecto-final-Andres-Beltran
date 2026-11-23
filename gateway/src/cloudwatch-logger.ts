import { CloudWatchLogsClient, CreateLogStreamCommand, DescribeLogStreamsCommand, PutLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const service = 'gateway';
const env = process.env.APP_ENV || 'dev';
const logGroup = process.env.LOG_GROUP || `/aegisvolt/${env}/${service}`;
const stream = `${service}-${process.env.HOSTNAME || 'local'}-${Date.now()}`;
const client = new CloudWatchLogsClient({ region: process.env.AWS_REGION || 'us-east-1', endpoint: process.env.AWS_ENDPOINT_URL || 'http://localhost:4566', credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test', secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test' } });
let sequenceToken: string | undefined;
let initialized = false;

async function initialize() {
  if (initialized) return;
  try {
    const streams = await client.send(new DescribeLogStreamsCommand({ logGroupName: logGroup, logStreamNamePrefix: stream, limit: 1 }));
    if (!streams.logStreams?.some(item => item.logStreamName === stream)) await client.send(new CreateLogStreamCommand({ logGroupName: logGroup, logStreamName: stream }));
    initialized = true;
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', message: 'cloudwatch_log_init_failed', error: String(error) }));
  }
}

export async function emitCloudWatch(record: Record<string, unknown>) {
  await initialize();
  if (!initialized) return;
  try {
    const result = await client.send(new PutLogEventsCommand({ logGroupName: logGroup, logStreamName: stream, sequenceToken, logEvents: [{ timestamp: Date.parse(String(record.timestamp)), message: JSON.stringify(record) }] }));
    sequenceToken = result.nextSequenceToken;
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', message: 'cloudwatch_put_failed', error: String(error) }));
  }
}
