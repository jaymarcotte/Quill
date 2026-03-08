"use client";
import { useEffect, useState } from "react";
import { listJobs } from "@/lib/api";
import { FileText, Download, Clock, CheckCircle, Upload } from "lucide-react";

interface Job {
  id: number;
  matter_label: string;
  document_type: string;
  status: string;
  created_at: string;
  has_pdf: boolean;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  generated: <CheckCircle className="h-4 w-4 text-emerald-500" />,
  uploaded: <Upload className="h-4 w-4 text-blue-500" />,
  draft: <Clock className="h-4 w-4 text-slate-400" />,
};

const DOC_LABELS: Record<string, string> = {
  living_will_female: "Living Will (Female)",
  living_will_male: "Living Will (Male)",
  hc_poa: "Healthcare POA",
  general_poa: "General POA",
  trust: "Revocable Trust",
  closing_letter: "Closing Letter",
};

export default function DocumentsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listJobs()
      .then((r) => setJobs(r.data.data))
      .catch(() => setError("Failed to load documents."))
      .finally(() => setLoading(false));
  }, []);

  async function handleDownload(id: number, type: "docx" | "pdf", matterLabel: string) {
    const token = localStorage.getItem("access_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001";
    const res = await fetch(`${apiUrl}/api/documents/${id}/download/${type}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${matterLabel}.${type}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Documents</h1>
        <p className="text-sm text-slate-500 mt-1">Generated documents from all matters.</p>
      </div>

      {loading && (
        <p className="text-sm text-slate-500">Loading...</p>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <FileText className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No documents generated yet.</p>
          <p className="text-xs text-slate-400 mt-1">Open a matter and run the wizard to generate documents.</p>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 font-medium text-slate-600">Matter</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Document</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Created</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Download</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-800 font-medium">{job.matter_label}</td>
                  <td className="px-5 py-3 text-slate-600">
                    {DOC_LABELS[job.document_type] ?? job.document_type}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 capitalize text-slate-600">
                      {STATUS_ICON[job.status] ?? <Clock className="h-4 w-4 text-slate-400" />}
                      {job.status}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {new Date(job.created_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleDownload(job.id, "docx", job.matter_label)}
                        className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded px-2 py-1 hover:bg-slate-50"
                      >
                        <Download className="h-3 w-3" /> DOCX
                      </button>
                      {job.has_pdf && (
                        <button
                          onClick={() => handleDownload(job.id, "pdf", job.matter_label)}
                          className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded px-2 py-1 hover:bg-slate-50"
                        >
                          <Download className="h-3 w-3" /> PDF
                        </button>
                      )}
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
