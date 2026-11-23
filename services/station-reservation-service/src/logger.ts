import {emitCloudWatch} from './cloudwatch-logger';
export type LogFields={correlation_id?:string;saga_id?:string;step?:string};
export function log(level:string,message:string,fields:LogFields={}){
 const record={timestamp:new Date().toISOString(),level,env:process.env.APP_ENV||'dev',service:'station-reservation',correlation_id:fields.correlation_id||'-',saga_id:fields.saga_id||'-',step:fields.step||'-',message};
 console.log(JSON.stringify(record));
 void emitCloudWatch(record);
}
