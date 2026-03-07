"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getMatters, type Matter } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronRight, Loader2 } from "lucide-react";

export default function MattersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["matters"],
    queryFn: () => getMatters().then((r) => r.data.data),
  });

  const filtered = (data ?? []).filter((m) => {
    const q = search.toLowerCase();
    return (
      m.display_number?.toLowerCase().includes(q) ||
      m.description?.toLowerCase().includes(q) ||
      m.client?.name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Select a Matter</h1>
        <p className="text-slate-500 mt-1 text-sm">Choose an open matter to begin document preparation.</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          className="pl-9 bg-white"
          placeholder="Search by matter number, client name, or description..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading matters from Clio...
        </div>
      )}

      {error && (
        <div className="text-center py-16 text-red-500 text-sm">
          Failed to load matters. Check your Clio connection in Settings.
        </div>
      )}

      {!isLoading && !error && (
        <div className="space-y-1">
          {filtered.length === 0 && (
            <p className="text-center py-12 text-slate-400 text-sm">No matters match your search.</p>
          )}
          {filtered.map((matter) => (
            <MatterRow
              key={matter.id}
              matter={matter}
              onClick={() => router.push(`/wizard/${matter.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MatterRow({ matter, onClick }: { matter: Matter; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all text-left group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono text-sm font-medium text-slate-700">
            {matter.display_number}
          </span>
          <Badge variant="secondary" className="text-xs">
            {matter.status}
          </Badge>
        </div>
        <p className="text-sm text-slate-600 truncate">{matter.description}</p>
        {matter.client?.name && (
          <p className="text-xs text-slate-400 mt-0.5">{matter.client.name}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
    </button>
  );
}
