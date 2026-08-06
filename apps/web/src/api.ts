import type {
  AuditEvent,
  CaseDetail,
  CaseSummary,
  ProviderSetting,
  ManagedUser,
  SpecimenType,
  User,
} from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly requestId?: string,
  ) {
    super(message);
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        error?: {
          code?: string;
          message?: string;
          requestId?: string;
        };
      }
    | null;

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message ?? `Request failed with HTTP ${response.status}`,
      response.status,
      payload?.error?.code ?? "REQUEST_FAILED",
      payload?.error?.requestId,
    );
  }

  return payload as T;
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    apiFetch<void>("/api/auth/logout", {
      method: "POST",
    }),

  me: () => apiFetch<{ user: User }>("/api/auth/me"),

  listCases: () => apiFetch<{ cases: CaseSummary[] }>("/api/cases"),

  getCase: (caseId: string) =>
    apiFetch<{ case: CaseDetail }>(`/api/cases/${caseId}`),

  createCase: (input: {
    caseCode: string;
    specimenType: SpecimenType;
    collectionDate: string;
    cultureMedia: string;
    incubationHours: number;
    notes?: string;
  }) =>
    apiFetch<{ case: CaseDetail }>("/api/cases", {
      method: "POST",
      body: JSON.stringify({
        ...input,
        gramStainAvailable: false,
        microscopyAvailable: false,
      }),
    }),

  archiveCase: (caseId: string) =>
    apiFetch<void>(`/api/cases/${caseId}`, {
      method: "DELETE",
    }),


  updateCase: (
    caseId: string,
    input: {
      specimenType?: SpecimenType;
      collectionDate?: string;
      cultureMedia?: string;
      incubationHours?: number;
      gramStainAvailable?: boolean;
      gramStainResult?: string | null;
      microscopyAvailable?: boolean;
      microscopyResult?: string | null;
      notes?: string | null;
    },
  ) =>
    apiFetch<{ case: CaseDetail }>(`/api/cases/${caseId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  analyseImage: (imageId: string) =>
    apiFetch<{
      analysis: CaseDetail["images"][number]["analyses"][number];
      caseStatus: CaseDetail["status"];
    }>(`/api/images/${imageId}/analyse`, {
      method: "POST",
    }),

  submitCase: (caseId: string) =>
    apiFetch<{ status: CaseDetail["status"] }>(
      `/api/cases/${caseId}/submit`,
      {
        method: "POST",
      },
    ),

  reviewCase: (
    caseId: string,
    input: {
      decision: "APPROVED" | "REJECTED" | "OVERRIDDEN";
      comments?: string;
      overrideReason?: string;
    },
  ) =>
    apiFetch(`/api/cases/${caseId}/reviews`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  finaliseCase: (caseId: string) =>
    apiFetch(`/api/cases/${caseId}/finalise`, {
      method: "POST",
    }),

  getImageUrl: (imageId: string) =>
    apiFetch<{ url: string; expiresInSeconds: number }>(
      `/api/images/${imageId}/url`,
    ),

  deleteImage: (imageId: string) =>
    apiFetch<void>(`/api/images/${imageId}`, {
      method: "DELETE",
    }),

  listProviders: () =>
    apiFetch<{ providers: ProviderSetting[] }>(
      "/api/settings/ai-providers",
    ),

  saveProvider: (input: {
    provider: ProviderSetting["provider"];
    baseUrl: string;
    model: string;
    apiKey?: string;
    enabled: boolean;
    visionEnabled: boolean;
    timeoutMs: number;
    maxImageBytes: number;
  }) =>
    apiFetch<{ saved: true; provider: ProviderSetting }>(
      "/api/settings/ai-providers",
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    ),

  testProvider: (input: {
    provider?: ProviderSetting["provider"];
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    timeoutMs?: number;
    useStoredProvider?: boolean;
  }) =>
    apiFetch<{
      status: "verified";
      provider: ProviderSetting["provider"];
      model: string;
      imageTransportVerified: true;
      visualDifferenceVerified: true;
      redResult: "red";
      blueResult: "blue";
      latencyMs: number;
      schemaValid: true;
    }>("/api/settings/ai-providers/test", {
      method: "POST",
      body: JSON.stringify(input),
    }),


  listUsers: () =>
    apiFetch<{ users: ManagedUser[] }>("/api/settings/users"),

  createUser: (input: {
    email: string;
    displayName: string;
    password: string;
    role: ManagedUser["role"];
  }) =>
    apiFetch<{ user: ManagedUser }>("/api/settings/users", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateUser: (
    userId: string,
    input: {
      displayName?: string;
      role?: ManagedUser["role"];
      disabled?: boolean;
    },
  ) =>
    apiFetch<{ user: ManagedUser }>(`/api/settings/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  resetUserPassword: (userId: string, password: string) =>
    apiFetch<void>(`/api/settings/users/${userId}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  listAuditEvents: () =>
    apiFetch<{ events: AuditEvent[]; nextCursor: string | null }>(
      "/api/audit?limit=100",
    ),
};

export function uploadImage(
  caseId: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<CaseDetail["images"][number]> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const form = new FormData();
    form.append("image", file);

    request.open("POST", `/api/cases/${caseId}/images`);
    request.withCredentials = true;

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener("load", () => {
      let payload: {
        image?: CaseDetail["images"][number];
        error?: {
          code?: string;
          message?: string;
          requestId?: string;
        };
      } = {};

      try {
        payload = JSON.parse(request.responseText || "{}") as typeof payload;
      } catch {
        reject(
          new ApiError(
            "Upload endpoint returned a non-JSON response",
            request.status,
            "INVALID_UPLOAD_RESPONSE",
          ),
        );
        return;
      }

      if (request.status >= 200 && request.status < 300 && payload.image) {
        resolve(payload.image);
        return;
      }

      reject(
        new ApiError(
          payload.error?.message ?? `Upload failed with HTTP ${request.status}`,
          request.status,
          payload.error?.code ?? "UPLOAD_FAILED",
          payload.error?.requestId,
        ),
      );
    });

    request.addEventListener("error", () => {
      reject(new ApiError("Network error during upload", 0, "NETWORK_ERROR"));
    });

    request.addEventListener("abort", () => {
      reject(new ApiError("Upload was cancelled", 0, "UPLOAD_CANCELLED"));
    });

    request.send(form);
  });
}
