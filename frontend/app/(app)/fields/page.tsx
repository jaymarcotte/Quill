"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listQuillFields, createQuillField, updateQuillField, deleteQuillField,
  listClioFields, listClioStandardFields,
  type QuillFieldDef, type ClioFieldDef, type ClioStandardFieldDef,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Plus, Pencil, Trash2, X, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const QUILL_CATEGORIES = ["Client", "Joint", "Trust", "HC POA", "General POA", "Living Will", "Closing", "Engagement", "System", "General"];

type Tab = "clio_standard" | "clio_custom" | "quill_blocks";

export default function FieldsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("clio_standard");

  const TABS: { key: Tab; label: string; description: string }[] = [
    {
      key: "clio_standard",
      label: "Clio Standard",
      description: "Built-in Clio fields on every matter and contact — name, address, phone, matter number, etc.",
    },
    {
      key: "clio_custom",
      label: "Clio Custom",
      description: "Hillary's custom fields in Clio — checkboxes, dates, and text fields added to contacts and matters.",
    },
    {
      key: "quill_blocks",
      label: "Quill Blocks",
      description: "Complex text blocks and conditional variables that have no direct Clio equivalent — trustee lists, agent structures, pregnancy clause, etc.",
    },
  ];

  const activeInfo = TABS.find((t) => t.key === activeTab)!;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Field Reference</h1>
        <p className="text-sm text-slate-500 mt-1">
          All variables available in Word templates. Click any syntax pill to copy it, then paste into your .docx file.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-2 bg-slate-100 rounded-lg p-1 w-fit">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              activeTab === tab.key ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700")}>
            {tab.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400 mb-5">{activeInfo.description}</p>

      {activeTab === "clio_standard" && <ClioStandardTab />}
      {activeTab === "clio_custom" && <ClioCustomTab />}
      {activeTab === "quill_blocks" && <QuillBlocksTab />}
    </div>
  );
}


// ─── Shared toolbar: Search + All pill + Filter dropdown ──────────────────────

function FieldToolbar({
  search, onSearch,
  filterValue, onFilter,
  filterOptions, // [{ value, label, count }]
  totalShown, totalAll,
  rightSlot,
}: {
  search: string;
  onSearch: (v: string) => void;
  filterValue: string;
  onFilter: (v: string) => void;
  filterOptions: { value: string; label: string; count: number }[];
  totalShown: number;
  totalAll: number;
  rightSlot?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const activeOption = filterOptions.find((o) => o.value === filterValue);

  return (
    <div className="flex items-center gap-2">
      <Input
        placeholder="Search fields..."
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        className="h-8 text-sm w-60"
      />

      {/* All pill */}
      <button
        onClick={() => onFilter("all")}
        className={cn("h-8 px-3 rounded-md text-sm font-medium border transition-colors",
          filterValue === "all"
            ? "bg-slate-900 text-white border-slate-900"
            : "border-slate-200 text-slate-600 hover:border-slate-400"
        )}>
        All ({totalAll})
      </button>

      {/* Filter dropdown */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((s) => !s)}
          className={cn(
            "h-8 px-3 rounded-md text-sm font-medium border flex items-center gap-1.5 transition-colors",
            filterValue !== "all"
              ? "bg-slate-900 text-white border-slate-900"
              : "border-slate-200 text-slate-600 hover:border-slate-400"
          )}>
          {filterValue !== "all" && activeOption ? activeOption.label : "Filter"}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
        {open && (
          <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-52 max-h-72 overflow-y-auto">
            {filterOptions.map((opt) => (
              <button key={opt.value}
                onClick={() => { onFilter(opt.value); setOpen(false); }}
                className={cn("w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 flex items-center justify-between",
                  filterValue === opt.value && "font-medium text-slate-900")}>
                <span>{opt.label}</span>
                <span className="text-xs text-slate-400">{opt.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="text-xs text-slate-400 ml-1">{totalShown} shown</span>
      {rightSlot && <div className="ml-auto">{rightSlot}</div>}
    </div>
  );
}


// ─── Copy pill (shared) ───────────────────────────────────────────────────────

function CopyPill({ syntax }: { syntax: string }) {
  function copy() {
    navigator.clipboard.writeText(syntax);
    toast.success("Copied", { description: syntax, duration: 1500 });
  }
  return (
    <button onClick={copy}
      className="flex items-center gap-1.5 font-mono text-xs bg-slate-800 text-white px-2.5 py-1 rounded-md hover:bg-slate-600 transition-colors shrink-0">
      {syntax}
      <Copy className="h-3 w-3 opacity-60" />
    </button>
  );
}


// ─── Clio Standard Tab ────────────────────────────────────────────────────────

function ClioStandardTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["clio-standard-fields"],
    queryFn: () => listClioStandardFields().then((r) => r.data.data),
  });
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");

  if (isLoading) return <div className="text-slate-400 text-sm">Loading...</div>;

  const allFields = data ?? [];
  const groups = Array.from(new Set(allFields.map((f) => f.group)));

  const filtered = allFields.filter((f) => {
    const matchGroup = groupFilter === "all" || f.group === groupFilter;
    const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.variable_name.includes(search.toLowerCase());
    return matchGroup && matchSearch;
  });

  const filterOptions = groups.map((g) => ({
    value: g,
    label: g,
    count: allFields.filter((f) => f.group === g).length,
  }));

  const SOURCE_COLORS: Record<string, string> = {
    contact: "bg-blue-50 text-blue-600",
    matter: "bg-purple-50 text-purple-600",
    system: "bg-amber-50 text-amber-600",
  };

  return (
    <div className="space-y-4">
      <FieldToolbar
        search={search} onSearch={setSearch}
        filterValue={groupFilter} onFilter={setGroupFilter}
        filterOptions={filterOptions}
        totalShown={filtered.length} totalAll={allFields.length}
      />

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-2 bg-slate-50 border-b border-slate-200 gap-4">
          <span>Field name</span>
          <span>Group</span>
          <span>Source</span>
          <span>Template syntax</span>
        </div>
        <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
          {filtered.map((f) => (
            <div key={f.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-2.5 hover:bg-slate-50 gap-4">
              <span className="text-sm text-slate-900">{f.name}</span>
              <span className="text-xs text-slate-400">{f.group}</span>
              <Badge variant="secondary" className={cn("text-xs font-normal", SOURCE_COLORS[f.source] ?? "bg-slate-100 text-slate-500")}>
                {f.source}
              </Badge>
              <CopyPill syntax={f.template_syntax} />
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-sm text-slate-400 text-center">No fields match your search.</div>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-400">Read only · these fields are always available from Clio and system context.</p>
    </div>
  );
}


// ─── Clio Custom Tab ──────────────────────────────────────────────────────────

function ClioCustomTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["clio-fields"],
    queryFn: () => listClioFields().then((r) => r.data.data),
  });
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");

  if (isLoading) return <div className="text-slate-400 text-sm">Loading Clio custom fields...</div>;

  const allFields = data ?? [];

  const filtered = allFields.filter((f) => {
    const matchSource = sourceFilter === "all" || f.source === sourceFilter;
    const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.variable_name.includes(search.toLowerCase());
    return matchSource && matchSearch;
  });

  const filterOptions = [
    { value: "contact", label: "Contact fields", count: allFields.filter((f) => f.source === "contact").length },
    { value: "matter", label: "Matter fields", count: allFields.filter((f) => f.source === "matter").length },
  ];

  return (
    <div className="space-y-4">
      <FieldToolbar
        search={search} onSearch={setSearch}
        filterValue={sourceFilter} onFilter={setSourceFilter}
        filterOptions={filterOptions}
        totalShown={filtered.length} totalAll={allFields.length}
      />

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-2 bg-slate-50 border-b border-slate-200 gap-4">
          <span>Field name</span>
          <span>Type</span>
          <span>Source</span>
          <span>Template syntax</span>
        </div>
        <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
          {filtered.map((f) => (
            <div key={f.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-2.5 hover:bg-slate-50 gap-4">
              <span className="text-sm text-slate-900">{f.name}</span>
              <span className="text-xs text-slate-400">{f.field_type}</span>
              <Badge variant="secondary" className={cn("text-xs font-normal",
                f.source === "contact" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600")}>
                {f.source}
              </Badge>
              <CopyPill syntax={f.template_syntax} />
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-sm text-slate-400 text-center">No fields match your search.</div>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-400">Read only · pulled live from your connected Clio account. Variable names are auto-generated from the field name.</p>
    </div>
  );
}


// ─── Quill Blocks Tab ─────────────────────────────────────────────────────────

function QuillBlocksTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["quill-fields"],
    queryFn: () => listQuillFields().then((r) => r.data.data),
  });
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteQuillField(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quill-fields"] }); toast.success("Block removed"); },
  });

  if (isLoading) return <div className="text-slate-400 text-sm">Loading...</div>;

  const allFields = data ?? [];
  const activeCats = Array.from(new Set(allFields.map((f) => f.category || "General")));

  const filtered = allFields.filter((f) => {
    const cat = f.category || "General";
    const matchCat = catFilter === "all" || cat === catFilter;
    const matchSearch = !search || f.label.toLowerCase().includes(search.toLowerCase()) || f.variable_name.includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const filterOptions = activeCats.map((cat) => ({
    value: cat,
    label: cat,
    count: allFields.filter((f) => (f.category || "General") === cat).length,
  }));

  return (
    <div className="space-y-4">
      <FieldToolbar
        search={search} onSearch={setSearch}
        filterValue={catFilter} onFilter={setCatFilter}
        filterOptions={filterOptions}
        totalShown={filtered.length} totalAll={allFields.length}
        rightSlot={
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Block
          </Button>
        }
      />

      {showAdd && (
        <AddQuillBlockForm
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ["quill-fields"] }); }}
        />
      )}

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-2 bg-slate-50 border-b border-slate-200 gap-4">
          <span>Block name</span>
          <span>Category</span>
          <span>Template syntax</span>
          <span></span>
        </div>
        <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
          {filtered.map((f) =>
            editingId === f.id
              ? <EditQuillBlockRow key={f.id} field={f}
                  onDone={() => { setEditingId(null); qc.invalidateQueries({ queryKey: ["quill-fields"] }); }} />
              : (
                <div key={f.id} className={cn("grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-2.5 hover:bg-slate-50 gap-4 group",
                  !f.active && "opacity-50")}>
                  <div>
                    <span className="text-sm text-slate-900">{f.label}</span>
                    {f.description && <p className="text-xs text-slate-400 mt-0.5">{f.description}</p>}
                  </div>
                  <Badge variant="secondary" className="text-xs font-normal text-slate-500 shrink-0">{f.category}</Badge>
                  <CopyPill syntax={f.template_syntax} />
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => setEditingId(f.id)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => { if (confirm(`Remove "${f.label}"?`)) deleteMut.mutate(f.id); }}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
          )}
          {filtered.length === 0 && allFields.length > 0 && (
            <div className="px-4 py-8 text-sm text-slate-400 text-center">No blocks match your filter.</div>
          )}
          {allFields.length === 0 && (
            <div className="px-4 py-12 text-sm text-slate-400 text-center">
              No Quill blocks defined yet. Add one to get started.
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-400">Quill blocks hold complex or conditional text filled in by the wizard — not available as plain Clio fields.</p>
    </div>
  );
}


// ─── Edit inline row ──────────────────────────────────────────────────────────

function EditQuillBlockRow({ field, onDone }: { field: QuillFieldDef; onDone: () => void }) {
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
      toast.success("Block updated");
      onDone();
    } catch { toast.error("Failed to update"); }
    finally { setSaving(false); }
  }

  return (
    <div className="px-4 py-3 bg-blue-50 border-l-2 border-blue-400 space-y-2 col-span-4">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs mb-1 block">Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-7 text-sm" autoFocus />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Category</Label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="h-7 w-full text-sm rounded-md border border-input bg-background px-2">
            {QUILL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div>
        <Label className="text-xs mb-1 block">Description</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-7 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs mb-1 block">Example value</Label>
          <Input value={example} onChange={(e) => setExample(e.target.value)} className="h-7 text-sm" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Applies to (wizard_keys, comma-sep, or "all")</Label>
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


// ─── Add new block form ───────────────────────────────────────────────────────

function AddQuillBlockForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
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
      toast.success(`Block "{{ ${variable_name} }}" added`);
      onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Failed to add block");
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
      <p className="text-sm font-medium text-slate-900">Add New Quill Block</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs mb-1 block">Label</Label>
          <Input value={label} onChange={(e) => handleLabelChange(e.target.value)} className="h-8 text-sm" autoFocus placeholder="e.g. Pregnancy Clause" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Variable name (auto)</Label>
          <Input value={variable_name} onChange={(e) => setVariableName(e.target.value)} className="h-8 text-sm font-mono" placeholder="e.g. pregnancy_clause" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Category</Label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="h-8 w-full text-sm rounded-md border border-input bg-background px-2">
            {QUILL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Example value</Label>
          <Input value={example} onChange={(e) => setExample(e.target.value)} className="h-8 text-sm" placeholder="e.g. In the event of pregnancy..." />
        </div>
      </div>
      <div>
        <Label className="text-xs mb-1 block">Description</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-8 text-sm" placeholder="What this block is for..." />
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
