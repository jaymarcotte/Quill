"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scale, FileText, FolderOpen, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/matters", label: "Matters", icon: FolderOpen },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  function handleLogout() {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 text-slate-100 flex flex-col shrink-0">
        <div className="px-5 py-6 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-amber-400" />
            <span className="font-semibold text-sm leading-tight">
              Hillary P. Gagnon<br />
              <span className="text-slate-400 font-normal text-xs">Estate Planning</span>
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                pathname.startsWith(href)
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-3 pb-5">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-400 hover:text-white hover:bg-slate-800 w-full transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 bg-slate-50 overflow-auto">
        {children}
      </main>
    </div>
  );
}
