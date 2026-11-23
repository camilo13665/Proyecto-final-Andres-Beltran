import request from 'supertest';
import app from '../src';
describe('billing wallet',()=>{it('reports health',async()=>{const r=await request(app).get('/health');expect(r.status).toBe(200);expect(r.body.service).toBe('billing-wallet')});it('rejects invalid topup',async()=>{const r=await request(app).post('/wallets/fleet-001/topup').send({amount_cents:-1});expect(r.status).toBe(400);expect(r.body.error).toBe('INVALID_AMOUNT')});});
