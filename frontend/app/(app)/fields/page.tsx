"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listQuillFields, createQuillField, updateQuillField, deleteQuillField,
  listClioFields,
  type QuillFieldDef, type ClioFieldDef,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Client", "Joint", "Trust", "HC POA", "General POA", "Living Will", "Closing", "Engagement", "System", "General"];

export default function FieldsPage() {
  const [activeTab, setActiveTab] = useState<"quill" | "clio">("quill");

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Field Reference</h1>
        <p className="text-sm text-slate-500 mt-1">
          All variables available in Word templates. Copy the syntax and paste it directly into your .docx file.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        {(["quill", "clio"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              activeTab === tab ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700")}>
            {tab === "quill" ? "Quill Fields" : "Clio Fields"}
          </button>
        ))}
      </div>

      {activeTab === "quill" ? <QuillFieldsTab /> : <ClioFieldsTab />}
    </div>
  );
}


// --- Quill Fields Tab ---

function QuillFieldsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["quill-fields"],
    queryFn: () => listQuillFields().then((r) => r.data.data),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(CATEGORIES));

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteQuillField(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quill-fields"] });
      toast.success("Field removed");
    },
  });

  if (isLoading) return <div className="text-slate-400 text-sm">Loading...</div>;

  const fields = data ?? [];

  // Group by category
  const grouped = fields.reduce<Record<string, QuillFieldDef[]>>((acc, f) => {
    const cat = f.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {});

  function toggleCat(cat: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {fields.length} fields · These variables are filled in by the wizard when generating documents.
        </p>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Field
        </Button>
      </div>

      {showAdd && (
        <AddQuillFieldForm
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ["quill-fields"] }); }}
        />
      )}

      {Object.entries(grouped).map(([cat, catFields]) => (
        <div key={cat} className="rounded-xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => toggleCat(cat)}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
          >
            {expandedCats.has(cat) ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
            <span className="text-sm font-semibold text-slate-700">{cat}</span>
            <span className="text-xs text-slate-400 ml-1">({catFields.length})</span>
          </button>

          {expandedCats.has(cat) && (
            <div className="divide-y divide-slate-100">
              {catFields.map((f) => (
                editingId === f.id
                  ? <EditQuillFieldRow key={f.id} field={f}
                      onDone={() => { setEditingId(null); qc.invalidateQueries({ queryKey: ["quill-fields"] }); }} />
                  : <QuillFieldRow key={f.id} field={f}
                      onEdit={() => setEditingId(f.id)}
                      onDelete={() => { if (confirm(`Remove "${f.label}"?`)) deleteMut.mutate(f.id); }} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function QuillFieldRow({ field, onEdit, onDelete }: { field: QuillFieldDef; onEdit: () => void; onDelete: () => void }) {
  function copy() {
    navigator.clipboard.writeText(field.template_syntax);
    toast.success("Copied to clipboard", { description: field.template_syntax, duration: 1500 });
  }

  return (
    <div className={cn("flex items-start gap-3 px-4 py-3 hover:bg-slate-50 group transition-colors",
      !field.active && "opacity-50")}>
      {/* Syntax pill — click to copy */}
      <button onClick={copy}
        className="shrink-0 flex items-center gap-1.5 font-mono text-xs bg-slate-900 text-white px-2.5 py-1 rounded-md hover:bg-slate-700 transition-colors mt-0.5"
        title="Click to copy">
        {field.template_syntax}
        <Copy className="h-3 w-3 opacity-60" />
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900">{field.label}</span>
          {!field.active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
        </div>
        {field.description && (
          <p className="text-xs text-slate-400 mt-0.5">{field.description}</p>
        )}
        {field.applies_to && field.applies_to !== "all" && (
          <p className="text-xs text-slate-300 mt-0.5">Used in: {field.applies_to}</p>
        )}
      </div>

      {/* Example */}
      {field.example && (
        <span className="text-xs text-slate-400 italic shrink-0 max-w-32 truncate mt-0.5" title={field.example}>
          e.g. {field.example}
        </span>
      )}

      {/* Actions — visible on hover */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-slate-700 rounded">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-500 rounded">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function EditQuillFieldRow({ field, onDone }: { field: QuillFieldDef; onDone: () => void }) {
  const [label, setLabel] = useState(field.label);
  const [description, setDescription] = useState(field.description ?? "");
  const [example, setExample] = useState(field.example ?? "");
  const [appliesTo, setAppliesTo] = useState(field.applies_to);
  const [category, setCategory] = useState(field.category);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateQuillField(field.id, { label, description: description || null, example: example || null, applies_to: appliesTo, category });
      toast.success("Field updated");
      onDone();
    } catch { toast.error("Failed to update"); }
    finally { setSaving(false); }
  }

  return (
    <div className="px-4 py-3 bg-blue-50 border-l-2 border-blue-400 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs mb-1 block">Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-7 text-sm" autoFocus />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Category</Label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="h-7 w-full text-sm rounded-md border border-input bg-background px-2">
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div>
        <Label className="text-xs mb-1 block">Description</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-7 text-sm" placeholder="What this field is used for..." />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs mb-1 block">Example value</Label>
          <Input value={example} onChange={(e) => setExample(e.target.value)} className="h-7 text-sm" placeholder="e.g. Jay Marcotte" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Applies to (wizard_keys, comma-separated, or "all")</Label>
          <Input value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)} className="h-7 text-sm font-mono" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        <Button size="sm" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

function AddQuillFieldForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [variable_name, setVariableName] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [example, setExample] = useState("");
  const [applies_to, setAppliesTo] = useState("all");
  const [saving, setSaving] = useState(false);

  function handleLabelChange(v: string) {
    setLabel(v);
    setVariableName(v.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  }

  async function save() {
    if (!variable_name || !label) return;
    setSaving(true);
    try {
      await createQuillField({ variable_name, label, category, description: description || undefined, example: example || undefined, applies_to });
      toast.success(`Field "{{ ${variable_name} }}" added`);
      onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Failed to add field");
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
      <p className="text-sm font-medium text-slate-900">Add New Quill Field</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs mb-1 block">Label</Label>
          <Input value={label} onChange={(e) => handleLabelChange(e.target.value)} className="h-8 text-sm" autoFocus placeholder="e.g. HC Agent 3" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Variable name (auto)</Label>
          <Input value={variable_name} onChange={(e) => setVariableName(e.target.value)} className="h-8 text-sm font-mono" placeholder="e.g. hc_agent_3" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Category</Label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="h-8 w-full text-sm rounded-md border border-input bg-background px-2">
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Example value</Label>
          <Input value={example} onChange={(e) => setExample(e.target.value)} className="h-8 text-sm" placeholder="e.g. Hillary Gagnon" />
        </div>
      </div>
      <div>
        <Label className="text-xs mb-1 block">Description</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-8 text-sm" placeholder="What this field is for..." />
      </div>
      <div>
        <Label className="text-xs mb-1 block">Applies to (wizard_keys comma-separated, or "all")</Label>
        <Input value={applies_to} onChange={(e) => setAppliesTo(e.target.value)} className="h-8 text-sm font-mono" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving || !label || !variable_name}>
          {saving ? "Saving..." : `Add  {{ ${variable_name || "..."} }}`}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}


// --- Clio Fields Tab ---

function ClioFieldsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["clio-fields"],
    queryFn: () => listClioFields().then((r) => r.data.data),
  });
  const [filter, setFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "contact" | "matter">("all");

  function copy(syntax: string, name: string) {
    navigator.clipboard.writeText(syntax);
    toast.success("Copied to clipboard", { description: syntax, duration: 1500 });
  }

  if (isLoading) return <div className="text-slate-400 text-sm">Loading Clio fields...</div>;

  const fields = (data ?? []).filter((f) => {
    const matchSource = sourceFilter === "all" || f.source === sourceFilter;
    const matchFilter = !filter || f.name.toLowerCase().includes(filter.toLowerCase()) || f.variable_name.includes(filter.toLowerCase());
    return matchSource && matchFilter;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search fields..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 text-sm max-w-64"
        />
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(["all", "contact", "matter"] as const).map((s) => (
            <button key={s} onClick={() => setSourceFilter(s)}
              className={cn("px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize",
                sourceFilter === s ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700")}>
              {s === "all" ? `All (${data?.length ?? 0})` : `${s} (${data?.filter((f) => f.source === s).length ?? 0})`}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 ml-auto">{fields.length} fields shown — read only</p>
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-2 bg-slate-50 border-b border-slate-200 gap-4">
          <span>Field name</span>
          <span>Type</span>
          <span>Source</span>
          <span>Template syntax</span>
        </div>
        <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
          {fields.map((f) => (
            <div key={f.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-2.5 hover:bg-slate-50 gap-4 group">
              <span className="text-sm text-slate-900">{f.name}</span>
              <span className="text-xs text-slate-400">{f.field_type}</span>
              <Badge variant="secondary" className={cn("text-xs font-normal",
                f.source === "contact" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600")}>
                {f.source}
              </Badge>
              <button onClick={() => copy(f.template_syntax, f.name)}
                className="flex items-center gap-1.5 font-mono text-xs bg-slate-800 text-white px-2.5 py-1 rounded-md hover:bg-slate-600 transition-colors"
                title="Click to copy">
                {f.template_syntax}
                <Copy className="h-3 w-3 opacity-60" />
              </button>
            </div>
          ))}
          {fields.length === 0 && (
            <div className="px-4 py-8 text-sm text-slate-400 text-center">No fields match your search.</div>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Clio fields are pulled live from your connected account. Variable names are auto-generated from the field name.
        These values are available for templates but must first be mapped in the backend field mapper.
      </p>
    </div>
  );
}
