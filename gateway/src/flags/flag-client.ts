import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

export type FeatureFlagName =
  | 'ENABLE_DYNAMIC_SURGE_PRICING'
  | 'ENABLE_FAST_CHARGE_BOOST'
  | 'SIMULATE_CHARGER_HARDWARE_FAULT';

export class FeatureFlagClient {
  private readonly cache = new Map<string, { enabled: boolean; expiresAt: number }>();

  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly ttlMs = Number(process.env.FLAG_CACHE_TTL_MS || 3000),
  ) {}

  async isEnabled(name: FeatureFlagName): Promise<boolean> {
    const cached = this.cache.get(name);
    if (cached && cached.expiresAt > Date.now()) return cached.enabled;

    const result = await this.db.send(new GetCommand({
      TableName: this.tableName,
      Key: { pk: name, sk: 'CURRENT' },
    }));
    const enabled = result.Item?.enabled === true;
    this.cache.set(name, { enabled, expiresAt: Date.now() + this.ttlMs });
    return enabled;
  }

  invalidate(name: FeatureFlagName): void {
    this.cache.delete(name);
  }

  async set(name: FeatureFlagName, enabled: boolean, updatedBy = 'graphql'): Promise<void> {
    await this.db.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        pk: name,
        sk: 'CURRENT',
        enabled,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      },
    }));
    this.invalidate(name);
  }
}
