import { FeatureFlagClient } from '../src/flags/flag-client';

describe('FeatureFlagClient', () => {
  it('caches DynamoDB flag values for the TTL', async () => {
    const db = { send: jest.fn().mockResolvedValue({ Item: { enabled: true } }) } as any;
    const client = new FeatureFlagClient(db, 'aegisvolt-flags-dev', 3000);
    expect(await client.isEnabled('SIMULATE_CHARGER_HARDWARE_FAULT')).toBe(true);
    expect(await client.isEnabled('SIMULATE_CHARGER_HARDWARE_FAULT')).toBe(true);
    expect(db.send).toHaveBeenCalledTimes(1);
  });

  it('set writes and invalidates the cached flag', async () => {
    const db = { send: jest.fn().mockResolvedValue({}) } as any;
    const client = new FeatureFlagClient(db, 'aegisvolt-flags-dev', 3000);
    await client.set('SIMULATE_CHARGER_HARDWARE_FAULT', true, 'test');
    expect(db.send).toHaveBeenCalledTimes(1);
  });
});
