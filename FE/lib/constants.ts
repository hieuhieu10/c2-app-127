export const PROCESSING_STEPS = [
  {
    label: "Parsing document structure",
    detail: "Extracting sections, figures, and references",
  },
  {
    label: "Identifying key claims",
    detail: "Detecting the problem, method, and findings",
  },
  {
    label: "Generating proposal draft",
    detail: "Writing plain-language sections",
  },
  {
    label: "Running faithfulness check",
    detail: "Grounding each claim to a source passage",
  },
] as const;

export const DEPTH_OPTIONS = ["Brief", "Standard", "Detailed"] as const;

export const EXPORT_FORMATS = [
  {
    id: "summary",
    title: "Summary",
    description: "One-page plain-language brief with all sections",
  },
  {
    id: "slides",
    title: "Slides",
    description: "Section-by-section deck for presenting",
  },
  {
    id: "infographic",
    title: "Infographic",
    description: "Visual problem-solution and claim map poster",
  },
] as const;
