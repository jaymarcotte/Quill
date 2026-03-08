"use client";
import { useEffect, useRef, useState } from "react";
import { listTemplates, downloadTemplate, uploadTemplate } from "@/lib/api";
import { LayoutTemplate, Download, Upload, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Template {
  key: string;
  filename: string;
  exists: boolean;
  size_kb: number | null;
  modified: number | null;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  living_will_single_female: "Living Will — Single, Female",
  living_will_single_male: "Living Will — Single, Male",
  living_will_married_female: "Living Will — Married, Female",
  living_will_married_male: "Living Will — Married, Male",
  hc_poa_single_female: "Health Care POA — Single, Female",
  hc_poa_single_male: "Health Care POA — Single, Male",
  general_poa_single_female: "General POA — Single, Female",
  general_poa_single_male: "General POA — Single, Male",
  pourover_will_single_female: "Pourover Will — Single, Female",
  pourover_will_single_male: "Pourover Will — Single, Male",
  trust_single: "Trust — Single",
  certificate_of_trust_single: "Certificate of Trust — Single",
  engagement_letter: "Engagement Letter",
  closing_letter_single: "Closing Summary Letter — Single",
  email_drafts_single: "Email with Drafts — Single",
  email_drafts_married: "Email with Drafts — Married",
  trust_waiver: "Trust Waiver",
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadingKeyRef = useRef<string | null>(null);

  function load() {
    setLoading(true);
    listTemplates()
      .then((r) => setTemplates(r.data.data))
      .catch(() => setError("Failed to load templates."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function handleDownload(t: Template) {
    downloadTemplate(t.key, t.filename).catch(() =>
      toast.error(`Download failed for ${t.key}`)
    );
  }

  function triggerUpload(key: string) {
    uploadingKeyRef.current = key;
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const key = uploadingKeyRef.current;
    if (!file || !key) return;
    e.target.value = "";

    setUploading(key);
    try {
      await uploadTemplate(key, file);
      toast.success("Template uploaded successfully.");
      load();
    } catch {
      toast.error("Upload failed. Make sure the file is a valid .docx.");
    } finally {
      setUploading(null);
      uploadingKeyRef.current = null;
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Templates</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage the .docx templates used to generate estate planning documents.
        </p>
      </div>

      {/* Hidden file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx"
        className="hidden"
        onChange={handleFileChange}
      />

      {loading && <p className="text-sm text-slate-500">Loading templates...</p>}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && !error && templates.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <LayoutTemplate className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No templates found.</p>
        </div>
      )}

      {templates.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 font-medium text-slate-600">Document Type</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Template Key</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">File</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Size</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Modified</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr
                  key={t.key}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-5 py-3 text-slate-800 font-medium">
                    {DOC_TYPE_LABELS[t.key] ?? t.key}
                  </td>
                  <td className="px-5 py-3">
                    <code className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      {t.key}
                    </code>
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-xs max-w-xs truncate">
                    {t.exists ? (
                      t.filename
                    ) : (
                      <span className="flex items-center gap-1 text-amber-600">
                        <AlertCircle className="h-3.5 w-3.5" />
                        File missing on disk
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {t.size_kb != null ? `${t.size_kb} KB` : "—"}
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {t.modified
                      ? new Date(t.modified * 1000).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {t.exists && (
                        <button
                          onClick={() => handleDownload(t)}
                          className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded px-2 py-1 hover:bg-slate-50"
                        >
                          <Download className="h-3 w-3" /> Download
                        </button>
                      )}
                      <button
                        onClick={() => triggerUpload(t.key)}
                        disabled={uploading === t.key}
                        className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Upload className="h-3 w-3" />
                        {uploading === t.key ? "Uploading..." : "Upload"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
