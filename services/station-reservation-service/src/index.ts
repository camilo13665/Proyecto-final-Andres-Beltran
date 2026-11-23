import express,{Request,Response,NextFunction} from 'express';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,GetCommand,PutCommand,QueryCommand,ScanCommand,UpdateCommand} from '@aws-sdk/lib-dynamodb';
import {log} from './logger';
import { FeatureFlagClient } from './flags';

const app=express(); app.use(express.json());
const env=process.env.APP_ENV||'dev';
const table=`aegisvolt-reservations-${env}`;
const client=DynamoDBDocumentClient.from(new DynamoDBClient({region:process.env.AWS_REGION||'us-east-1',endpoint:process.env.AWS_ENDPOINT_URL||'http://localhost:4566',credentials:{accessKeyId:process.env.AWS_ACCESS_KEY_ID||'test',secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY||'test'}}));
const flagsTable=`aegisvolt-flags-${env}`;
const flagClient=new FeatureFlagClient(client,flagsTable);

app.use((req,_res,next)=>{(req as any).correlationId=req.header('x-correlation-id')||'-';next();});
app.get('/health',(_req,res)=>res.json({status:'ok',service:'station-reservation',env}));
app.get('/',(_req,res)=>res.setHeader('Content-Type','text/html').send(`<!doctype html><html><head><meta charset="utf-8"><title>Station Reservation</title><style>body{font-family:Arial,sans-serif;margin:0;background:#eef3f8}.top{background:#10233b;color:white;padding:18px 24px}.top b{color:#35c89a}.box{max-width:900px;margin:24px auto;background:white;padding:20px;border-radius:12px;border:1px solid #dde6ef}a{display:inline-block;margin:6px;padding:10px 14px;border-radius:8px;background:#daf3e9;color:#19765b;text-decoration:none}</style></head><body><div class="top"><b>AegisVolt</b> · Station Reservation</div><div class="box"><h1>Reservation Service</h1><p>Ambiente: ${env}</p><a href="/health">Health</a><a href="/stations">Estaciones</a></div></body></html>`));

app.get('/stations',async(req,res)=>{
 try{
  const result=await client.send(new ScanCommand({TableName:table,FilterExpression:'sk = :meta',ExpressionAttributeValues:{':meta':'META'}}));
  const stations=[] as any[];
  for(const station of result.Items||[]){
   const cons=await client.send(new QueryCommand({TableName:table,KeyConditionExpression:'pk = :pk AND begins_with(sk,:prefix)',ExpressionAttributeValues:{':pk':station.pk,':prefix':'CONNECTOR#'}}));
   stations.push({id:station.pk.replace('STATION#',''),name:station.name,city:station.city,connectors:(cons.Items||[]).map((c:any)=>({id:c.sk.replace('CONNECTOR#',''),stationId:station.pk.replace('STATION#',''),type:c.type,powerKw:c.power_kw,status:c.status}))});
  }
  log('info','stations listed',{correlation_id:(req as any).correlationId,step:'query'}); res.json(stations);
 }catch(error){res.status(500).json({error:'INTERNAL_ERROR',message:String(error)});}
});

app.get('/stations/:stationId/connectors',async(req,res)=>{
 try{const pk=`STATION#${req.params.stationId}`;const result=await client.send(new QueryCommand({TableName:table,KeyConditionExpression:'pk = :pk AND begins_with(sk,:prefix)',ExpressionAttributeValues:{':pk':pk,':prefix':'CONNECTOR#'}}));res.json((result.Items||[]).map((c:any)=>({id:c.sk.replace('CONNECTOR#',''),stationId:req.params.stationId,type:c.type,powerKw:c.power_kw,status:c.status})));}catch(error){res.status(500).json({error:'INTERNAL_ERROR',message:String(error)});}
});

app.post('/reservations',async(req,res)=>{
 const {saga_id,station_id,connector_id,fleet_id}=req.body;
 if(!saga_id||!station_id||!connector_id||!fleet_id)return res.status(400).json({error:'INVALID_REQUEST',message:'Missing reservation fields'});
 const pk=`STATION#${station_id}`,sk=`CONNECTOR#${connector_id}`;
 try{
  const existing=await client.send(new GetCommand({TableName:table,Key:{pk:`SAGA#${saga_id}`,sk:'RESERVATION'}}));
  if(existing.Item)return res.status(200).json({reservation_id:existing.Item.reservation_id,status:'RESERVED'});
  const current=await client.send(new GetCommand({TableName:table,Key:{pk,sk}}));
  if(!current.Item||!['AVAILABLE','RESERVED'].includes(current.Item.status)||current.Item.saga_id&&current.Item.saga_id!==saga_id){return res.status(409).json({error:'CONNECTOR_UNAVAILABLE',message:'Connector is not available'});}
  const fastChargeEnabled=await flagClient.isEnabled('ENABLE_FAST_CHARGE_BOOST');
  if(Number(current.Item.power_kw)>=150&&!fastChargeEnabled)return res.status(409).json({error:'FAST_CHARGE_BOOST_DISABLED',message:'Fast charge boost is disabled in this environment'});
  const lockExpires=new Date(Date.now()+5*60*1000).toISOString();
  await client.send(new PutCommand({TableName:table,Item:{pk,sk,status:'RESERVED',type:current.Item.type,power_kw:current.Item.power_kw,saga_id,fleet_id,lock_expires_at:lockExpires,updated_at:new Date().toISOString()},ConditionExpression:'attribute_not_exists(pk) OR #status = :available OR saga_id = :sid',ExpressionAttributeNames:{'#status':'status'},ExpressionAttributeValues:{':available':'AVAILABLE',':sid':saga_id}}));
  await client.send(new PutCommand({TableName:table,Item:{pk:`SAGA#${saga_id}`,sk:'RESERVATION',reservation_id:`${station_id}-${connector_id}-${saga_id}`,station_id,connector_id,status:'RESERVED',fleet_id}}));
  log('info','connector reserved',{correlation_id:(req as any).correlationId,saga_id,step:'reservation'});res.status(201).json({reservation_id:`${station_id}-${connector_id}-${saga_id}`,status:'RESERVED'});
 }catch(error:any){if(error.name==='ConditionalCheckFailedException')return res.status(409).json({error:'CONNECTOR_UNAVAILABLE',message:'Connector is not available'});res.status(500).json({error:'INTERNAL_ERROR',message:String(error)});}
});

app.post('/reservations/:sagaId/confirm',async(req,res)=>{const saga=await client.send(new GetCommand({TableName:table,Key:{pk:`SAGA#${req.params.sagaId}`,sk:'RESERVATION'}}));if(!saga.Item)return res.status(404).json({error:'RESERVATION_NOT_FOUND',message:'Saga reservation not found'});await client.send(new UpdateCommand({TableName:table,Key:{pk:`STATION#${saga.Item.station_id}`,sk:`CONNECTOR#${saga.Item.connector_id}`},UpdateExpression:'SET #s = :inuse, updated_at = :now',ExpressionAttributeNames:{'#s':'status'},ExpressionAttributeValues:{':inuse':'IN_USE',':now':new Date().toISOString()}}));res.json({status:'IN_USE'});});

app.post('/reservations/:sagaId/release',async(req,res)=>{const saga=await client.send(new GetCommand({TableName:table,Key:{pk:`SAGA#${req.params.sagaId}`,sk:'RESERVATION'}}));if(!saga.Item)return res.status(404).json({error:'RESERVATION_NOT_FOUND',message:'Saga reservation not found'});if(saga.Item.status==='RELEASED')return res.json({status:'AVAILABLE',already_released:true});await client.send(new UpdateCommand({TableName:table,Key:{pk:`STATION#${saga.Item.station_id}`,sk:`CONNECTOR#${saga.Item.connector_id}`},UpdateExpression:'SET #s = :available, updated_at = :now REMOVE saga_id, fleet_id, lock_expires_at',ExpressionAttributeNames:{'#s':'status'},ExpressionAttributeValues:{':available':'AVAILABLE',':now':new Date().toISOString()}}));await client.send(new UpdateCommand({TableName:table,Key:{pk:`SAGA#${req.params.sagaId}`,sk:'RESERVATION'},UpdateExpression:'SET #s = :released',ExpressionAttributeNames:{'#s':'status'},ExpressionAttributeValues:{':released':'RELEASED'}}));log('info','connector released',{correlation_id:(req as any).correlationId,saga_id:req.params.sagaId,step:'release'});res.json({status:'AVAILABLE',already_released:false});});

app.use((error:any,_req:Request,res:Response,_next:NextFunction)=>res.status(500).json({error:'INTERNAL_ERROR',message:error.message||'Unexpected error'}));
const port=Number(process.env.PORT||4001); if(require.main===module)app.listen(port,()=>log('info','service started',{step:'startup'}));
export default app;
