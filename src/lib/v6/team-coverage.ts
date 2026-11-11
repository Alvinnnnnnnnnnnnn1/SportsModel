import type { RawEvidence } from './evidence.server';
import { sha256 } from '@/lib/imports/duplicates';
/** Completeness is proven from a retained pagination chain, not a UI count. */
export async function regularSeasonCoverage(sources:RawEvidence[],season:number,at:string){
 const candidates=sources.filter(e=>{const u=new URL(e.sourceUrl);return e.provider==='balldontlie'&&u.origin==='https://api.balldontlie.io'&&u.pathname==='/v1/games'&&u.searchParams.get('seasons[]')===String(season)&&u.searchParams.get('season_type')==='regular'&&!u.searchParams.has('start_date')&&Date.parse(e.retrievedAt)<=Date.parse(at);}).sort((a,b)=>b.retrievedAt.localeCompare(a.retrievedAt));
 const first=candidates.find(e=>!new URL(e.sourceUrl).searchParams.has('cursor')&&(new URL(e.sourceUrl).searchParams.get('end_date')===at.slice(0,10)||!new URL(e.sourceUrl).searchParams.has('end_date')));
 if(!first)return {complete:false,reason:'full_regular_season_start_receipt_missing',receiptIds:[],games:0};
 const query=new URL(first.sourceUrl).searchParams;let page:RawEvidence|undefined=first;const seen=new Set<string>(),receipts:string[]=[],gameIds=new Set<string>();
 for(let i=0;i<20;i++){
  if(!page||await sha256(page.raw)!==page.hash)return {complete:false,reason:'pagination_receipt_missing_or_invalid',receiptIds:receipts,games:gameIds.size};
  const body=JSON.parse(page.raw);if(!Array.isArray(body.data)||!body.meta||body.meta.per_page!==100)return {complete:false,reason:'pagination_metadata_missing',receiptIds:receipts,games:gameIds.size};
  const currentCursor=new URL(page.sourceUrl).searchParams.get('cursor');if(currentCursor!==null&&String(body.meta.prev_cursor)!==currentCursor)return {complete:false,reason:'pagination_cursor_scope_mismatch',receiptIds:receipts,games:gameIds.size};
  for(const g of body.data){if(gameIds.has(String(g.id)))return {complete:false,reason:'overlapping_game_pages',receiptIds:receipts,games:gameIds.size};gameIds.add(String(g.id));}
  receipts.push(page.id);const next=body.meta.next_cursor;
  if(next===null||next===undefined&&body.data.length<100)return {complete:true,reason:null,receiptIds:receipts,games:gameIds.size,through:query.get('end_date')};
  if(!Number.isSafeInteger(next)||seen.has(String(next)))return {complete:false,reason:'invalid_replayed_cursor',receiptIds:receipts,games:gameIds.size};seen.add(String(next));
  page=candidates.find(e=>{const u=new URL(e.sourceUrl);return u.searchParams.get('cursor')===String(next)&&u.searchParams.get('end_date')===query.get('end_date')&&Math.abs(Date.parse(e.retrievedAt)-Date.parse(first.retrievedAt))<1800000;});
 }
 return {complete:false,reason:'bounded_pagination_exceeded',receiptIds:receipts,games:gameIds.size};
}
