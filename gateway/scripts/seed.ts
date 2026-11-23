import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,PutCommand} from '@aws-sdk/lib-dynamodb';
const env=process.env.APP_ENV||'dev';
const endpoint=process.env.AWS_ENDPOINT_URL||'http://localhost:4566';
const region=process.env.AWS_REGION||'us-east-1';
const ddb=DynamoDBDocumentClient.from(new DynamoDBClient({region,endpoint,credentials:{accessKeyId:'test',secretAccessKey:'test'}}));
const put=async(table:string,item:Record<string,unknown>)=>ddb.send(new PutCommand({TableName:table,Item:item}));
const reservations=`aegisvolt-reservations-${env}`,billing=`aegisvolt-billing-${env}`,flags=`aegisvolt-flags-${env}`;
const stations=[{id:'station-001',name:'Centro Norte',city:'Bogotá',connectors:[['connector-001','AC',22],['connector-002','AC',22],['connector-003','DC',150],['connector-004','DC',150]]},{id:'station-002',name:'Parque Sur',city:'Bogotá',connectors:[['connector-005','AC',22],['connector-006','AC',22],['connector-007','DC',150],['connector-008','DC',150]]},{id:'station-003',name:'Terminal Aeropuerto',city:'Bogotá',connectors:[['connector-009','AC',22],['connector-010','AC',22],['connector-011','DC',150],['connector-012','DC',150]]}];

async function main() {
for (const station of stations) {
  await put(reservations, { pk: `STATION#${station.id}`, sk: 'META', name: station.name, city: station.city, connectors_count: 4 });
  for (const [id, type, power] of station.connectors) {
    await put(reservations, { pk: `STATION#${station.id}`, sk: `CONNECTOR#${id}`, status: 'AVAILABLE', type, power_kw: power, updated_at: new Date().toISOString() });
  }
}
await put(billing, { pk: 'FLEET#fleet-001', sk: 'WALLET', balance_cents: 50000, updated_at: new Date().toISOString() });
const defaults = env === 'prod'
  ? { ENABLE_DYNAMIC_SURGE_PRICING: false, ENABLE_FAST_CHARGE_BOOST: false, SIMULATE_CHARGER_HARDWARE_FAULT: false }
  : env === 'test'
    ? { ENABLE_DYNAMIC_SURGE_PRICING: true, ENABLE_FAST_CHARGE_BOOST: false, SIMULATE_CHARGER_HARDWARE_FAULT: false }
    : { ENABLE_DYNAMIC_SURGE_PRICING: true, ENABLE_FAST_CHARGE_BOOST: true, SIMULATE_CHARGER_HARDWARE_FAULT: false };
for (const [name, enabled] of Object.entries(defaults)) {
  await put(flags, { pk: name, sk: 'CURRENT', enabled, updated_at: new Date().toISOString(), updated_by: 'seed' });
}
console.log(JSON.stringify({ seeded: true, env, reservations, billing, flags }));
}
main().catch((error) => { console.error(error); process.exit(1); });
