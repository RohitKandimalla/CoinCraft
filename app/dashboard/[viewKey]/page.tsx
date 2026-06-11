import { DashboardPage } from '@/components/DashboardPage';

interface DashboardByViewPageProps {
  params: Promise<{
    viewKey: string;
  }>;
}

export default async function DashboardByViewPage({ params }: DashboardByViewPageProps) {
  const resolvedParams = await params;
  return <DashboardPage initialViewKey={decodeURIComponent(resolvedParams.viewKey || 'overall')} />;
}

