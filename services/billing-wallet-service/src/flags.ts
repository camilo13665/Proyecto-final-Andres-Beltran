import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

export class FeatureFlagClient {
  private cached: { enabled: boolean; expiresAt: number } | undefined;
  constructor(private readonly db: DynamoDBDocumentClient, private readonly tableName: string, private readonly ttlMs = Number(process.env.FLAG_CACHE_TTL_MS || 3000)) {}
  async isEnabled(name: string): Promise<boolean> {
    if (this.cached && this.cached.expiresAt > Date.now()) return this.cached.enabled;
    const result = await this.db.send(new GetCommand({ TableName: this.tableName, Key: { pk: name, sk: 'CURRENT' } }));
    this.cached = { enabled: result.Item?.enabled === true, expiresAt: Date.now() + this.ttlMs };
    return this.cached.enabled;
  }
}
