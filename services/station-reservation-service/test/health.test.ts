import request from 'supertest';
import app from '../src';
describe('station reservation',()=>{it('reports health',async()=>{const r=await request(app).get('/health');expect(r.status).toBe(200);expect(r.body.service).toBe('station-reservation')});it('rejects invalid reservation',async()=>{const r=await request(app).post('/reservations').send({});expect(r.status).toBe(400);expect(r.body.error).toBe('INVALID_REQUEST')});});
