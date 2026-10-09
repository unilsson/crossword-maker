export interface SynonymStatus {
  installed: boolean;
  importedAt?: string;
  entries?: number;
  pairs?: number;
  groups?: number;
  skippedGroups?: number;
  source: string;
  license: string;
}

export interface SynonymResults {
  term: string;
  pattern: string;
  total: number;
  matches: string[];
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  if (!response.ok) {
    const detail = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(detail.error ?? "Synonymtjänsten svarade med HTTP " + response.status);
  }
  return response.json() as Promise<T>;
}

export const getSynonymStatus = () => api<SynonymStatus>("/api/synonyms/status");

export const installSwesaurus = () =>
  api<SynonymStatus>("/api/synonyms/install", { method: "POST" });

export const uploadSwesaurus = (file: File) =>
  api<SynonymStatus>("/api/synonyms/upload", {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body: file,
  });

export const getSynonyms = (term: string, pattern: string, signal: AbortSignal) =>
  api<SynonymResults>(
    "/api/synonyms?term=" + encodeURIComponent(term) +
    "&pattern=" + encodeURIComponent(pattern),
    { signal },
  );
