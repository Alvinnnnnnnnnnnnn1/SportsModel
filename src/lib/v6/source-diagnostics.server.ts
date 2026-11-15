import path from 'node:path';
import {atomicPrivateJson} from './evidence.server';
/** Do not retain error.message, stack, headers or request URLs: transports may
 * include API credentials. Only fixed error names/codes are safe diagnostics. */
export async function retainTransportFailure(root:string,provider:string,endpoint:string,error:unknown,startedAt:number,failedAt:number){
 const e=error as {name?:string;code?:string;cause?:{code?:string}},codes=new Set(['ENOTFOUND','EAI_AGAIN','ECONNRESET','ECONNREFUSED','ETIMEDOUT','ENETUNREACH','EHOSTUNREACH','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_SOCKET','ABORT_ERR']);
 const code=e?.code??e?.cause?.code,id=crypto.randomUUID();
 await atomicPrivateJson(path.join(root,'source-failures',id+'.json'),{format:'edgelab.source-transport-failure',version:1,id,provider,endpoint: new URL(endpoint,'https://invalid.example').pathname,startedAt:new Date(startedAt).toISOString(),failedAt:new Date(failedAt).toISOString(),elapsedMs:Math.max(0,failedAt-startedAt),name:['TypeError','TimeoutError','AbortError'].includes(e?.name??'')?e.name:'Error',code:code&&codes.has(code)?code:null,reservationRetained:true,retried:false});return id;
}
