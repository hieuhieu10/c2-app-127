import AppHeader from "@/components/layout/AppHeader";
import HistoryTable from "@/components/dashboard/HistoryTable";
import { getRecentAnalyses } from "@/lib/api/analyses";

export default async function HistoryPage() {
  const analyses = await getRecentAnalyses();

  return (
    <div className="app-screen">
      <AppHeader />
      <main className="page-content">
        <div className="section-copy">
          <h1>History</h1>
          <p>Browse processed papers and reopen any proposal workspace.</p>
        </div>
        <HistoryTable analyses={analyses} />
      </main>
    </div>
  );
}
