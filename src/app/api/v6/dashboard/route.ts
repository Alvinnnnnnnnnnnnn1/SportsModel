import { handleV6DashboardRequest } from '@/lib/v6/dashboard-access.server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return handleV6DashboardRequest(request);}
