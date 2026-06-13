export async function createExport(format: "Summary" | "Slides" | "Infographic") {
  return {
    id: crypto.randomUUID(),
    format,
    status: "ready",
  };
}
