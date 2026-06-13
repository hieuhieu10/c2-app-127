export async function uploadPaper(file: File) {
  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    status: "uploaded",
  };
}
