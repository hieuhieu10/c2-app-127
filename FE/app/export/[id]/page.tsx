import ExportOptions from "@/components/export/ExportOptions";
import { getAnalysisById, getRecentAnalyses } from "@/lib/api/analyses";

export async function generateStaticParams() {
  const analyses = await getRecentAnalyses();
  return analyses.map((analysis) => ({ id: analysis.id }));
}

type ExportPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ExportPage({ params }: ExportPageProps) {
  const { id } = await params;
  const analysis = await getAnalysisById(id);
  return <ExportOptions analysis={analysis} />;
}
