export type FaithfulnessLevel = "high" | "medium" | "low";

export type AnalysisStatus = "processed" | "processing" | "draft";

export type ExportFormat = "Summary" | "Slides" | "Infographic";

export type ProposalSectionType =
  | "problem"
  | "solution"
  | "evidence"
  | "feasibility"
  | "differentiation"
  | "impact";

export type ClaimSource = {
  section: string;
  page: number;
  passage: string;
};

export type Claim = {
  id: string;
  text: string;
  faithfulness: FaithfulnessLevel;
  score: number;
  source: ClaimSource;
};

export type ProposalSection = {
  key: ProposalSectionType;
  title: string;
  score: number;
  body: string;
  claims: Claim[];
};

export type Analysis = {
  id: string;
  title: string;
  authors: string;
  source: string;
  status: AnalysisStatus;
  date: string;
  format: ExportFormat;
  overallScore: number;
  comprehension: number;
  sections: ProposalSection[];
};

export type UserProfile = {
  id: string;
  initials: string;
  name: string;
  email: string;
  role: string;
  organization: string;
  joinedAt: string;
};
