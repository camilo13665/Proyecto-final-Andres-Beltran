import supertest from 'supertest';

const gatewayUrl='http://localhost:4000';
const reservationUrl='http://localhost:4001';
const billingUrl='http://localhost:4002';
const dispatchUrl='http://localhost:4003';

async function postJson(url:string,body:Record<string,unknown>){const r=await supertest(url).post(url.includes('4000')?'graphql':'').send(body);return r.status>=400?r:null}

describe('AegisVolt integration phase 11',()=>{
 jest.setTimeout(30000);
 it('gateway GraphQL stations query is real',async()=>{const r=await supertest(gatewayUrl).post('/graphql').send({query:'{ stations { id name city connectors { id status } } }'});expect(r.status).toBe(200);expect(r.body.errors).toBeUndefined();expect(r.body.data.stations.length).toBeGreaterThanOrEqual(3)});
 it('wallet GraphQL query is real',async()=>{const r=await supertest(gatewayUrl).post('/graphql').send({query:'{ wallet(fleetId:"fleet-001") { fleetId balanceCents } }'});expect(r.status).toBe(200);expect(r.body.errors).toBeUndefined();expect(r.body.data.wallet.fleetId).toBe('fleet-001')});
 it('reservation health responds',async()=>{const r=await supertest(reservationUrl).get('/health');expect(r.status).toBe(200);expect(r.body.status).toBe('ok')});
 it('billing health responds',async()=>{const r=await supertest(billingUrl).get('/health');expect(r.status).toBe(200);expect(r.body.status).toBe('ok')});
 it('dispatch health responds',async()=>{const r=await supertest(dispatchUrl).get('/health');expect(r.status).toBe(200);expect(r.body.status).toBe('ok')});
});
