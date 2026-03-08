"use client";
import { useState, useRef, useEffect } from "react";
import { searchContacts, type ContactCard } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Loader2, X, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: ContactCard | null;
  onChange: (value: ContactCard | null) => void;
  placeholder?: string;
  onCreateNew?: (query: string) => void;
}

export function ContactSearch({ value, onChange, placeholder = "Search contacts...", onCreateNew }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleInput(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchContacts(q);
        setResults(res.data);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  }

  function select(contact: ContactCard) {
    onChange(contact);
    setQuery("");
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setQuery("");
    setResults([]);
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm">
        <div className="flex-1 min-w-0">
          <span className="font-medium text-slate-900">{value.name}</span>
          {(value.email || value.phone || value.city_state) && (
            <div className="text-xs text-slate-400 mt-0.5 truncate">
              {[value.email, value.phone, value.city_state].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        <button onClick={clear} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          placeholder={placeholder}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="pr-8"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
        )}
      </div>

      {open && (results.length > 0 || (!loading && query.length >= 2)) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => select(c)}
              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
            >
              <div className="text-sm font-medium text-slate-900">{c.name}</div>
              {(c.email || c.phone || c.city_state) && (
                <div className="text-xs text-slate-400 mt-0.5">
                  {[c.email, c.phone, c.city_state].filter(Boolean).join(" · ")}
                </div>
              )}
            </button>
          ))}
          {results.length === 0 && !loading && (
            <div className="px-4 py-3 text-sm text-slate-400">No contacts found</div>
          )}
          {onCreateNew && (
            <button
              onClick={() => { setOpen(false); onCreateNew(query); }}
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
