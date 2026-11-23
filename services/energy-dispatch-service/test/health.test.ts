import request from 'supertest';
import app from '../src';
describe('energy dispatch',()=>{it('reports health',async()=>{const r=await request(app).get('/health');expect(r.status).toBe(200);expect(r.body.service).toBe('energy-dispatch')});it('rejects invalid session',async()=>{const r=await request(app).post('/sessions').send({});expect(r.status).toBe(400);expect(r.body.error).toBe('INVALID_REQUEST')});});
