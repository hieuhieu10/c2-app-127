import AppHeader from "@/components/layout/AppHeader";
import RecentAnalysisList from "@/components/dashboard/RecentAnalysisList";
import { getRecentAnalyses } from "@/lib/api/analyses";

export default async function DashboardPage() {
  const analyses = await getRecentAnalyses();

  return (
    <div className="app-screen">
      <AppHeader />
      <RecentAnalysisList analyses={analyses} />
    </div>
  );
}
