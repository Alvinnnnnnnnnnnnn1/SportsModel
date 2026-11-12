import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
export const workerCredentialSchema=z.object({credentialId:z.string().uuid(),ownerId:z.string().uuid(),credential:z.string().regex(/^edgelab_v6_[a-f0-9]{64}$/),scope:z.enum(['research_only','paper_worker']),expiresAt:z.string().datetime({offset:true})}).strict();
export type WorkerCredential=z.infer<typeof workerCredentialSchema>;
/** Native JSON SyntaxError can include a secret-bearing input excerpt. */
export function decodePrivateV6Json(text:string):unknown{try{return JSON.parse(text) as unknown;}catch{throw new Error('Private V6 JSON is invalid; contents omitted');}}
const metadata=z.object({credentialId:z.string().uuid(),scope:z.enum(['research_only','paper_worker']),createdAt:z.string().datetime({offset:true}),expiresAt:z.string().datetime({offset:true}),revokedAt:z.string().datetime({offset:true}).nullable()}).strict();
async function owner(client:SupabaseClient,id:string){const {data,error}=await client.auth.getUser();if(error||data.user?.id!==id)throw new Error('Existing authenticated owner session required');}
export async function issueWorkerCredential(client:SupabaseClient,id:string,scope:WorkerCredential['scope'],rotateFrom:string|null=null){
 await owner(client,id);const {data,error}=await client.rpc('v6_issue_worker_credential',{expected_owner:id,capability_scope:scope,valid_hours:720,rotate_from:rotateFrom});
 if(error)throw new Error('V6 credential creation rejected; verify approved schema and owner access');const credential=workerCredentialSchema.parse(data);if(credential.ownerId!==id)throw new Error('Credential owner changed');return credential;
}
export async function listWorkerCredentials(client:SupabaseClient,id:string){await owner(client,id);const {data,error}=await client.rpc('v6_list_worker_credentials',{expected_owner:id});if(error)throw new Error('V6 credential schema unavailable or access rejected');return z.array(metadata).parse(data);}
export async function revokeWorkerCredential(client:SupabaseClient,id:string,credentialId:string){await owner(client,id);const {data,error}=await client.rpc('v6_revoke_worker_credential',{expected_owner:id,credential_id:z.string().uuid().parse(credentialId)});if(error)throw new Error('V6 credential revocation rejected');return data===true;}
