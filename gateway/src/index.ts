import express from 'express';
import cors from 'cors';
import {ApolloServer} from '@apollo/server';
import {expressMiddleware} from '@apollo/server/express4';
import {typeDefs} from './schema';
import {resolvers} from './resolvers';
import {log} from './logger';
import {randomUUID} from 'crypto';

function htmlPage(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;font-family:Arial,sans-serif;background:#eef3f8;color:#17253a}.top{background:#10233b;color:white;padding:18px 24px}.top strong{color:#35c89a}.box{max-width:900px;margin:24px auto;background:white;border-radius:12px;padding:20px;border:1px solid #dde6ef}.links a{display:inline-block;margin:6px 6px 6px 0;padding:9px 12px;border-radius:8px;background:#daf3e9;color:#19765b;text-decoration:none}textarea{width:100%;min-height:180px;font-family:monospace;padding:12px;border:1px solid #cfdde9;border-radius:8px;box-sizing:border-box}button{margin-top:10px;border:0;border-radius:8px;padding:10px 14px;background:#1d8f70;color:white;cursor:pointer}pre{background:#10233b;color:#dcf8ed;padding:16px;border-radius:8px;overflow:auto}</style></head><body><div class="top"><strong>AegisVolt</strong> · ${title}</div><div class="box">${body}</div></body></html>`;
}

async function main(){
  const app=express();
  app.use(cors());
  app.use(express.json());
  app.get('/health',(_req,res)=>res.json({status:'ok',service:'gateway',env:process.env.APP_ENV||'dev'}));
  app.get('/',(_req,res)=>res.setHeader('Content-Type','text/html').send(htmlPage('Gateway',`<h1>GraphQL Gateway</h1><p>Ambiente: <b>${process.env.APP_ENV||'dev'}</b></p><div class="links"><a href="/graphql">Abrir GraphQL</a><a href="/health">Health JSON</a><a href="http://localhost:5173">Frontend</a></div>`)));

  const server=new ApolloServer({typeDefs,resolvers});
  await server.start();

  app.get('/graphql',(_req,res)=>res.setHeader('Content-Type','text/html').send(htmlPage('GraphQL Explorer',`<h1>GraphQL Explorer</h1><textarea id="q">{ stations { id name city } } </textarea><br><button id="run">Ejecutar consulta</button><pre id="result">Resultado aparecerá aquí</pre><script>document.getElementById('run').onclick=async()=>{const q=document.getElementById('q').value;const r=await fetch('/graphql',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q})});document.getElementById('result').textContent=JSON.stringify(await r.json(),null,2)};</script>`)));
  app.use('/graphql',expressMiddleware(server,{context:async({req})=>({correlationId:req.header('x-correlation-id')||randomUUID()})}));

  const port=Number(process.env.PORT||4000);
  app.listen(port,()=>log('info','gateway started',{step:'startup'}));
}
main().catch(error=>{console.error(error);process.exit(1)});
