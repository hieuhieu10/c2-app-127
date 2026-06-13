import { redirect } from "next/navigation";
import { getRecentAnalyses } from "@/lib/api/analyses";

export default async function ExportPage() {
  const analyses = await getRecentAnalyses();
  redirect(`/export/${analyses[0].id}`);
}
