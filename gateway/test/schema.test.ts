import {typeDefs} from '../src/schema';
describe('GraphQL schema',()=>{it('contains required queries and mutations',()=>{const text=typeDefs.loc?.source.body||'';expect(text).toContain('reserveAndActivateCharge');expect(text).toContain('featureFlags');expect(text).toContain('setFeatureFlag');expect(text).toContain('stopCharge')});});
