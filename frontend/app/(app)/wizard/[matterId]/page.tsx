"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getMatter, searchContacts, generateDocument } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, FileDown, Loader2, Check } from "lucide-react";
import { ContactSearch } from "@/components/wizard/contact-search";
import { cn } from "@/lib/utils";

function resolveDocumentType(
  key: string,
  structure: "single" | "joint",
  is_female: boolean
): string | null {
  const gender = is_female ? "female" : "male";
  // living_will uses "married" for joint; other docs fall back to single templates
  const lwStructure = structure === "joint" ? "married" : "single";
  const singleOrJoint = "single"; // only single templates exist for other doc types
  const map: Record<string, string> = {
    living_will: `living_will_${lwStructure}_${gender}`,
    hc_poa: `hc_poa_${singleOrJoint}_${gender}`,
    general_poa: `general_poa_${singleOrJoint}_${gender}`,
    pourover_will: `pourover_will_${singleOrJoint}_${gender}`,
    trust: `trust_${singleOrJoint}`,
    certificate_of_trust: `certificate_of_trust_${singleOrJoint}`,
    engagement_letter: "engagement_letter",
    closing_letter: `closing_letter_${singleOrJoint}`,
  };
  return map[key] ?? null;
}

// Step definitions
const STEPS = ["Setup", "Documents", "Living Will", "Review"];

type WizardData = {
  structure: "single" | "joint";
  client: { id: number; name: string; first_name: string; last_name: string; prefix: string } | null;
  client_2: { id: number; name: string } | null;
  is_female: boolean;
  include_pregnancy_clause: boolean;
  trust_name: string;
  selected_documents: string[];
  // Living Will specific
  living_will_client: "client_1" | "client_2";
};

const DOCUMENT_OPTIONS = [
  { key: "living_will", label: "Living Will" },
  { key: "hc_poa", label: "Health Care POA" },
  { key: "general_poa", label: "General (Financial) POA" },
  { key: "trust", label: "Trust" },
  { key: "pourover_will", label: "Pourover Will" },
  { key: "certificate_of_trust", label: "Certificate of Trust" },
  { key: "engagement_letter", label: "Engagement Letter" },
  { key: "closing_letter", label: "Closing Letter" },
];

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
    living_will_client: "client_1",
  });

  const { data: matter, isLoading: matterLoading } = useQuery({
    queryKey: ["matter", matterId],
    queryFn: () => getMatter(Number(matterId)).then((r) => r.data.data),
  });

  const [isGenerating, setIsGenerating] = useState(false);

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

  async function handleGenerate() {
    if (!matter || !data.client) return;
    if (data.selected_documents.length === 0) {
      toast.error("No documents selected.");
      return;
    }

    setIsGenerating(true);
    const matterLabel = `${matter.display_number} - ${matter.description}`;

    const requests = data.selected_documents
      .map((key) => {
        const docType = resolveDocumentType(key, data.structure, data.is_female);
        if (!docType) return null;
        return {
          key,
          docType,
          payload: {
            matter_id: matter.id,
            matter_label: matterLabel,
            document_type: docType,
            wizard_data: {
              client: {
                name: data.client!.name,
                first_name: data.client!.first_name,
                last_name: data.client!.last_name,
                prefix: data.client!.prefix,
              },
              is_female: data.is_female,
              include_pregnancy_clause: data.include_pregnancy_clause,
              trust_name: data.trust_name,
              selected_documents: data.selected_documents,
            },
            generate_pdf: true,
            upload_to_clio: false,
          },
        };
      })
      .filter(Boolean) as { key: string; docType: string; payload: Parameters<typeof generateDocument>[0] }[];

    const results = await Promise.allSettled(
      requests.map((r) => generateDocument(r.payload))
    );

    let successCount = 0;
    results.forEach((result, idx) => {
      const label = DOCUMENT_OPTIONS.find((d) => d.key === requests[idx].key)?.label ?? requests[idx].docType;
      if (result.status === "fulfilled") {
        successCount++;
        toast.success(`${label} generated`, {
          description: `Job #${result.value.data.job_id} ready.`,
          action: {
            label: "Go to Documents",
            onClick: () => router.push("/documents"),
          },
        });
      } else {
        toast.error(`${label} failed`, {
          description: "Check the backend logs.",
        });
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

  const matterLabel = matter
    ? `${matter.display_number} — ${matter.description}`
    : matterId;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push("/matters")}
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 mb-4 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Back to matters
        </button>
        <h1 className="text-xl font-semibold text-slate-900">{matterLabel}</h1>

        {/* Step progress */}
        <div className="flex items-center gap-2 mt-5">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <button
                onClick={() => i < step && setStep(i)}
                className={cn(
                  "flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full transition-colors",
                  i === step
                    ? "bg-slate-900 text-white"
                    : i < step
                    ? "bg-green-100 text-green-700 cursor-pointer hover:bg-green-200"
                    : "bg-slate-100 text-slate-400 cursor-default"
                )}
              >
                {i < step && <Check className="h-3 w-3" />}
                {label}
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn("h-px w-6", i < step ? "bg-green-300" : "bg-slate-200")} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        {step === 0 && (
          <StepSetup data={data} update={update} />
        )}
        {step === 1 && (
          <StepDocuments data={data} toggle={toggleDocument} />
        )}
        {step === 2 && (
          <StepLivingWill data={data} update={update} />
        )}
        {step === 3 && (
          <StepReview data={data} matter={matter} onGenerate={handleGenerate} isGenerating={isGenerating} />
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
            ) : (
              <><FileDown className="h-4 w-4 mr-2" /> Generate Documents</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// --- Step components ---

function StepSetup({ data, update }: { data: WizardData; update: Function }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-900 mb-4">Estate Setup</h2>

        <div className="space-y-4">
          <div>
            <Label className="text-sm mb-2 block">Estate Structure</Label>
            <div className="flex gap-3">
              {(["single", "joint"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => update("structure", v)}
                  className={cn(
                    "flex-1 py-2.5 rounded-lg border text-sm font-medium capitalize transition-colors",
                    data.structure === v
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 text-slate-600 hover:border-slate-400"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm mb-2 block">Client / Principal 1</Label>
            <ContactSearch
              value={data.client ? { id: data.client.id, text: data.client.name } : null}
              onChange={(c) => update("client", c ? { id: c.id, name: c.text, first_name: "", last_name: "", prefix: "" } : null)}
            />
          </div>

          <div>
            <Label className="text-sm mb-2 block">Pronouns</Label>
            <div className="flex gap-2">
              {[
                { label: "She/Her", value: "she" },
                { label: "He/Him", value: "he" },
                { label: "They/Them", value: "they" },
              ].map(({ label, value }) => {
                const isActive =
                  (value === "she" && data.is_female) ||
                  (value === "he" && !data.is_female);
                return (
                  <button
                    key={label}
                    onClick={() => {
                      update("is_female", value === "she");
                      if (value !== "she") update("include_pregnancy_clause", false);
                    }}
                    className={cn(
                      "px-4 py-1.5 rounded-full border text-sm transition-colors",
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 text-slate-600 hover:border-slate-400"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {data.is_female && (
            <div>
              <Label className="text-sm mb-2 block">Include pregnancy clause in Living Will?</Label>
              <div className="flex gap-2">
                {([true, false] as const).map((val) => (
                  <button
                    key={String(val)}
                    onClick={() => update("include_pregnancy_clause", val)}
                    className={cn(
                      "px-5 py-1.5 rounded-full border text-sm transition-colors",
                      data.include_pregnancy_clause === val
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 text-slate-600 hover:border-slate-400"
                    )}
                  >
                    {val ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {data.structure === "joint" && (
            <div>
              <Label className="text-sm mb-2 block">Client / Principal 2</Label>
              <ContactSearch
                value={data.client_2 ? { id: data.client_2.id, text: data.client_2.name } : null}
                onChange={(c) => update("client_2", c ? { id: c.id, name: c.text } : null)}
              />
            </div>
          )}

          <div>
            <Label className="text-sm mb-2 block">Trust Name (if applicable)</Label>
            <Input
              placeholder="e.g. The Smith Family Trust"
              value={data.trust_name}
              onChange={(e) => update("trust_name", e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StepDocuments({ data, toggle }: { data: WizardData; toggle: (k: string) => void }) {
  return (
    <div>
      <h2 className="text-lg font-medium text-slate-900 mb-1">Documents Needed</h2>
      <p className="text-sm text-slate-500 mb-5">Select all documents for this estate plan.</p>
      <div className="grid grid-cols-2 gap-2">
        {DOCUMENT_OPTIONS.map(({ key, label }) => {
          const selected = data.selected_documents.includes(key);
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={cn(
                "flex items-center gap-2.5 px-4 py-3 rounded-lg border text-sm text-left transition-colors",
                selected
                  ? "border-slate-900 bg-slate-50 text-slate-900 font-medium"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              <div className={cn(
                "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                selected ? "bg-slate-900 border-slate-900" : "border-slate-300"
              )}>
                {selected && <Check className="h-3 w-3 text-white" />}
              </div>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepLivingWill({ data, update }: { data: WizardData; update: Function }) {
  return (
    <div>
      <h2 className="text-lg font-medium text-slate-900 mb-1">Living Will</h2>
      <p className="text-sm text-slate-500 mb-5">
        The Living Will is mostly standard Arizona statutory language.
        The only variable content is the client information filled in from Step 1.
      </p>

      <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-3 text-sm text-slate-700">
        <div className="flex justify-between">
          <span className="text-slate-500">Client name</span>
          <span className="font-medium">{data.client?.name ?? <span className="text-red-400 italic">Not set</span>}</span>
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
        The date blanks (day, month) are left for notarization at signing. The year is pre-filled.
      </p>
    </div>
  );
}

function StepReview({
  data, matter, onGenerate, isGenerating,
}: {
  data: WizardData;
  matter: any;
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

        <ReviewSection title="Client">
          <ReviewRow label="Name" value={data.client?.name ?? "Not set"} warn={!data.client} />
          <ReviewRow label="Structure" value={data.structure} />
          <ReviewRow label="Pronouns" value={data.is_female ? "She/Her" : "He/Him"} />
          {data.trust_name && <ReviewRow label="Trust name" value={data.trust_name} />}
        </ReviewSection>

        <ReviewSection title="Selected Documents">
          {data.selected_documents.length === 0 ? (
            <p className="text-sm text-red-400 italic">No documents selected</p>
          ) : (
            data.selected_documents.map((key) => {
              const doc = DOCUMENT_OPTIONS.find((d) => d.key === key);
              return <ReviewRow key={key} label="" value={doc?.label ?? key} />;
            })
          )}
        </ReviewSection>
      </div>

      {!data.client && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
          A client must be selected before generating documents.
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
