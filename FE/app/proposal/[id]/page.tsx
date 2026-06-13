import ProposalWorkspace from "@/components/analysis/ProposalWorkspace";
import { getAnalysisById, getRecentAnalyses } from "@/lib/api/analyses";

export async function generateStaticParams() {
  const analyses = await getRecentAnalyses();
  return analyses.map((analysis) => ({ id: analysis.id }));
}

type ProposalPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProposalPage({ params }: ProposalPageProps) {
  const { id } = await params;
  const analysis = await getAnalysisById(id);
  return <ProposalWorkspace analysis={analysis} />;
}
