import { DashboardPage } from '@/components/DashboardPage';

interface DashboardByViewPageProps {
  params: {
    viewKey: string;
  };
}

export default function DashboardByViewPage({ params }: DashboardByViewPageProps) {
  return <DashboardPage initialViewKey={decodeURIComponent(params.viewKey || 'overall')} />;
}

