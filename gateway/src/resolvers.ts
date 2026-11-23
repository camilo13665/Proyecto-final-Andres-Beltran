import axios from 'axios';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,GetCommand,PutCommand,ScanCommand,QueryCommand} from '@aws-sdk/lib-dynamodb';
import { SagaOrchestrator } from './saga/orchestrator';
import { randomUUID } from 'crypto';
import { FeatureFlagClient } from './flags/flag-client';

const reservationUrl=process.env.RESERVATION_URL||'http://localhost:4001';
const billingUrl=process.env.BILLING_URL||'http://localhost:4002';
const dispatchUrl=process.env.DISPATCH_URL||'http://localhost:4003';
const env=process.env.APP_ENV||'dev';
const sagasTable=`aegisvolt-sagas-${env}`,flagsTable=`aegisvolt-flags-${env}`;
const client=DynamoDBDocumentClient.from(new DynamoDBClient({region:process.env.AWS_REGION||'us-east-1',endpoint:process.env.AWS_ENDPOINT_URL||'http://localhost:4566',credentials:{accessKeyId:process.env.AWS_ACCESS_KEY_ID||'test',secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY||'test'}}));
const flagClient=new FeatureFlagClient(client,flagsTable);
const toSaga=(i:any)=>({id:i.pk?.replace('SAGA#',''),status:i.status,fleetId:i.fleet_id||'',stationId:i.station_id||'',connectorId:i.connector_id||'',correlationId:i.correlation_id||'',failureReason:i.failure_reason,createdAt:i.created_at,updatedAt:i.updated_at,compensations:i.compensations||[]});
export const resolvers={
 Query:{
  environment:async()=>{const r=await client.send(new ScanCommand({TableName:flagsTable}));return{name:env,flags:(r.Items||[]).map((i:any)=>({name:i.pk,enabled:i.enabled,updatedAt:i.updated_at}))};},
  stations:async()=>{const r=await axios.get(`${reservationUrl}/stations`);return r.data;},
  station:async(_:unknown,{id}:{id:string})=>{const r=await axios.get(`${reservationUrl}/stations/${id}/connectors`);if(!r.data)return null;const station=await axios.get(`${reservationUrl}/stations`);return station.data.find((s:any)=>s.id===id)||null;},
  wallet:async(_:unknown,{fleetId}:{fleetId:string})=>{const r=await axios.get(`${billingUrl}/wallets/${fleetId}`);return {fleetId:r.data.fleet_id,balanceCents:r.data.balance_cents};},
  telemetry:async(_:unknown,{sessionId}:{sessionId:string})=>{const r=await axios.get(`${dispatchUrl}/sessions/${sessionId}/telemetry`);return r.data.map((p:any)=>({timestamp:p.timestamp,kwh:p.kwh,powerKw:p.powerKw}));},
  sagas:async(_:unknown,{fleetId,limit}:{fleetId?:string;limit:number})=>{const r=await client.send(new ScanCommand({TableName:sagasTable,FilterExpression:'sk = :meta',ExpressionAttributeValues:{':meta':'META'}}));const items=(r.Items||[]).filter((i:any)=>!fleetId||i.fleet_id===fleetId).slice(0,limit);return items.map(toSaga);},
  saga:async(_:unknown,{id}:{id:string})=>{const r=await client.send(new GetCommand({TableName:sagasTable,Key:{pk:`SAGA#${id}`,sk:'META'}}));return r.Item?toSaga(r.Item):null;},
  featureFlags:async()=>{const r=await client.send(new ScanCommand({TableName:flagsTable}));return(r.Items||[]).map((i:any)=>({name:i.pk,enabled:i.enabled,updatedAt:i.updated_at}))}
 },
 Mutation:{
  setFeatureFlag:async(_:unknown,{name,enabled}:{name:string;enabled:boolean})=>{const allowed=['ENABLE_DYNAMIC_SURGE_PRICING','ENABLE_FAST_CHARGE_BOOST','SIMULATE_CHARGER_HARDWARE_FAULT'];if(!allowed.includes(name))throw new Error(`Unknown feature flag: ${name}`);await flagClient.set(name as any,enabled,'graphql');return{name,enabled,updatedAt:new Date().toISOString()};},
  topUpWallet:async(_:unknown,{fleetId,amountCents}:{fleetId:string;amountCents:number})=>{const r=await axios.post(`${billingUrl}/wallets/${fleetId}/topup`,{amount_cents:amountCents});return {fleetId:r.data.fleet_id,balanceCents:r.data.balance_cents};},
  reserveAndActivateCharge:async(_:unknown,{input}:{input:{fleetId:string;stationId:string;connectorId:string;estimatedKwh:number}},context:{correlationId?:string})=>{const correlationId=context?.correlationId||randomUUID();const orchestrator=new SagaOrchestrator({db:client,http:axios,tableName:sagasTable});return orchestrator.execute(input,correlationId);},
  stopCharge:async(_:unknown,{sagaId}:{sagaId:string},context:{correlationId?:string})=>{const correlationId=context?.correlationId||randomUUID();const existing=await client.send(new GetCommand({TableName:sagasTable,Key:{pk:`SAGA#${sagaId}`,sk:'META'}}));if(!existing.Item)return Promise.reject(new Error('SAGA_NOT_FOUND'));await axios.post(`${dispatchUrl}/sessions/${sagaId}/stop`,{}, {headers:{'x-correlation-id':correlationId}});const released=await axios.post(`${reservationUrl}/reservations/${sagaId}/release`,{}, {headers:{'x-correlation-id':correlationId}});existing.Item.updated_at=new Date().toISOString();existing.Item.stop_result=released.data;await client.send(new PutCommand({TableName:sagasTable,Item:existing.Item}));await client.send(new PutCommand({TableName:sagasTable,Item:{pk:`SAGA#${sagaId}`,sk:`EVENT#${existing.Item.updated_at}#STOPPED`,step:'STOPPED',outcome:'AVAILABLE'}}));return toSaga(existing.Item);}
 }
};
