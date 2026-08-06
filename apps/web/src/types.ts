export type Role =
  | "TECHNICIAN"
  | "MICROBIOLOGIST"
  | "SUPERVISOR"
  | "ADMIN";

export type CaseStatus =
  | "DRAFT"
  | "IMAGE_UPLOADED"
  | "QC_COMPLETED"
  | "TRIAGE_COMPLETED"
  | "SUBMITTED_FOR_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "FINALISED";

export type SpecimenType =
  | "URINE"
  | "STERILE_SITE"
  | "SPUTUM"
  | "THROAT"
  | "GENITAL"
  | "OTHER";

export type User = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  organisationId: string;
  organisationName: string;
};

export type ImageAnalysis = {
  id: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "NOT_RUN";
  provider?: "GOOGLE_NATIVE" | "OPENAI_COMPATIBLE";
  model?: string;
  promptVersion: string;
  schemaVersion: string;
  inputImageSha256: string;
  imageQuality?: "adequate" | "borderline" | "inadequate" | "unknown";
  qualityIssues?: string[];
  growthPattern?: string;
  gramStainHypothesis?: "gram_negative_suspected" | "gram_positive_suspected" | "mixed_flora_suspected" | "unable_to_assess";
  mediumTypeIdentified?: string;
  threeDimensionalMorphology?: {
    elevation: string;
    margin: string;
    pigmentation: string;
    opticalProperty: string;
  };
  observations?: string[];
  confidence?: number;
  requiresHumanReview: boolean;
  limitations?: string[];
  failureReason?: string;
  startedAt: string;
  completedAt?: string;
};

export type CaseImage = {
  id: string;
  originalFileName: string;
  detectedMimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  sha256: string;
  uploadedAt: string;
  analyses: ImageAnalysis[];
};

export type Review = {
  id: string;
  decision: "APPROVED" | "REJECTED" | "OVERRIDDEN";
  comments?: string;
  overrideReason?: string;
  createdAt: string;
  reviewer: {
    displayName: string;
    email: string;
  };
};

export type CaseSummary = {
  id: string;
  caseCode: string;
  specimenType: SpecimenType;
  collectionDate: string;
  cultureMedia: string;
  incubationHours: number;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  _count: {
    images: number;
  };
};

export type CaseDetail = Omit<CaseSummary, "_count"> & {
  gramStainAvailable: boolean;
  gramStainResult?: string;
  microscopyAvailable: boolean;
  microscopyResult?: string;
  notes?: string;
  images: CaseImage[];
  reviews: Review[];
  transitions: Array<{
    id: string;
    fromStatus: CaseStatus;
    toStatus: CaseStatus;
    reason?: string;
    createdAt: string;
  }>;
};

export type ProviderSetting = {
  id: string;
  provider: "GOOGLE_NATIVE" | "OPENAI_COMPATIBLE";
  baseUrl: string;
  model: string;
  enabled: boolean;
  visionEnabled: boolean;
  timeoutMs: number;
  maxImageBytes: number;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  updatedAt: string;
};

export type AuditEvent = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  outcome: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  actor?: {
    displayName: string;
    email: string;
  };
};


export type ManagedUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  disabled: boolean;
  disabledAt?: string;
  createdAt: string;
};
