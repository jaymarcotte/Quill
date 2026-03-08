"use client";
import { useEffect, useState } from "react";
import { getMe, getFirmSettings, updateFirmSettings, type RateValues, type FirmSettingsData } from "@/lib/api";
import { Scale, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Me {
  id: number;
  email: string;
  full_name: string;
  role: string;
  clio_connected: boolean;
}

const RATE_FIELD_LABELS: { key: keyof RateValues; label: string }[] = [
  { key: "rate_flat_joint_trust", label: "Joint Trust Estate Plan" },
  { key: "rate_flat_individual_trust", label: "Individual Trust Estate Plan" },
  { key: "rate_flat_joint_will", label: "Joint Will & Beneficiary Deed" },
  { key: "rate_flat_individual_will", label: "Individual Will & Beneficiary Deed" },
  { key: "rate_hourly", label: "Hourly Rate" },
];

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [firmSettings, setFirmSettings] = useState<FirmSettingsData | null>(null);
  const [rateValues, setRateValues] = useState<RateValues>({
    rate_flat_joint_trust: "",
    rate_flat_individual_trust: "",
    rate_flat_joint_will: "",
    rate_flat_individual_will: "",
    rate_hourly: "",
  });
  const [rateSaving, setRateSaving] = useState(false);
  const [rateSaved, setRateSaved] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  useEffect(() => {
    getMe()
      .then((r) => setMe(r.data))
      .finally(() => setLoading(false));
    getFirmSettings()
      .then((r) => {
        setFirmSettings(r.data.data);
        const d = r.data.data;
        setRateValues({
          rate_flat_joint_trust: d.rates["flat_joint_trust"] ?? "",
          rate_flat_individual_trust: d.rates["flat_individual_trust"] ?? "",
          rate_flat_joint_will: d.rates["flat_joint_will"] ?? "",
          rate_flat_individual_will: d.rates["flat_individual_will"] ?? "",
          rate_hourly: d.rates["hourly"] ?? "",
        });
      })
      .catch(() => {});
  }, []);

  // Check for ?clio=connected redirect back from OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("clio") === "connected") {
      // Refresh user data to show connected status
      getMe().then((r) => setMe(r.data));
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  async function saveRates() {
    setRateSaving(true);
    setRateError(null);
    setRateSaved(false);
    try {
      await updateFirmSettings(rateValues);
      setRateSaved(true);
      setTimeout(() => setRateSaved(false), 3000);
    } catch {
      setRateError("Failed to save. Please try again.");
    } finally {
      setRateSaving(false);
    }
  }

  function connectClio() {
    // The connect endpoint requires a JWT — pass it as a query param
    // The backend /clio/connect endpoint reads it from ?token= for browser redirects
    const token = localStorage.getItem("access_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";
    window.location.href = `${apiUrl}/api/auth/clio/connect?token=${token}`;
  }

  if (loading) return <div className="p-8 text-sm text-slate-500">Loading...</div>;

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
      </div>

      {/* Account */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 mb-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Account</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Name</span>
            <span className="text-slate-900 font-medium">{me?.full_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Email</span>
            <span className="text-slate-900">{me?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Role</span>
            <span className="text-slate-900 capitalize">{me?.role}</span>
          </div>
        </div>
      </section>

      {/* Clio */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-slate-600" />
            <h2 className="text-sm font-semibold text-slate-700">Clio Manage</h2>
          </div>
          {me?.clio_connected ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <CheckCircle className="h-3.5 w-3.5" /> Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
              <AlertCircle className="h-3.5 w-3.5" /> Not connected
            </span>
          )}
        </div>

        {me?.clio_connected ? (
          <p className="text-sm text-slate-500">
            Your Clio account is connected. Matters and contacts are synced live.
          </p>
        ) : (
          <div>
            <p className="text-sm text-slate-500 mb-4">
              Connect your Clio account to pull matters, contacts, and upload completed documents.
            </p>
            <Button onClick={connectClio} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Connect Clio Account
            </Button>
          </div>
        )}
      </section>

      {/* Fee Schedule */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-slate-700">Fee Schedule</h2>
          {rateSaved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <CheckCircle className="h-3.5 w-3.5" /> Saved
            </span>
          )}
          {rateError && (
            <span className="text-xs text-red-500">{rateError}</span>
          )}
        </div>
        <p className="text-xs text-slate-400 mb-5">
          These rates populate the{" "}
          <code className="bg-slate-100 px-1 rounded">{"{{ attorney_rate }}"}</code>,{" "}
          <code className="bg-slate-100 px-1 rounded">{"{{ rate_type }}"}</code>, and{" "}
          <code className="bg-slate-100 px-1 rounded">{"{{ rate_description }}"}</code>{" "}
          template variables when generating an Engagement Letter.
        </p>
        <div className="space-y-4 mb-5">
          {RATE_FIELD_LABELS.map(({ key, label }) => (
            <div key={key}>
              <Label className="text-sm mb-1.5 block">{label}</Label>
              <Input
                placeholder="e.g. $3,500"
                value={rateValues[key]}
                onChange={(e) => setRateValues((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <Button onClick={saveRates} disabled={rateSaving}>
          {rateSaving ? "Saving..." : "Save Fee Schedule"}
        </Button>
      </section>
    </div>
  );
}
