"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listDocumentTypes, updateDocumentType, deleteDocumentType,
  reorderDocumentTypes, uploadDocumentTypeTemplate, downloadDocumentTypeTemplate,
  createDocumentType, type DocType,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Download, Trash2, Plus, ChevronUp, ChevronDown, Pencil, X, Check, FileText, ChevronDown as DropIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANTS = [
  { key: "default", label: "Default (all)" },
  { key: "single_male", label: "Single / Male" },
  { key: "single_female", label: "Single / Female" },
  { key: "joint_male", label: "Joint / Male" },
  { key: "joint_female", label: "Joint / Female" },
] as const;

const MATTER_TYPES = [
  { value: "estate_planning", label: "Estate Planning", color: "bg-blue-100 text-blue-700" },
  { value: "probate", label: "Probate", color: "bg-orange-100 text-orange-700" },
  { value: "guardianship_conservatorship", label: "Guardianship / Conservatorship", color: "bg-purple-100 text-purple-700" },
  { value: "trust_administration", label: "Trust Administration", color: "bg-teal-100 text-teal-700" },
  { value: "all", label: "All Matter Types", color: "bg-slate-100 text-slate-600" },
];

function matterTypeColor(value: string) {
  return MATTER_TYPES.find((m) => m.value === value)?.color ?? "bg-slate-100 text-slate-600";
}
function matterTypeLabel(value: string) {
  return MATTER_TYPES.find((m) => m.value === value)?.label ?? value;
}

export default function TemplatesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["document-types"],
    queryFn: () => listDocumentTypes().then((r) => r.data.data),
  });

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("__all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<DocType> }) => updateDocumentType(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["document-types"] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteDocumentType(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["document-types"] }); toast.success("Removed"); },
  });
  const reorderMut = useMutation({
    mutationFn: (items: { id: number; sort_order: number }[]) => reorderDocumentTypes(items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["document-types"] }),
  });

  function move(types: DocType[], index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= types.length) return;
    const reordered = [...types];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    reorderMut.mutate(reordered.map((t, i) => ({ id: t.id, sort_order: (i + 1) * 10 })));
  }

  if (isLoading) return <div className="p-8 text-slate-400">Loading...</div>;

  const allTypes = data ?? [];
  const filtered = allTypes.filter((dt) => {
    const matchSearch = !search || dt.label.toLowerCase().includes(search.toLowerCase()) || dt.wizard_key.includes(search.toLowerCase());
    const matchType = filterType === "__all" || dt.matter_type === filterType;
    return matchSearch && matchType;
  });

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Document Types &amp; Templates</h1>
          <p className="text-sm text-slate-500 mt-1">Manage document types, ordering, practice areas, and Word template files.</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> Add Document Type
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4">
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm w-48"
        />
        {/* All button */}
        <button
          onClick={() => setFilterType("__all")}
          className={cn("h-8 px-3 rounded-md text-sm border transition-colors",
            filterType === "__all" ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600 hover:border-slate-400")}
        >
          All ({allTypes.length})
        </button>
        {/* Practice area buttons */}
        {MATTER_TYPES.filter((m) => m.value !== "all").map((mt) => {
          const count = allTypes.filter((dt) => dt.matter_type === mt.value).length;
          const active = filterType === mt.value;
          return (
            <button key={mt.value} onClick={() => setFilterType(mt.value)}
              className={cn("h-8 px-3 rounded-md text-sm border transition-colors",
                active ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600 hover:border-slate-400")}>
              {mt.label} ({count})
            </button>
          );
        })}
        {/* "All types" option */}
        <button
          onClick={() => setFilterType("all")}
          className={cn("h-8 px-3 rounded-md text-sm border transition-colors",
            filterType === "all" ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600 hover:border-slate-400")}
        >
          All Types ({allTypes.filter((dt) => dt.matter_type === "all").length})
        </button>
      </div>

      {showAdd && (
        <AddDocumentTypeForm
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ["document-types"] }); }}
        />
      )}

      <div className="space-y-2">
        {filtered.map((dt, idx) => {
          // Use index within all (not filtered) for reorder
          const allIdx = allTypes.findIndex((t) => t.id === dt.id);
          return (
            <DocumentTypeRow
              key={dt.id}
              dt={dt}
              index={allIdx}
              total={allTypes.length}
              isEditing={editingId === dt.id}
              editLabel={editLabel}
              onEditStart={() => { setEditingId(dt.id); setEditLabel(dt.label); }}
              onEditChange={setEditLabel}
              onEditSave={() => {
                if (!editLabel.trim()) return;
                updateMut.mutate({ id: dt.id, body: { label: editLabel.trim() } });
                setEditingId(null);
              }}
              onEditCancel={() => setEditingId(null)}
              onToggleActive={() => updateMut.mutate({ id: dt.id, body: { active: !dt.active } })}
              onChangeMatterType={(mt) => updateMut.mutate({ id: dt.id, body: { matter_type: mt } })}
              onDelete={() => { if (confirm(`Remove "${dt.label}"?`)) deleteMut.mutate(dt.id); }}
              onMoveUp={() => move(allTypes, allIdx, -1)}
              onMoveDown={() => move(allTypes, allIdx, 1)}
              onUploaded={() => qc.invalidateQueries({ queryKey: ["document-types"] })}
            />
          );
        })}
        {filtered.length === 0 && (
          <div className="text-sm text-slate-400 py-8 text-center">No document types match your filter.</div>
        )}
      </div>

      <p className="text-xs text-slate-400 mt-6">
        {allTypes.filter((t) => t.has_template).length} of {allTypes.length} document types have templates assigned.
      </p>
    </div>
  );
}


function DocumentTypeRow({
  dt, index, total, isEditing, editLabel,
  onEditStart, onEditChange, onEditSave, onEditCancel,
  onToggleActive, onChangeMatterType, onDelete, onMoveUp, onMoveDown, onUploaded,
}: {
  dt: DocType; index: number; total: number;
  isEditing: boolean; editLabel: string;
  onEditStart: () => void; onEditChange: (v: string) => void;
  onEditSave: () => void; onEditCancel: () => void;
  onToggleActive: () => void;
  onChangeMatterType: (mt: string) => void;
  onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void;
  onUploaded: () => void;
}) {
  const [showTemplates, setShowTemplates] = useState(false);
  const [showMatterTypePicker, setShowMatterTypePicker] = useState(false);

  return (
    <div className={cn("rounded-lg border bg-white transition-colors", dt.active ? "border-slate-200" : "border-slate-100 opacity-60")}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Reorder */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <button onClick={onMoveUp} disabled={index === 0} className="text-slate-300 hover:text-slate-600 disabled:opacity-20 disabled:cursor-default"><ChevronUp className="h-3.5 w-3.5" /></button>
          <button onClick={onMoveDown} disabled={index === total - 1} className="text-slate-300 hover:text-slate-600 disabled:opacity-20 disabled:cursor-default"><ChevronDown className="h-3.5 w-3.5" /></button>
        </div>

        {/* Label + meta */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input value={editLabel} onChange={(e) => onEditChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onEditSave(); if (e.key === "Escape") onEditCancel(); }}
                className="h-7 text-sm py-0" autoFocus />
              <button onClick={onEditSave} className="text-green-600 hover:text-green-700"><Check className="h-4 w-4" /></button>
              <button onClick={onEditCancel} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("text-sm font-medium", dt.active ? "text-slate-900" : "text-slate-400")}>{dt.label}</span>
              <button onClick={onEditStart} className="text-slate-300 hover:text-slate-500"><Pencil className="h-3.5 w-3.5" /></button>

              {/* Matter type badge — click to change */}
              <div className="relative">
                <button onClick={() => setShowMatterTypePicker((s) => !s)}
                  className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-normal", matterTypeColor(dt.matter_type))}>
                  {matterTypeLabel(dt.matter_type)}
                  <DropIcon className="h-3 w-3 opacity-60" />
                </button>
                {showMatterTypePicker && (
                  <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-56">
                    {MATTER_TYPES.map((mt) => (
                      <button key={mt.value}
                        onClick={() => { onChangeMatterType(mt.value); setShowMatterTypePicker(false); }}
                        className={cn("w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50",
                          dt.matter_type === mt.value && "font-medium")}>
                        <span className={cn("inline-block px-2 py-0.5 rounded-full", mt.color)}>{mt.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-400 font-mono">{dt.wizard_key}</span>
            {dt.clio_field_id && <span className="text-xs text-slate-300">· Clio #{dt.clio_field_id}</span>}
          </div>
        </div>

        {/* Template status */}
        <div className="shrink-0">
          {dt.has_template ? (
            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs font-normal border">
              <FileText className="h-3 w-3 mr-1" /> Template assigned
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs font-normal text-slate-400">No template</Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setShowTemplates((s) => !s)}
            className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50">
            {showTemplates ? "Hide" : "Templates"}
          </button>
          <button onClick={onToggleActive}
            className={cn("text-xs px-2 py-1 rounded border hover:bg-slate-50",
              dt.active ? "border-slate-200 text-slate-600" : "border-orange-200 text-orange-600")}>
            {dt.active ? "Deactivate" : "Activate"}
          </button>
          <button onClick={onDelete} className="p-1.5 text-slate-300 hover:text-red-500 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {showTemplates && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 rounded-b-lg">
          <p className="text-xs font-medium text-slate-500 mb-3">Template files by variant</p>
          <div className="space-y-2">
            {VARIANTS.map(({ key, label }) => {
              const filename = (dt as any)[`template_${key}`] as string | null;
              return <TemplateVariantRow key={key} dtId={dt.id} variant={key} label={label} filename={filename} onUploaded={onUploaded} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}


function TemplateVariantRow({ dtId, variant, label, filename, onUploaded }: {
  dtId: number; variant: string; label: string; filename: string | null; onUploaded: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadDocumentTypeTemplate(dtId, variant, file);
      toast.success(`Template uploaded for ${label}`);
      onUploaded();
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-36 shrink-0">{label}</span>
      <span className={cn("text-xs flex-1 font-mono truncate", filename ? "text-slate-700" : "text-slate-300 italic")}>
        {filename ?? "not assigned"}
      </span>
      <div className="flex gap-1.5 shrink-0">
        {filename && (
          <button onClick={() => downloadDocumentTypeTemplate(dtId, variant, filename)}
            className="p-1 text-slate-400 hover:text-slate-700 rounded" title="Download">
            <Download className="h-3.5 w-3.5" />
          </button>
        )}
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="p-1 text-slate-400 hover:text-blue-600 rounded" title="Upload .docx">
          <Upload className="h-3.5 w-3.5" />
        </button>
        <input ref={fileRef} type="file" accept=".docx" className="hidden" onChange={handleUpload} />
      </div>
    </div>
  );
}


function AddDocumentTypeForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState("");
  const [wizardKey, setWizardKey] = useState("");
  const [matterType, setMatterType] = useState("estate_planning");
  const [saving, setSaving] = useState(false);

  function handleLabelChange(v: string) {
    setLabel(v);
    setWizardKey(v.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  }

  async function handleSave() {
    if (!label.trim() || !wizardKey.trim()) return;
    setSaving(true);
    try {
      await createDocumentType({ label: label.trim(), wizard_key: wizardKey.trim(), matter_type: matterType, sort_order: 999 });
      toast.success(`"${label}" added`);
      onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Failed to add document type");
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 mb-4">
      <h3 className="text-sm font-medium text-slate-900 mb-3">Add New Document Type</h3>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <Label className="text-xs mb-1 block">Display Label</Label>
          <Input placeholder="e.g. Inventory &amp; Appraisal" value={label}
            onChange={(e) => handleLabelChange(e.target.value)} className="h-8 text-sm" autoFocus />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Wizard Key (auto)</Label>
          <Input placeholder="e.g. inventory_appraisal" value={wizardKey}
            onChange={(e) => setWizardKey(e.target.value)} className="h-8 text-sm font-mono" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Practice Area</Label>
          <select value={matterType} onChange={(e) => setMatterType(e.target.value)}
            className="h-8 w-full text-sm rounded-md border border-input bg-background px-2">
            {MATTER_TYPES.map((mt) => <option key={mt.value} value={mt.value}>{mt.label}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving || !label.trim()}>
          {saving ? "Saving..." : "Add Document Type"}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
