import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// --- Auth ---
export const login = (email: string, password: string) =>
  api.post<{ access_token: string }>("/auth/token", new URLSearchParams({ username: email, password }), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

export const getMe = () => api.get("/auth/me");

// --- Matters ---
export const getMatters = () => api.get<{ data: Matter[] }>("/matters");
export const getMatter = (id: number) => api.get<{ data: Matter }>(`/matters/${id}`);
export const getMatterRelationships = (id: number) => api.get(`/matters/${id}/relationships`);

// --- Contacts ---
export const searchContacts = (q: string) =>
  api.get<{ id: number; text: string }[]>(`/contacts/search?q=${encodeURIComponent(q)}`);
export const getContact = (id: number) => api.get(`/contacts/${id}`);

// --- Documents ---
export const getDocumentTypes = () => api.get<{ data: string[] }>("/documents/types");
export const generateDocument = (req: GenerateRequest) => api.post("/documents/generate", req);
export const listJobs = () => api.get("/documents");

// --- Types ---
export interface Matter {
  id: number;
  display_number: string;
  description: string;
  status: string;
  client?: { id: number; name: string };
}

export interface GenerateRequest {
  matter_id: number;
  matter_label: string;
  document_type: string;
  wizard_data: Record<string, unknown>;
  generate_pdf?: boolean;
  upload_to_clio?: boolean;
}
