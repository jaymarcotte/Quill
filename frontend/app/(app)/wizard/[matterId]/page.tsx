"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getMatter, listDocumentTypes, generateDocument, getFirmSettings, type DocType } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, FileDown, Loader2, Check, Search, X, Pencil, UserCircle, UserPlus } from "lucide-react";
import { ContactPanel } from "@/components/wizard/contact-panel";
import { useQueryClient } from "@tanstack/react-query";
import { searchContacts, getContact, type ContactCard } from "@/lib/api";
import { cn } from "@/lib/utils";

// Clio document checkbox field IDs → wizard_key mapping
const CLIO_FIELD_TO_KEY: Record<number, string> = {
  15903668: "engagement_letter",
  15903683: "trust",
  15903698: "pourover_will",
  15903713: "will_no_trust",
  15903728: "hc_poa",
  15903743: "general_poa",
  15903758: "special_warranty_deed",
  15903773: "beneficiary_deed",
  15903788: "closing_letter",
  15903803: "trust_amendment",
  15903833: "living_will",
};

const MATTER_TYPES = [
  { key: "estate_planning",              label: "Estate Planning",                 description: "Trusts, wills, POAs, living wills, and related documents" },
  { key: "probate",                      label: "Probate",                         description: "Court-supervised administration of a deceased person's estate" },
  { key: "guardianship_conservatorship", label: "Guardianship / Conservatorship",  description: "Legal authority over a minor or incapacitated adult" },
  { key: "trust_administration",         label: "Trust Administration",            description: "Ongoing administration of an existing trust" },
];

type WizardData = {
  matter_type: string;
  structure: "single" | "joint";
  client: { id: number; name: string; first_name: string; last_name: string; prefix: string } | null;
  client_2: { id: number; name: string; first_name: string; last_name: string; prefix: string } | null;
  pronoun: "He" | "She" | "They";   // Clio picklist value — drives all pronoun template variables
  is_female: boolean;                 // derived from pronoun; kept for legacy template compat
  include_pregnancy_clause: boolean;
  trust_name: string;
  trustee_1: string;
  trustee_2: string;
  trustee_structure: "sequential" | "co_trustees";
  hc_agent_1: string;
  hc_agent_2: string;
  hc_agent_structure: "single" | "co_agents" | "primary_successor";
  poa_agent_1a: string;
  poa_agent_1b: string;
  poa_andor: string;
  poa_agent_2: string;
  poa_agent_3: string;
  poa_has_co_agents: boolean;
  has_brokerage: boolean;
  has_llc: boolean;
  has_special_warranty_deed: boolean;
  other_account_name: string;
  selected_documents: string[];
  rate_key: string;
  deposit: string;
  pronoun_2: "He" | "She" | "They";
  is_female_2: boolean;
  include_pregnancy_clause_2: boolean;
};

const RATE_TYPES = [
  { key: "flat_joint_trust",      label: "Flat Rate — Joint Trust Estate Plan",         description: "a flat fee of {amount} for a joint trust-based estate plan" },
  { key: "flat_individual_trust", label: "Flat Rate — Individual Trust Estate Plan",     description: "a flat fee of {amount} for an individual trust-based estate plan" },
  { key: "flat_joint_will",       label: "Flat Rate — Joint Will & Beneficiary Deed",    description: "a flat fee of {amount} for a joint will-based estate plan including a beneficiary deed" },
  { key: "flat_individual_will",  label: "Flat Rate — Individual Will & Beneficiary Deed", description: "a flat fee of {amount} for an individual will-based estate plan including a beneficiary deed" },
  { key: "hourly",                label: "Hourly Rate",                                  description: "an hourly basis at the rate of {amount} per hour" },
];

function rateLabel(key: string) {
  return RATE_TYPES.find((r) => r.key === key)?.label ?? key;
}

// Steps appear in this fixed order when the corresponding document is selected.
// Each entry: [step_name, wizard_key_that_triggers_it]
const DOCUMENT_STEPS: [string, string][] = [
  ["Engagement Letter", "engagement_letter"],
  ["Trust",            "trust"],
  ["Health Care POA",  "hc_poa"],
  ["General POA",      "general_poa"],
  ["Living Will",      "living_will"],
  ["Closing Letter",   "closing_letter"],
];

function getSteps(matterType: string, selectedDocs: string[]): string[] {
  if (matterType === "probate") {
    return ["Matter Type", "Probate Setup", "Review"];
  }
  if (matterType === "guardianship_conservatorship") {
    return ["Matter Type", "Guardianship Setup", "Review"];
  }
  if (matterType === "trust_administration") {
    return ["Matter Type", "Trust Admin Setup", "Review"];
  }
  // Default: Estate Planning (or not yet selected)
  const steps = ["Matter Type", "Setup", "Documents"];
  for (const [stepName, key] of DOCUMENT_STEPS) {
    if (selectedDocs.includes(key)) steps.push(stepName);
  }
  steps.push("Review");
  return steps;
}

export default function WizardPage() {
  const { matterId } = useParams<{ matterId: string }>();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({
    matter_type: "",
    structure: "single",
    client: null,
    client_2: null,
    pronoun: "He",
    is_female: false,
    include_pregnancy_clause: false,
    trust_name: "",
    trustee_1: "",
    trustee_2: "",
    trustee_structure: "sequential",
    hc_agent_1: "",
    hc_agent_2: "",
    hc_agent_structure: "single",
    poa_agent_1a: "",
    poa_agent_1b: "",
    poa_andor: "and/or",
    poa_agent_2: "",
    poa_agent_3: "",
    poa_has_co_agents: false,
    has_brokerage: false,
    has_llc: false,
    has_special_warranty_deed: false,
    other_account_name: "",
    selected_documents: [],
    rate_key: "",
    deposit: "",
    pronoun_2: "He",
    is_female_2: false,
    include_pregnancy_clause_2: false,
  });
  const [firmRates, setFirmRates] = useState<Record<string, string>>({});
  const [clioAutoFilled, setClioAutoFilled] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: matter, isLoading: matterLoading } = useQuery({
    queryKey: ["matter", matterId],
    queryFn: () => getMatter(Number(matterId)).then((r) => r.data.data),
  });

  const { data: docTypes } = useQuery({
    queryKey: ["document-types"],
    queryFn: () => listDocumentTypes().then((r) => r.data.data),
  });

  // Fetch firm rates on mount for fee step and generate payload
  useEffect(() => {
    getFirmSettings()
      .then((r) => setFirmRates(r.data.data.rates))
      .catch(() => {});
  }, []);

  // Auto-populate wizard state from Clio custom field values when matter loads
  useEffect(() => {
    if (!matter?.custom_field_values) return;

    // Build lookup by custom_field.id for scalar fields
    const byFieldId: Record<number, unknown> = {};
    for (const cf of matter.custom_field_values) {
      const cfAny = cf as any;
      const defId = cfAny.custom_field?.id;
      if (defId !== undefined) byFieldId[defId] = cf.value;
    }

    const patch: Partial<WizardData> = {};
    const filled: string[] = [];

    // Clients are NOT auto-populated — user selects them manually via ClientCard search.
    // Pronoun is fetched automatically when a client is selected (see ClientCard.select()).

    // Trust name (field 14358376)
    if (byFieldId[14358376]) { patch.trust_name = String(byFieldId[14358376]); filled.push("Trust Name"); }

    // Estate structure: "Joint" or "Single" (field 15902438)
    const structureVal = String(byFieldId[15902438] ?? "").toLowerCase();
    if (structureVal === "joint") { patch.structure = "joint"; filled.push("Estate Structure"); }
    else if (structureVal === "single") { patch.structure = "single"; filled.push("Estate Structure"); }

    // Pronoun from matter-level field (14358646) — fallback if contact fetch hasn't resolved yet
    const pronounRaw = String(byFieldId[14358646] ?? "").trim();
    if (pronounRaw && !patch.client) {
      const p = pronounRaw.toLowerCase();
      if (p.startsWith("she"))       { patch.pronoun = "She"; patch.is_female = true; }
      else if (p.startsWith("they")) { patch.pronoun = "They"; patch.is_female = false; }
      else                           { patch.pronoun = "He";  patch.is_female = false; }
    }

    // HC agent structure (field 14078733)
    const hcStructure = String(byFieldId[14078733] ?? "").toLowerCase();
    if (hcStructure) {
      if (hcStructure.includes("co")) patch.hc_agent_structure = "co_agents";
      else if (hcStructure.includes("successor") || hcStructure.includes("primary")) patch.hc_agent_structure = "primary_successor";
      else patch.hc_agent_structure = "single";
      filled.push("HC Agent Structure");
    }

    // POA agents (fields 14759332, 14759377, 13845063, 13845093)
    if (byFieldId[14759332]) patch.poa_agent_1a = String(byFieldId[14759332]);
    if (byFieldId[14759377]) patch.poa_agent_1b = String(byFieldId[14759377]);
    if (byFieldId[13845063]) patch.poa_agent_2  = String(byFieldId[13845063]);
    if (byFieldId[13845093]) patch.poa_agent_3  = String(byFieldId[13845093]);
    if (patch.poa_agent_1a || patch.poa_agent_1b) filled.push("POA Agents");
    if (patch.poa_agent_1b)  patch.poa_has_co_agents = true;

    // Trustees (field 14759662 — comma-separated or single name)
    if (byFieldId[14759662]) {
      const trustees = String(byFieldId[14759662]).split(/,\s*/);
      if (trustees[0]) patch.trustee_1 = trustees[0];
      if (trustees[1]) patch.trustee_2 = trustees[1];
      filled.push("Trustees");
    }

    // Children (fields 14078358, 14078583) — will populate child_1/child_2 once trustees step is built

    // Document checkboxes (fields 15903668–15903833)
    const docFieldMap: Record<number, string> = {
      15903668: "engagement_letter",
      15903683: "trust",
      15903698: "pourover_will",
      15903713: "will_no_trust",
      15903728: "hc_poa",
      15903743: "general_poa",
      15903758: "special_warranty_deed",
      15903773: "beneficiary_deed",
      15903788: "closing_letter",
      15903803: "trust_amendment",
      15903833: "living_will",
    };
    const preSelected: string[] = [];
    for (const [fieldId, wizKey] of Object.entries(docFieldMap)) {
      if (byFieldId[Number(fieldId)] === true) preSelected.push(wizKey);
    }
    if (preSelected.length > 0) { patch.selected_documents = preSelected; filled.push(`${preSelected.length} document${preSelected.length !== 1 ? "s" : ""} selected`); }

    if (Object.keys(patch).length > 0) {
      setData((prev) => ({ ...prev, ...patch }));
      setClioAutoFilled(filled);
    }
  }, [matter]);

  const steps = getSteps(data.matter_type, data.selected_documents);

  function update<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function toggleDocument(key: string) {
    setData((prev) => ({
      ...prev,
      selected_documents: prev.selected_documents.includes(key)
        ? prev.selected_documents.filter((d) => d !== key)
        : [...prev.selected_documents, key],
    }));
  }

  function toggleAll(allKeys: string[]) {
    setData((prev) => ({
      ...prev,
      selected_documents: prev.selected_documents.length === allKeys.length ? [] : [...allKeys],
    }));
  }

async function handleGenerate() {
    if (!matter || !data.client) return;
    if (data.selected_documents.length === 0) { toast.error("No documents selected."); return; }
    setIsGenerating(true);
    const matterLabel = `${matter.display_number} - ${matter.description}`;
    const wizardPayload = {
      matter_type: data.matter_type,
      client: {
        name: data.client.name,
        first_name: data.client.first_name,
        last_name: data.client.last_name,
        prefix: data.client.prefix,
      },
      pronoun: data.pronoun,
      is_female: data.is_female,
      include_pregnancy_clause: data.include_pregnancy_clause,
      trust_name: data.trust_name,
      trustee_1: data.trustee_1,
      trustee_2: data.trustee_2,
      trustee_structure: data.trustee_structure,
      hc_agent_1: data.hc_agent_1,
      hc_agent_2: data.hc_agent_2,
      hc_agent_structure: data.hc_agent_structure,
      poa_agent_1a: data.poa_agent_1a,
      poa_agent_1b: data.poa_agent_1b,
      poa_andor: data.poa_andor,
      poa_agent_2: data.poa_agent_2,
      poa_agent_3: data.poa_agent_3,
      poa_has_co_agents: data.poa_has_co_agents,
      has_brokerage: data.has_brokerage,
      has_llc: data.has_llc,
      has_special_warranty_deed: data.has_special_warranty_deed,
      other_account_name: data.other_account_name,
      selected_documents: data.selected_documents,
      rate_key: data.rate_key,
      attorney_rate: data.rate_key && firmRates ? (firmRates[data.rate_key] ?? "") : "",
      rate_type: data.rate_key,
      rate_description: data.rate_key && firmRates
        ? (RATE_TYPES.find((r) => r.key === data.rate_key)?.description ?? "").replace("{amount}", firmRates[data.rate_key] ?? "")
        : "",
      deposit: data.deposit,
      client_2: data.client_2,
      pronoun_2: data.pronoun_2,
      is_female_2: data.is_female_2,
      include_pregnancy_clause_2: data.include_pregnancy_clause_2,
    };

    const requests = data.selected_documents.map((wizard_key) => ({
      wizard_key,
      payload: {
        matter_id: matter.id,
        matter_label: matterLabel,
        wizard_key,
        structure: data.structure,
        wizard_data: wizardPayload,
        generate_pdf: true,
        upload_to_clio: false,
      } as Parameters<typeof generateDocument>[0],
    }));

    const results = await Promise.allSettled(requests.map((r) => generateDocument(r.payload)));
    let successCount = 0;
    results.forEach((result, idx) => {
      const label = (docTypes ?? []).find((d) => d.wizard_key === requests[idx].wizard_key)?.label ?? requests[idx].wizard_key;
      if (result.status === "fulfilled") {
        successCount++;
        toast.success(`${label} generated`, {
          description: `Job #${result.value.data.job_id} ready.`,
          action: { label: "Go to Documents", onClick: () => router.push("/documents") },
        });
      } else {
        toast.error(`${label} failed`, { description: "Check backend logs." });
      }
    });

    setIsGenerating(false);
    if (successCount > 0) {
      toast.success(`${successCount} of ${requests.length} documents generated.`, {
        action: { label: "View Documents", onClick: () => router.push("/documents") },
      });
    }
  }

  if (matterLoading) {
    return (
      <div className="flex items-center justify-center h-full py-32 text-slate-400">
        <Loader2 className="animate-spin h-6 w-6 mr-2" /> Loading matter...
      </div>
    );
  }

  const matterLabel = matter ? `${matter.display_number} — ${matter.description}` : matterId;
  const currentStepName = steps[step];

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button onClick={() => router.push("/matters")}
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 mb-4 transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back to matters
        </button>
        <h1 className="text-xl font-semibold text-slate-900">{matterLabel}</h1>

        {/* Clio auto-fill banner */}
        {clioAutoFilled.length > 0 && (
          <div className="mt-4 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
            <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Pre-filled from Clio: <span className="font-medium">{clioAutoFilled.join(", ")}</span>.
              Review each step and adjust if needed.
            </span>
            <button onClick={() => setClioAutoFilled([])} className="ml-auto shrink-0 text-emerald-400 hover:text-emerald-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Step progress */}
        <div className="flex items-center gap-2 mt-5 flex-wrap">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <button
                onClick={() => i < step && setStep(i)}
                className={cn(
                  "flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full transition-colors",
                  i === step ? "bg-slate-900 text-white"
                    : i < step ? "bg-green-100 text-green-700 cursor-pointer hover:bg-green-200"
                    : "bg-slate-100 text-slate-400 cursor-default"
                )}
              >
                {i < step && <Check className="h-3 w-3" />}
                {label}
              </button>
              {i < steps.length - 1 && (
                <div className={cn("h-px w-6", i < step ? "bg-green-300" : "bg-slate-200")} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        {currentStepName === "Matter Type" && (
          <StepMatterType data={data} update={update} onNext={() => setStep((s) => s + 1)} />
        )}
        {currentStepName === "Setup" && (
          <StepSetup data={data} update={update} matterId={Number(matterId)} />
        )}
        {currentStepName === "Probate Setup" && (
          <StepComingSoon title="Probate" description="The Probate workflow is coming in a future phase. Document generation for probate matters will be available once templates and required fields are defined." />
        )}
        {currentStepName === "Guardianship Setup" && (
          <StepComingSoon title="Guardianship / Conservatorship" description="The Guardianship and Conservatorship workflow is coming in a future phase." />
        )}
        {currentStepName === "Trust Admin Setup" && (
          <StepComingSoon title="Trust Administration" description="The Trust Administration workflow is coming in a future phase." />
        )}
        {currentStepName === "Documents" && (
          <StepDocuments data={data} docTypes={docTypes ?? []} toggle={toggleDocument} toggleAll={toggleAll} />
        )}
        {currentStepName === "Engagement Letter" && (
          <StepEngagementLetter data={data} update={update} firmRates={firmRates} />
        )}
        {currentStepName === "Trust" && (
          <StepTrust data={data} update={update} />
        )}
        {currentStepName === "Health Care POA" && (
          <StepHcPoa data={data} update={update} />
        )}
        {currentStepName === "General POA" && (
          <StepGeneralPoa data={data} update={update} />
        )}
        {currentStepName === "Living Will" && (
          <StepLivingWill data={data} />
        )}
        {currentStepName === "Closing Letter" && (
          <StepClosingLetter data={data} update={update} />
        )}
        {currentStepName === "Review" && (
          <StepReview data={data} matter={matter} docTypes={docTypes ?? []} onGenerate={handleGenerate} isGenerating={isGenerating} />
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        {step < steps.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : data.matter_type === "estate_planning" || data.matter_type === "" ? (
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
              : <><FileDown className="h-4 w-4 mr-2" /> Generate Documents</>
            }
          </Button>
        ) : (
          <Button variant="outline" onClick={() => router.push("/matters")}>
            Done — Return to Matters
          </Button>
        )}
      </div>
    </div>
  );
}


// --- Coming Soon placeholder ---

function StepComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="py-6 text-center space-y-3">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-2">
        <FileDown className="h-5 w-5 text-slate-400" />
      </div>
      <h2 className="text-lg font-medium text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500 max-w-sm mx-auto">{description}</p>
      <p className="text-xs text-slate-400">
        This section is reserved for Phase 2. Continue to Review to note the matter type.
      </p>
    </div>
  );
}


// --- Matter Type Step ---

function StepMatterType({ data, update, onNext }: { data: WizardData; update: Function; onNext: () => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-medium text-slate-900 mb-1">Matter Type</h2>
        <p className="text-sm text-slate-500">What kind of matter is this? This determines which documents are available.</p>
      </div>
      <div className="space-y-2">
        {MATTER_TYPES.map((mt) => {
          const selected = data.matter_type === mt.key;
          return (
            <button
              key={mt.key}
              onClick={() => { update("matter_type", mt.key); onNext(); }}
              className={cn(
                "w-full text-left px-4 py-4 rounded-lg border transition-colors",
                selected
                  ? "border-slate-900 bg-slate-50"
                  : "border-slate-200 hover:border-slate-300"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-4 h-4 rounded-full border-2 shrink-0",
                  selected ? "border-slate-900 bg-slate-900" : "border-slate-300"
                )} />
                <div>
                  <p className={cn("text-sm font-medium", selected ? "text-slate-900" : "text-slate-700")}>{mt.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{mt.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}


// --- Setup Step ---

// ClientCard — contact card with inline pronoun + edit panel, consistent for Client 1 and Client 2.
// On selection, fetches full contact to auto-set pronoun from Clio.
// Supports create-new for contacts not yet in Clio (used for Client 2).
function ClientCard({
  value,
  pronoun,
  pregnancyClause,
  onSelect,
  onClear,
  onPronounChange,
  onPregnancyChange,
  allowCreate = false,
}: {
  value: WizardData["client"];
  pronoun: "He" | "She" | "They";
  pregnancyClause: boolean;
  onSelect: (c: WizardData["client"], detectedPronoun?: "He" | "She" | "They") => void;
  onClear: () => void;
  onPronounChange: (p: "He" | "She" | "They") => void;
  onPregnancyChange: (v: boolean) => void;
  allowCreate?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newContact, setNewContact] = useState({ first_name: "", last_name: "", phone: "", email: "" });
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchContacts(query);
        setResults(r.data);
        setOpen(true);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  async function select(c: ContactCard) {
    setQuery("");
    setResults([]);
    setOpen(false);
    // Fetch full contact to read pronoun from Clio
    let detectedPronoun: "He" | "She" | "They" | undefined;
    try {
      const full = await getContact(c.id);
      const p = full.data.data.pronoun?.trim();
      if (p) {
        const pl = p.toLowerCase();
        if (pl.startsWith("she")) detectedPronoun = "She";
        else if (pl.startsWith("they")) detectedPronoun = "They";
        else detectedPronoun = "He";
      }
    } catch { /* ignore — user can set manually */ }
    onSelect({ id: c.id, name: c.name, first_name: c.first_name, last_name: c.last_name, prefix: c.prefix }, detectedPronoun);
  }

  async function createAndSelect() {
    setCreating(true);
    try {
      const res = await import("@/lib/api").then((m) => m.createContact(newContact));
      const c = res.data.data;
      onSelect({ id: c.id, name: c.name, first_name: c.first_name, last_name: c.last_name, prefix: c.prefix ?? "" });
      setCreatingNew(false);
      setNewContact({ first_name: "", last_name: "", phone: "", email: "" });
    } catch {
      const { toast } = await import("sonner");
      toast.error("Failed to create contact in Clio");
    } finally {
      setCreating(false);
    }
  }

  // Selected state — card with edit panel
  if (value) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {/* Summary row */}
        <div className="flex items-center gap-3 px-3 py-2.5">
          <UserCircle className="h-5 w-5 text-slate-300 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{value.name}</p>
            {/* Pronoun pills inline under name */}
            <div className="flex gap-1 mt-1.5">
              {([
                { label: "He/Him",    value: "He"   },
                { label: "She/Her",   value: "She"  },
                { label: "They/Them", value: "They" },
              ] as const).map(({ label: pl, value: pv }) => (
                <button
                  key={pv}
                  onClick={() => {
                    onPronounChange(pv);
                    if (pv !== "She") onPregnancyChange(false);
                  }}
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs border transition-colors",
                    pronoun === pv
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 text-slate-500 hover:border-slate-400"
                  )}
                >
                  {pl}
                </button>
              ))}
            </div>
            {/* Pregnancy clause — shown only when She/Her */}
            {pronoun === "She" && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-slate-500">Pregnancy clause in Living Will?</span>
                {([true, false] as const).map((v) => (
                  <button
                    key={String(v)}
                    onClick={() => onPregnancyChange(v)}
                    className={cn(
                      "px-2.5 py-0.5 rounded-full text-xs border transition-colors",
                      pregnancyClause === v
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 text-slate-500 hover:border-slate-400"
                    )}
                  >
                    {v ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 self-start mt-1">
            <button
              onClick={() => setEditing((s) => !s)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded"
              title="Edit contact"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onClear}
              className="p-1.5 text-slate-300 hover:text-red-500 rounded"
              title="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {/* Inline edit panel */}
        {editing && (
          <ContactEditInline contactId={value.id} onClose={() => setEditing(false)} />
        )}
      </div>
    );
  }

  // Search / create state
  if (creatingNew) {
    return (
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
        <div className="flex gap-2">
          <Button size="sm" disabled={!newContact.first_name || creating} onClick={createAndSelect}>
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Create &amp; Select
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCreatingNew(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          className="pl-9"
          placeholder="Search by name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />}
      </div>
      {open && (results.length > 0 || (!searching && query.length >= 2)) && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          {results.map((c) => (
            <button key={c.id} onClick={() => select(c)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
              <span className="font-medium text-slate-900">{c.name}</span>
              {c.email && <span className="text-slate-400 ml-2 text-xs">{c.email}</span>}
            </button>
          ))}
          {results.length === 0 && !searching && (
            <div className="px-4 py-3 text-sm text-slate-400">No contacts found.</div>
          )}
          {allowCreate && (
            <button
              onClick={() => { setOpen(false); setCreatingNew(true); }}
              className="w-full text-left px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 border-t border-slate-100 flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Create new contact in Clio
            </button>
          )}
        </div>
      )}
    </div>
  );
}


// Thin wrapper around ContactEditPanel that imports ContactEditPanel logic inline
// (reuses the same edit form that lives in contact-panel.tsx via a local copy)
function ContactEditInline({ contactId, onClose }: { contactId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getContact(contactId).then((r) => {
      const d = r.data.data;
      setForm({
        first_name: d.first_name ?? "",
        last_name: d.last_name ?? "",
        prefix: d.prefix ?? "",
        email: d.email ?? "",
        phone: d.phone ?? "",
        street: d.street ?? "",
        city: d.city ?? "",
        province: d.province ?? "",
        postal_code: d.postal_code ?? "",
        middle_name: d.middle_name ?? "",
        pronoun: d.pronoun ?? "",
        special_notes: d.special_notes ?? "",
      });
      setLoaded(true);
    }).catch((err) => { console.error("[Quill] ContactEditInline error:", err); setLoaded(true); });
  }, [contactId]);

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      await import("@/lib/api").then((m) => m.updateContact(contactId, form));
      qc.invalidateQueries({ queryKey: ["contact-full", contactId] });
      const { toast } = await import("sonner");
      toast.success("Contact updated in Clio");
      setDirty(false);
    } catch {
      const { toast } = await import("sonner");
      toast.error("Failed to update contact");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="border-t border-slate-100 px-3 py-3 flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
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
        <div><Label className="text-xs mb-1 block">Prefix</Label><Input value={form.prefix} onChange={(e) => set("prefix", e.target.value)} className="h-7 text-xs" placeholder="Mr./Ms." /></div>
        <div><Label className="text-xs mb-1 block">First Name</Label><Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} className="h-7 text-xs" /></div>
        <div><Label className="text-xs mb-1 block">Middle Name</Label><Input value={form.middle_name} onChange={(e) => set("middle_name", e.target.value)} className="h-7 text-xs" /></div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div><Label className="text-xs mb-1 block">Last Name</Label><Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} className="h-7 text-xs" /></div>
        <div>
          <Label className="text-xs mb-1 block">Pronoun</Label>
          <div className="flex gap-1">
            {["He", "She", "They"].map((p) => (
              <button key={p} onClick={() => set("pronoun", p)}
                className={cn("flex-1 h-7 text-xs rounded border transition-colors",
                  form.pronoun === p ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600 hover:border-slate-400")}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div><Label className="text-xs mb-1 block">Phone</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="h-7 text-xs" /></div>
        <div><Label className="text-xs mb-1 block">Email</Label><Input value={form.email} onChange={(e) => set("email", e.target.value)} className="h-7 text-xs" type="email" /></div>
      </div>
      <div className="mb-2"><Label className="text-xs mb-1 block">Street Address</Label><Input value={form.street} onChange={(e) => set("street", e.target.value)} className="h-7 text-xs" /></div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="col-span-1"><Label className="text-xs mb-1 block">City</Label><Input value={form.city} onChange={(e) => set("city", e.target.value)} className="h-7 text-xs" /></div>
        <div><Label className="text-xs mb-1 block">State</Label><Input value={form.province} onChange={(e) => set("province", e.target.value)} className="h-7 text-xs" placeholder="AZ" /></div>
        <div><Label className="text-xs mb-1 block">ZIP</Label><Input value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} className="h-7 text-xs" /></div>
      </div>
      <div className="mb-3">
        <Label className="text-xs mb-1 block">Special Notes</Label>
        <textarea value={form.special_notes} onChange={(e) => set("special_notes", e.target.value)} rows={2}
          className="w-full text-xs rounded-md border border-input bg-background px-3 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Notes visible in Clio..." />
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

function StepSetup({ data, update, matterId }: { data: WizardData; update: Function; matterId: number }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-slate-900">Estate Setup</h2>

      {/* Primary Client — card with inline pronoun + edit */}
      <div>
        <Label className="text-sm mb-1 block">Primary Client</Label>
        <p className="text-xs text-slate-400 mb-2">
          This person's name and address will appear on all generated documents.
        </p>
        <ClientCard
          value={data.client}
          pronoun={data.pronoun}
          pregnancyClause={data.include_pregnancy_clause}
          onSelect={(c, detectedPronoun) => {
            update("client", c);
            if (detectedPronoun) {
              update("pronoun", detectedPronoun);
              update("is_female", detectedPronoun === "She");
              if (detectedPronoun !== "She") update("include_pregnancy_clause", false);
            }
          }}
          onClear={() => update("client", null)}
          onPronounChange={(p) => { update("pronoun", p); update("is_female", p === "She"); }}
          onPregnancyChange={(v) => update("include_pregnancy_clause", v)}
        />
      </div>

      {/* Estate structure */}
      <div>
        <Label className="text-sm mb-2 block">Estate Structure</Label>
        <div className="flex gap-3">
          {(["single", "joint"] as const).map((v) => (
            <button key={v} onClick={() => update("structure", v)}
              className={cn("flex-1 py-2.5 rounded-lg border text-sm font-medium capitalize transition-colors",
                data.structure === v ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:border-slate-400")}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Secondary Client (Joint only) — card with inline pronoun + edit + create-new */}
      {data.structure === "joint" && (
        <div>
          <Label className="text-sm mb-1 block">Secondary Client (Client 2)</Label>
          <p className="text-xs text-slate-400 mb-2">
            The spouse or co-client. Their name will appear on joint documents.
          </p>
          <ClientCard
            value={data.client_2}
            pronoun={data.pronoun_2}
            pregnancyClause={data.include_pregnancy_clause_2}
            onSelect={(c, detectedPronoun) => {
              update("client_2", c);
              if (detectedPronoun) {
                update("pronoun_2", detectedPronoun);
                update("is_female_2", detectedPronoun === "She");
                if (detectedPronoun !== "She") update("include_pregnancy_clause_2", false);
              }
            }}
            onClear={() => update("client_2", null)}
            onPronounChange={(p) => { update("pronoun_2", p); update("is_female_2", p === "She"); if (p !== "She") update("include_pregnancy_clause_2", false); }}
            onPregnancyChange={(v) => update("include_pregnancy_clause_2", v)}
            allowCreate
          />
        </div>
      )}

      {/* Contacts */}
      <div>
        <Label className="text-sm mb-1 block">Matter Contacts</Label>
        <p className="text-xs text-slate-400 mb-3">
          Add everyone involved in this estate. These contacts are available for document roles.
        </p>
        <ContactPanel matterId={matterId} />
      </div>
    </div>
  );
}


// --- Documents Step ---

function StepDocuments({
  data, docTypes, toggle, toggleAll,
}: {
  data: WizardData;
  docTypes: DocType[];
  toggle: (k: string) => void;
  toggleAll: (keys: string[]) => void;
}) {
  const activeTypes = docTypes.filter((t) => t.active);
  const allKeys = activeTypes.map((t) => t.wizard_key);
  const allSelected = data.selected_documents.length === allKeys.length && allKeys.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-medium text-slate-900">Documents Needed</h2>
        <button
          onClick={() => toggleAll(allKeys)}
          className="text-sm text-slate-500 hover:text-slate-900 underline underline-offset-2"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-5">Select all documents for this estate plan.</p>
      <div className="grid grid-cols-2 gap-2">
        {activeTypes.map(({ wizard_key, label, has_template }) => {
          const selected = data.selected_documents.includes(wizard_key);
          return (
            <button key={wizard_key} onClick={() => toggle(wizard_key)}
              className={cn("flex items-center gap-2.5 px-4 py-3 rounded-lg border text-sm text-left transition-colors",
                selected ? "border-slate-900 bg-slate-50 text-slate-900 font-medium" : "border-slate-200 text-slate-600 hover:border-slate-300")}>
              <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0",
                selected ? "bg-slate-900 border-slate-900" : "border-slate-300")}>
                {selected && <Check className="h-3 w-3 text-white" />}
              </div>
              <span className="flex-1">{label}</span>
              {!has_template && (
                <span className="text-xs text-orange-400 shrink-0" title="No template assigned">!</span>
              )}
            </button>
          );
        })}
      </div>
      {data.selected_documents.length > 0 && (
        <p className="text-xs text-slate-400 mt-3">{data.selected_documents.length} document{data.selected_documents.length !== 1 ? "s" : ""} selected</p>
      )}
    </div>
  );
}


// --- Trust Step ---

function StepTrust({ data, update }: { data: WizardData; update: Function }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-medium text-slate-900 mb-1">Trust</h2>
        <p className="text-sm text-slate-500">Enter trust details for this estate plan.</p>
      </div>

      <div>
        <Label className="text-sm mb-2 block">Trust Name</Label>
        <Input
          placeholder="e.g. The Smith Family Trust"
          value={data.trust_name}
          onChange={(e) => update("trust_name", e.target.value)}
        />
        <p className="text-xs text-slate-400 mt-1">This name will appear in the Trust, Certificate of Trust, and Pourover Will.</p>
      </div>
    </div>
  );
}


// --- Living Will Step ---

function StepLivingWill({ data }: { data: WizardData }) {
  return (
    <div>
      <h2 className="text-lg font-medium text-slate-900 mb-1">Living Will</h2>
      <p className="text-sm text-slate-500 mb-5">
        The Living Will is mostly standard Arizona statutory language.
        Client info from Setup is used automatically.
      </p>

      <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-3 text-sm text-slate-700">
        <div className="flex justify-between">
          <span className="text-slate-500">Structure</span>
          <span className="font-medium capitalize">{data.structure}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Pronouns</span>
          <span className="font-medium">
            {data.pronoun === "He" ? "He/Him" : data.pronoun === "She" ? "She/Her" : "They/Them"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Pregnancy clause</span>
          <Badge variant={data.include_pregnancy_clause ? "default" : "secondary"}>
            {data.include_pregnancy_clause ? "Included" : data.pronoun === "She" ? "Not included" : "Not applicable"}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Year</span>
          <span className="font-medium">{new Date().getFullYear()}</span>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-4">
        Day and month blanks are left for notarization at signing.
      </p>
    </div>
  );
}


// --- Review Step ---

function StepReview({
  data, matter, docTypes, onGenerate, isGenerating,
}: {
  data: WizardData;
  matter: any;
  docTypes: DocType[];
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  return (
    <div>
      <h2 className="text-lg font-medium text-slate-900 mb-1">Review</h2>
      <p className="text-sm text-slate-500 mb-5">Confirm everything looks right before generating.</p>

      <div className="space-y-4">
        <ReviewSection title="Matter">
          <ReviewRow label="Matter" value={matter ? `${matter.display_number} — ${matter.description}` : "—"} />
          {data.matter_type
            ? <ReviewRow label="Matter Type" value={MATTER_TYPES.find((t) => t.key === data.matter_type)?.label ?? data.matter_type} />
            : <ReviewRow label="Matter Type" value="Not selected" warn />
          }
        </ReviewSection>

        {data.matter_type !== "estate_planning" && data.matter_type !== "" ? (
          <div className="rounded-lg border border-slate-200 px-4 py-4 text-sm text-slate-500 text-center">
            Full document workflow for{" "}
            <span className="font-medium text-slate-700">
              {MATTER_TYPES.find((t) => t.key === data.matter_type)?.label ?? data.matter_type}
            </span>{" "}
            is coming in a future phase. This matter type has been noted.
          </div>
        ) : (
          <>
            <ReviewSection title="Setup">
              {data.client
                ? <ReviewRow label="Primary Client" value={data.client.name} />
                : <ReviewRow label="Primary Client" value="Not selected" warn />
              }
              <ReviewRow label="Structure" value={data.structure === "single" ? "Single" : "Joint"} />
              <ReviewRow label="Pronouns (Client 1)" value={data.pronoun === "He" ? "He/Him" : data.pronoun === "She" ? "She/Her" : "They/Them"} />
              {data.structure === "joint" && (
                <>
                  {data.client_2
                    ? <ReviewRow label="Client 2" value={data.client_2.name} />
                    : <ReviewRow label="Client 2" value="Not selected" warn />
                  }
                  <ReviewRow label="Pronouns (Client 2)" value={data.pronoun_2 === "He" ? "He/Him" : data.pronoun_2 === "She" ? "She/Her" : "They/Them"} />
                </>
              )}
              {data.trust_name && <ReviewRow label="Trust Name" value={data.trust_name} />}
              {data.rate_key && (
                <ReviewRow label="Fee Structure" value={rateLabel(data.rate_key)} />
              )}
              {data.rate_key === "hourly" && data.deposit && (
                <ReviewRow label="Required Deposit" value={`$${data.deposit}`} />
              )}
            </ReviewSection>

            <ReviewSection title="Selected Documents">
              {data.selected_documents.length === 0 ? (
                <p className="text-sm text-red-400 italic px-4 py-3">No documents selected</p>
              ) : (
                data.selected_documents.map((key) => {
                  const doc = docTypes.find((d) => d.wizard_key === key);
                  const hasTemplate = doc?.has_template;
                  return (
                    <div key={key} className="flex justify-between px-4 py-2.5 text-sm">
                      <span className="font-medium text-slate-900">{doc?.label ?? key}</span>
                  {!hasTemplate && (
                    <span className="text-xs text-orange-500">No template — will skip</span>
                  )}
                </div>
              );
            })
                )}
              </ReviewSection>
          </>
        )}
      </div>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{title}</h3>
      <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex justify-between px-4 py-2.5 text-sm">
      {label && <span className="text-slate-500">{label}</span>}
      <span className={cn("font-medium", warn ? "text-red-500" : "text-slate-900")}>{value}</span>
    </div>
  );
}


// --- Engagement Letter Step ---

function StepEngagementLetter({
  data,
  update,
  firmRates,
}: {
  data: WizardData;
  update: Function;
  firmRates: Record<string, string>;
}) {
  const rateTypes = RATE_TYPES;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-medium text-slate-900 mb-1">Engagement Letter</h2>
        <p className="text-sm text-slate-500">Select the fee structure for this engagement.</p>
      </div>
      <div className="space-y-2">
        {rateTypes.map((rt) => {
          const amount = firmRates[rt.key] || "";
          const selected = data.rate_key === rt.key;
          return (
            <button
              key={rt.key}
              onClick={() => update("rate_key", rt.key)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-lg border text-sm text-left transition-colors",
                selected
                  ? "border-slate-900 bg-slate-50 text-slate-900 font-medium"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              <span>{rt.label}</span>
              <span className={cn("font-mono text-sm", selected ? "text-slate-900" : "text-slate-400")}>
                {amount || <span className="italic text-slate-300">not set</span>}
              </span>
            </button>
          );
        })}
      </div>
      {data.rate_key && (
        <p className="text-xs text-slate-400">
          Template will receive:{" "}
          <code className="bg-slate-100 px-1 rounded">{"{{ attorney_rate }}"}</code> ={" "}
          {firmRates[data.rate_key] || "—"}
        </p>
      )}

      {/* Deposit — shown only for Hourly */}
      {data.rate_key === "hourly" && (
        <div>
          <Label className="text-sm mb-1 block">Required Deposit</Label>
          <p className="text-xs text-slate-400 mb-2">
            Initial retainer amount based on estimated effort and engagement risk.
          </p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <Input
              className="pl-6"
              placeholder="0.00"
              value={data.deposit}
              onChange={(e) => {
                // Allow digits, commas, and one decimal point
                const raw = e.target.value.replace(/[^0-9.,]/g, "");
                update("deposit", raw);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}


// --- Health Care POA Step ---

function StepHcPoa({ data, update }: { data: WizardData; update: Function }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-medium text-slate-900 mb-1">Health Care POA</h2>
        <p className="text-sm text-slate-500">Enter the healthcare agent(s) for this document.</p>
      </div>

      <div>
        <Label className="text-sm mb-2 block">Agent Structure</Label>
        <div className="flex gap-2 flex-wrap">
          {[
            { value: "single", label: "Single Agent" },
            { value: "primary_successor", label: "Primary + Successor" },
            { value: "co_agents", label: "Co-Agents" },
          ].map(({ value, label }) => (
            <button key={value} onClick={() => update("hc_agent_structure", value)}
              className={cn("px-4 py-1.5 rounded-full border text-sm transition-colors",
                data.hc_agent_structure === value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 text-slate-600 hover:border-slate-400")}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-sm mb-1.5 block">
          {data.hc_agent_structure === "co_agents" ? "Co-Agent 1" : "Primary Agent"}
        </Label>
        <Input placeholder="Full name" value={data.hc_agent_1}
          onChange={(e) => update("hc_agent_1", e.target.value)} />
      </div>

      {data.hc_agent_structure !== "single" && (
        <div>
          <Label className="text-sm mb-1.5 block">
            {data.hc_agent_structure === "co_agents" ? "Co-Agent 2" : "Successor Agent"}
          </Label>
          <Input placeholder="Full name" value={data.hc_agent_2}
            onChange={(e) => update("hc_agent_2", e.target.value)} />
        </div>
      )}
    </div>
  );
}


// --- General POA Step ---

function StepGeneralPoa({ data, update }: { data: WizardData; update: Function }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-medium text-slate-900 mb-1">General Financial POA</h2>
        <p className="text-sm text-slate-500">Enter the financial power of attorney agent(s).</p>
      </div>

      <div>
        <Label className="text-sm mb-1.5 block">Primary Agent (1a)</Label>
        <Input placeholder="Full name" value={data.poa_agent_1a}
          onChange={(e) => update("poa_agent_1a", e.target.value)} />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => { update("poa_has_co_agents", !data.poa_has_co_agents); }}
          className={cn("w-9 h-5 rounded-full transition-colors shrink-0",
            data.poa_has_co_agents ? "bg-slate-900" : "bg-slate-200")}>
          <span className={cn("block w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5",
            data.poa_has_co_agents ? "translate-x-4" : "translate-x-0")} />
        </button>
        <Label className="text-sm cursor-pointer" onClick={() => update("poa_has_co_agents", !data.poa_has_co_agents)}>
          Add co-agent (joint authority)
        </Label>
      </div>

      {data.poa_has_co_agents && (
        <>
          <div>
            <Label className="text-sm mb-1.5 block">Co-Agent (1b)</Label>
            <Input placeholder="Full name" value={data.poa_agent_1b}
              onChange={(e) => update("poa_agent_1b", e.target.value)} />
          </div>
          <div>
            <Label className="text-sm mb-2 block">Joint Authority Language</Label>
            <div className="flex gap-2">
              {["and", "or", "and/or"].map((v) => (
                <button key={v} onClick={() => update("poa_andor", v)}
                  className={cn("px-4 py-1.5 rounded-full border text-sm transition-colors",
                    data.poa_andor === v
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 text-slate-600 hover:border-slate-400")}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div>
        <Label className="text-sm mb-1.5 block">Successor Agent (2)</Label>
        <Input placeholder="Full name (optional)" value={data.poa_agent_2}
          onChange={(e) => update("poa_agent_2", e.target.value)} />
      </div>

      <div>
        <Label className="text-sm mb-1.5 block">2nd Successor Agent (3)</Label>
        <Input placeholder="Full name (optional)" value={data.poa_agent_3}
          onChange={(e) => update("poa_agent_3", e.target.value)} />
      </div>
    </div>
  );
}


// --- Closing Letter Step ---

function StepClosingLetter({ data, update }: { data: WizardData; update: Function }) {
  const toggles: { key: keyof WizardData; label: string }[] = [
    { key: "has_brokerage", label: "Client has brokerage / investment account" },
    { key: "has_llc", label: "Client has an LLC" },
    { key: "has_special_warranty_deed", label: "Special Warranty Deed included" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-medium text-slate-900 mb-1">Closing Letter</h2>
        <p className="text-sm text-slate-500">Select which optional sections to include.</p>
      </div>

      <div className="space-y-3">
        {toggles.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3">
            <button onClick={() => update(key, !data[key])}
              className={cn("w-9 h-5 rounded-full transition-colors shrink-0",
                data[key] ? "bg-slate-900" : "bg-slate-200")}>
              <span className={cn("block w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5",
                data[key] ? "translate-x-4" : "translate-x-0")} />
            </button>
            <Label className="text-sm cursor-pointer" onClick={() => update(key, !data[key])}>{label}</Label>
          </div>
        ))}
      </div>

      {data.has_brokerage && (
        <div className="mt-1">
          <Label className="text-sm mb-1.5 block">Other account name (optional)</Label>
          <Input placeholder="e.g. Fidelity IRA" value={data.other_account_name}
            onChange={(e) => update("other_account_name", e.target.value)} />
        </div>
      )}
    </div>
  );
}
