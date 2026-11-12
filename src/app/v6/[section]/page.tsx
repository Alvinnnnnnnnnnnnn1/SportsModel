import { notFound } from 'next/navigation';
import { V6DashboardView } from '@/components/v6/dashboard';
import { v6Sections } from '@/lib/v6/dashboard';
export default async function Page({params}:{params:Promise<{section:string}>}){
 const {section}=await params;const found=v6Sections.find(s=>s.id===section&&s.id!=='overview');
 if(!found)notFound();return <V6DashboardView section={found.id}/>;
}
