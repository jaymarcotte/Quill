"use client";
import { useEffect, useState } from "react";
import { getMe } from "@/lib/api";
import { Scale, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Me {
  id: number;
  email: string;
  full_name: string;
  role: string;
  clio_connected: boolean;
}

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((r) => setMe(r.data))
      .finally(() => setLoading(false));
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

  function connectClio() {
    // The connect endpoint requires a JWT — pass it as a query param
    // The backend /clio/connect endpoint reads it from ?token= for browser redirects
    const token = localStorage.getItem("access_token");
    window.location.href = `http://localhost:8001/api/auth/clio/connect?token=${token}`;
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
      <section className="bg-white border border-slate-200 rounded-xl p-6">
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
    </div>
  );
}
