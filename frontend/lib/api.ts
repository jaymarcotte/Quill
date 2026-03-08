import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001";

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
  api.get<ContactCard[]>(`/contacts/search?q=${encodeURIComponent(q)}`);
export const getContact = (id: number) => api.get<{ data: ContactFull }>(`/contacts/${id}`);
export const updateContact = (id: number, data: Partial<ContactFull>) =>
  api.patch(`/contacts/${id}`, data);
export const createContact = (data: { first_name: string; last_name?: string; phone?: string; email?: string }) =>
  api.post<{ data: ContactCard }>("/contacts", data);
export const addMatterRelationship = (matterId: number, contactId: number, description?: string) =>
  api.post(`/contacts/matter/${matterId}/relationships`, { contact_id: contactId, description });
export const removeMatterRelationship = (matterId: number, relationshipId: number) =>
  api.delete(`/contacts/matter/${matterId}/relationships/${relationshipId}`);

// --- Documents ---
export const getDocumentTypes = () => api.get<{ data: string[] }>("/documents/types");
export const generateDocument = (req: GenerateRequest) => api.post("/documents/generate", req);
export const listJobs = () => api.get("/documents");

// --- Document Types (DB-driven config) ---
export const listDocumentTypes = () => api.get<{ data: DocType[] }>("/document-types");
export const createDocumentType = (data: Partial<DocType>) => api.post<{ data: DocType }>("/document-types", data);
export const updateDocumentType = (id: number, data: Partial<DocType>) => api.patch<{ data: DocType }>(`/document-types/${id}`, data);
export const deleteDocumentType = (id: number) => api.delete(`/document-types/${id}`);
export const reorderDocumentTypes = (items: { id: number; sort_order: number }[]) =>
  api.post("/document-types/reorder", items);
export const uploadDocumentTypeTemplate = (id: number, variant: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post(`/document-types/${id}/upload/${variant}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
export const downloadDocumentTypeTemplate = async (id: number, variant: string, filename: string) => {
  const token = localStorage.getItem("access_token");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001";
  const res = await fetch(`${apiUrl}/api/document-types/${id}/download/${variant}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// --- Fields ---
export const listQuillFields = () => api.get<{ data: QuillFieldDef[] }>("/fields/quill");
export const createQuillField = (data: Partial<QuillFieldDef>) => api.post<{ data: QuillFieldDef }>("/fields/quill", data);
export const updateQuillField = (id: number, data: Partial<QuillFieldDef>) => api.patch<{ data: QuillFieldDef }>(`/fields/quill/${id}`, data);
export const deleteQuillField = (id: number) => api.delete(`/fields/quill/${id}`);
export const listClioFields = () => api.get<{ data: ClioFieldDef[] }>("/fields/clio");

// --- Templates ---
export const listTemplates = () => api.get("/templates");
export const downloadTemplate = async (key: string, filename: string) => {
  const token = localStorage.getItem("access_token");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001";
  const res = await fetch(`${apiUrl}/api/templates/${key}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
export const uploadTemplate = (key: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post(`/templates/${key}/upload`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

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

export interface DocType {
  id: number;
  label: string;
  wizard_key: string;
  matter_type: string;
  clio_field_id: number | null;
  template_default: string | null;
  template_single_male: string | null;
  template_single_female: string | null;
  template_joint_male: string | null;
  template_joint_female: string | null;
  sort_order: number;
  active: boolean;
  has_template: boolean;
}

export interface ContactCard {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  prefix: string;
  email: string;
  phone: string;
  city_state: string;
}

export interface ContactFull extends ContactCard {
  etag: string;
  street: string;
  province: string;
  postal_code: string;
  middle_name: string;
  pronoun: string;
  special_notes: string;
}

export interface MatterRelationship {
  id: number;
  description: string;
  contact: { id: number; name: string };
}

export interface QuillFieldDef {
  id: number;
  variable_name: string;
  label: string;
  category: string;
  applies_to: string;
  description: string | null;
  example: string | null;
  active: boolean;
  sort_order: number;
  template_syntax: string;
}

export interface ClioFieldDef {
  id: number;
  name: string;
  field_type: string;
  source: "contact" | "matter";
  variable_name: string;
  template_syntax: string;
  picklist_options: string[];
}
