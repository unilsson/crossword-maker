import type { Crossword } from "../types/crossword";

export interface ProjectSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json.error || "Serverfel (" + response.status + ")");
  }
  return response.json() as Promise<T>;
}

const jsonOptions = (method: string, document: Crossword): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(document),
});

export const listProjects = () => request<ProjectSummary[]>("/api/projects");
export const getProject = (id: string) => request<Crossword>("/api/projects/" + id);
export const createProject = (document: Crossword) =>
  request<{ id: string }>("/api/projects", jsonOptions("POST", document));
export const saveProject = (id: string, document: Crossword) =>
  request<{ id: string }>("/api/projects/" + id, jsonOptions("PUT", document));
export const removeProject = (id: string) =>
  request<{ ok: boolean }>("/api/projects/" + id, { method: "DELETE" });
