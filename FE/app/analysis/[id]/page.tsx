import { redirect } from "next/navigation";

type AnalysisPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { id } = await params;
  redirect(`/proposal/${id}`);
}
