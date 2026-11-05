import { handleSportsRequest } from '@/lib/sports/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = handleSportsRequest;
