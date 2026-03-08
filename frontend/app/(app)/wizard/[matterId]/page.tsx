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
import { ChevronLeft, ChevronRight, FileDown, Loader2, Check } from "lucide-react";
import { ContactPanel } from "@/components/wizard/contact-panel";
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

type WizardData = {
  structure: "single" | "joint";
  client: { id: number; name: string; first_name: string; last_name: string; prefix: string } | null;
  client_2: { id: number; name: string } | null;
  is_female: boolean;
  include_pregnancy_clause: boolean;
  trust_name: string;
  selected_documents: string[];
  rate_key: string;
};

const RATE_TYPE_DESCRIPTIONS: Record<string, string> = {
  flat_joint_trust: "a flat fee of {amount} for a joint trust-based estate plan",
  flat_individual_trust: "a flat fee of {amount} for an individual trust-based estate plan",
  flat_joint_will: "a flat fee of {amount} for a joint will-based estate plan including a beneficiary deed",
  flat_individual_will: "a flat fee of {amount} for an individual will-based estate plan including a beneficiary deed",
  hourly: "an hourly basis at the rate of {amount} per hour",
};

// Derive wizard steps dynamically — Trust step only if trust is selected
function getSteps(selectedDocs: string[]): string[] {
  const steps = ["Setup", "Documents"];
  if (selectedDocs.includes("trust")) steps.push("Trust");
  if (selectedDocs.includes("living_will")) steps.push("Living Will");
  if (selectedDocs.includes("engagement_letter")) steps.splice(steps.indexOf("Review") === -1 ? steps.length : steps.indexOf("Review"), 0, "Fee");
  steps.push("Review");
  return steps;
}

export default function WizardPage() {
  const { matterId } = useParams<{ matterId: string }>();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({
    structure: "single",
    client: null,
    client_2: null,
    is_female: false,
    include_pregnancy_clause: false,
    trust_name: "",
    selected_documents: [],
    rate_key: "",
  });
  const [firmRates, setFirmRates] = useState<Record<string, string>>({});
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

  // Pre-select docs from Clio checkbox custom fields when matter loads
  useEffect(() => {
    if (!matter?.custom_field_values) return;
    const preSelected: string[] = [];
    for (const cf of matter.custom_field_values) {
      // Find by field_name matching known Clio field IDs
      const clioFieldId = Object.entries(CLIO_FIELD_TO_KEY).find(
        ([, key]) => cf.field_name?.toLowerCase().includes(key.replace(/_/g, " ")) || false
      )?.[0];
      if (clioFieldId && cf.value === true) {
        preSelected.push(CLIO_FIELD_TO_KEY[Number(clioFieldId)]);
      }
    }
    if (preSelected.length > 0) {
      setData((prev) => ({ ...prev, selected_documents: preSelected }));
    }
  }, [matter]);

  const steps = getSteps(data.selected_documents);

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
      client: {
        name: data.client.name,
        first_name: data.client.first_name,
        last_name: data.client.last_name,
        prefix: data.client.prefix,
      },
      is_female: data.is_female,
      include_pregnancy_clause: data.include_pregnancy_clause,
      trust_name: data.trust_name,
      selected_documents: data.selected_documents,
      rate_key: data.rate_key,
      attorney_rate: data.rate_key && firmRates ? (firmRates[data.rate_key] ?? "") : "",
      rate_type: data.rate_key,
      rate_description: data.rate_key && firmRates
        ? (RATE_TYPE_DESCRIPTIONS[data.rate_key] ?? "").replace("{amount}", firmRates[data.rate_key] ?? "")
        : "",
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
        {currentStepName === "Setup" && (
          <StepSetup data={data} update={update} matterId={Number(matterId)} />
        )}
        {currentStepName === "Documents" && (
          <StepDocuments data={data} docTypes={docTypes ?? []} toggle={toggleDocument} toggleAll={toggleAll} />
        )}
        {currentStepName === "Trust" && (
          <StepTrust data={data} update={update} />
        )}
        {currentStepName === "Living Will" && (
          <StepLivingWill data={data} />
        )}
        {currentStepName === "Fee" && (
          <StepFee data={data} update={update} firmRates={firmRates} />
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
        ) : (
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
              : <><FileDown className="h-4 w-4 mr-2" /> Generate Documents</>
            }
          </Button>
        )}
      </div>
    </div>
  );
}


// --- Setup Step ---

function StepSetup({ data, update, matterId }: { data: WizardData; update: Function; matterId: number }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-slate-900">Estate Setup</h2>

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

      {/* Pronouns */}
      <div>
        <Label className="text-sm mb-2 block">Pronouns (Client 1)</Label>
        <div className="flex gap-2">
          {[{ label: "She/Her", value: "she" }, { label: "He/Him", value: "he" }].map(({ label, value }) => {
            const isActive = (value === "she" && data.is_female) || (value === "he" && !data.is_female);
            return (
              <button key={label} onClick={() => {
                update("is_female", value === "she");
                if (value !== "she") update("include_pregnancy_clause", false);
              }}
                className={cn("px-4 py-1.5 rounded-full border text-sm transition-colors",
                  isActive ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:border-slate-400")}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pregnancy clause */}
      {data.is_female && (
        <div>
          <Label className="text-sm mb-2 block">Include pregnancy clause in Living Will?</Label>
          <div className="flex gap-2">
            {([true, false] as const).map((val) => (
              <button key={String(val)} onClick={() => update("include_pregnancy_clause", val)}
                className={cn("px-5 py-1.5 rounded-full border text-sm transition-colors",
                  data.include_pregnancy_clause === val ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:border-slate-400")}>
                {val ? "Yes" : "No"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Contacts */}
      <div>
        <Label className="text-sm mb-1 block">Matter Contacts</Label>
        <p className="text-xs text-slate-400 mb-3">
          Add everyone involved in this estate. Link them to Clio and they will be available for document roles.
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
          <span className="text-slate-500">Pronouns / gender</span>
          <span className="font-medium">{data.is_female ? "She/Her (female)" : "He/Him (male)"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Pregnancy clause</span>
          <Badge variant={data.include_pregnancy_clause ? "default" : "secondary"}>
            {data.include_pregnancy_clause ? "Included" : data.is_female ? "Not included" : "Not applicable"}
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
        </ReviewSection>

        <ReviewSection title="Setup">
          <ReviewRow label="Structure" value={data.structure} />
          <ReviewRow label="Pronouns" value={data.is_female ? "She/Her" : "He/Him"} />
          {data.trust_name && <ReviewRow label="Trust name" value={data.trust_name} />}
          {data.rate_key && (
            <ReviewRow label="Fee structure" value={data.rate_key.replace(/_/g, " ")} />
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
      </div>

      {!data.client && (
        <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
          Note: No primary client selected — client name will be blank in documents. Add a client contact in Setup.
        </div>
      )}
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


// --- Fee Step ---

function StepFee({
  data,
  update,
  firmRates,
}: {
  data: WizardData;
  update: Function;
  firmRates: Record<string, string>;
}) {
  const rateTypes = [
    { key: "flat_joint_trust", label: "Joint Trust Estate Plan" },
    { key: "flat_individual_trust", label: "Individual Trust Estate Plan" },
    { key: "flat_joint_will", label: "Joint Will & Beneficiary Deed" },
    { key: "flat_individual_will", label: "Individual Will & Beneficiary Deed" },
    { key: "hourly", label: "Hourly Rate" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-medium text-slate-900 mb-1">Fee Agreement</h2>
        <p className="text-sm text-slate-500">Select the fee structure for this engagement letter.</p>
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
    </div>
  );
}
