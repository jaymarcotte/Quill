"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMatterRelationships,
  getContact,
  updateContact,
  createContact,
  addMatterRelationship,
  removeMatterRelationship,
  type ContactCard,
  type ContactFull,
  type MatterRelationship,
} from "@/lib/api";
import { ContactSearch } from "./contact-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserCircle, Pencil, X, Plus, Loader2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  matterId: number;
}

export function ContactPanel({ matterId }: Props) {
  const qc = useQueryClient();
  const [addingContact, setAddingContact] = useState(false);
  const [selectedForAdd, setSelectedForAdd] = useState<ContactCard | null>(null);
  const [linkLabel, setLinkLabel] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);
  const [newContact, setNewContact] = useState({ first_name: "", last_name: "", phone: "", email: "" });

  const { data: relationships, isLoading } = useQuery({
    queryKey: ["matter-relationships", matterId],
    queryFn: () => getMatterRelationships(matterId).then((r) => r.data.data as MatterRelationship[]),
  });

  const addRelMut = useMutation({
    mutationFn: ({ contactId, desc }: { contactId: number; desc: string }) =>
      addMatterRelationship(matterId, contactId, desc || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matter-relationships", matterId] });
      setAddingContact(false);
      setSelectedForAdd(null);
      setLinkLabel("");
      toast.success("Contact linked to matter");
    },
    onError: () => toast.error("Failed to link contact"),
  });

  const removeRelMut = useMutation({
    mutationFn: (relId: number) => removeMatterRelationship(matterId, relId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matter-relationships", matterId] });
      toast.success("Contact removed from matter");
    },
    onError: () => toast.error("Failed to remove contact"),
  });

  const createMut = useMutation({
    mutationFn: (data: typeof newContact) => createContact(data),
    onSuccess: (res) => {
      const contact = res.data.data;
      addRelMut.mutate({ contactId: contact.id, desc: linkLabel });
      setCreatingNew(false);
      setNewContact({ first_name: "", last_name: "", phone: "", email: "" });
    },
    onError: () => toast.error("Failed to create contact in Clio"),
  });

  if (isLoading) {
    return <div className="flex items-center gap-2 text-sm text-slate-400 py-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading contacts...</div>;
  }

  const rels = relationships ?? [];

  return (
    <div className="space-y-3">
      {/* Existing contacts */}
      {rels.length > 0 && (
        <div className="space-y-2">
          {rels.map((rel) => (
            <ContactCard
              key={rel.id}
              relationship={rel}
              onRemove={() => removeRelMut.mutate(rel.id)}
            />
          ))}
        </div>
      )}

      {/* Add contact row */}
      {!addingContact && !creatingNew && (
        <button
          onClick={() => setAddingContact(true)}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 py-1"
        >
          <Plus className="h-4 w-4" />
          Add contact to this matter
        </button>
      )}

      {addingContact && !creatingNew && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
          <div>
            <Label className="text-xs mb-1.5 block text-slate-600">Search Clio contacts</Label>
            <ContactSearch
              value={selectedForAdd}
              onChange={setSelectedForAdd}
              placeholder="Search by name..."
              onCreateNew={(q) => {
                setAddingContact(false);
                setCreatingNew(true);
                setNewContact((prev) => ({ ...prev, first_name: q }));
              }}
            />
          </div>
          {selectedForAdd && (
            <div>
              <Label className="text-xs mb-1.5 block text-slate-600">
                Link label <span className="text-slate-400">(optional — e.g. "Client 2", "Beneficiary")</span>
              </Label>
              <Input
                placeholder="e.g. Client 2"
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!selectedForAdd || addRelMut.isPending}
              onClick={() => selectedForAdd && addRelMut.mutate({ contactId: selectedForAdd.id, desc: linkLabel })}
            >
              {addRelMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Add to Matter
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setAddingContact(false); setSelectedForAdd(null); setLinkLabel(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {creatingNew && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-3">
          <p className="text-xs font-medium text-slate-700">Create new contact in Clio</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs mb-1 block">First Name</Label>
              <Input value={newContact.first_name} onChange={(e) => setNewContact((p) => ({ ...p, first_name: e.target.value }))} className="h-8 text-sm" autoFocus />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Last Name</Label>
              <Input value={newContact.last_name} onChange={(e) => setNewContact((p) => ({ ...p, last_name: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Phone</Label>
              <Input value={newContact.phone} onChange={(e) => setNewContact((p) => ({ ...p, phone: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Email</Label>
              <Input value={newContact.email} onChange={(e) => setNewContact((p) => ({ ...p, email: e.target.value }))} className="h-8 text-sm" type="email" />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block text-slate-600">Link label <span className="text-slate-400">(optional)</span></Label>
            <Input placeholder="e.g. Beneficiary" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={!newContact.first_name || createMut.isPending}
              onClick={() => createMut.mutate(newContact)}>
              {createMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Create &amp; Add to Matter
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setCreatingNew(false); setLinkLabel(""); }}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}


function ContactCard({ relationship, onRemove }: { relationship: MatterRelationship; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {/* Summary row */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        <UserCircle className="h-5 w-5 text-slate-300 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900 truncate">{relationship.contact.name}</span>
            {relationship.description && (
              <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                {relationship.description}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded((s) => !s)}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded"
            title="View/edit contact"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 text-slate-300 hover:text-red-500 rounded"
            title="Remove from matter"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Edit popover */}
      {expanded && (
        <ContactEditPanel
          contactId={relationship.contact.id}
          onClose={() => setExpanded(false)}
        />
      )}
    </div>
  );
}


function ContactEditPanel({ contactId, onClose }: { contactId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["contact-full", contactId],
    queryFn: () => getContact(contactId).then((r) => r.data.data),
  });

  const [form, setForm] = useState<Partial<ContactFull>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Populate form when data loads
  const initialized = Object.keys(form).length > 0;
  if (data && !initialized) {
    setForm({
      first_name: data.first_name,
      last_name: data.last_name,
      prefix: data.prefix,
      email: data.email,
      phone: data.phone,
      street: data.street,
      city: data.city,
      province: data.province,
      postal_code: data.postal_code,
      middle_name: data.middle_name,
      pronoun: data.pronoun,
      special_notes: data.special_notes,
    });
  }

  function set(key: keyof ContactFull, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      await updateContact(contactId, form);
      qc.invalidateQueries({ queryKey: ["contact-full", contactId] });
      toast.success("Contact updated in Clio");
      setDirty(false);
    } catch {
      toast.error("Failed to update contact");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="border-t border-slate-100 px-3 py-3 flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading contact details...
      </div>
    );
  }

  return (
    <div className="border-t border-slate-100 px-3 py-3 bg-slate-50">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-slate-600">Edit contact — saves directly to Clio</p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div>
          <Label className="text-xs mb-1 block">Prefix</Label>
          <Input value={form.prefix ?? ""} onChange={(e) => set("prefix", e.target.value)} className="h-7 text-xs" placeholder="Mr./Ms." />
        </div>
        <div>
          <Label className="text-xs mb-1 block">First Name</Label>
          <Input value={form.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} className="h-7 text-xs" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Middle Name</Label>
          <Input value={form.middle_name ?? ""} onChange={(e) => set("middle_name", e.target.value)} className="h-7 text-xs" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <Label className="text-xs mb-1 block">Last Name</Label>
          <Input value={form.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} className="h-7 text-xs" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Pronoun</Label>
          <div className="flex gap-1">
            {["He", "She", "They"].map((p) => (
              <button key={p} onClick={() => { set("pronoun", p); setDirty(true); }}
                className={cn("flex-1 h-7 text-xs rounded border transition-colors",
                  form.pronoun === p ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600 hover:border-slate-400")}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <Label className="text-xs mb-1 block">Phone</Label>
          <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} className="h-7 text-xs" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Email</Label>
          <Input value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} className="h-7 text-xs" type="email" />
        </div>
      </div>

      <div className="mb-2">
        <Label className="text-xs mb-1 block">Street Address</Label>
        <Input value={form.street ?? ""} onChange={(e) => set("street", e.target.value)} className="h-7 text-xs" />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="col-span-1">
          <Label className="text-xs mb-1 block">City</Label>
          <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} className="h-7 text-xs" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">State</Label>
          <Input value={form.province ?? ""} onChange={(e) => set("province", e.target.value)} className="h-7 text-xs" placeholder="AZ" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">ZIP</Label>
          <Input value={form.postal_code ?? ""} onChange={(e) => set("postal_code", e.target.value)} className="h-7 text-xs" />
        </div>
      </div>

      <div className="mb-3">
        <Label className="text-xs mb-1 block">Special Notes</Label>
        <textarea
          value={form.special_notes ?? ""}
          onChange={(e) => set("special_notes", e.target.value)}
          rows={2}
          className="w-full text-xs rounded-md border border-input bg-background px-3 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Notes visible in Clio..."
        />
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
          Save to Clio
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
        {!dirty && <span className="text-xs text-slate-400">No changes</span>}
      </div>
    </div>
  );
}
