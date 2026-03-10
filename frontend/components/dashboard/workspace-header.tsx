'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight, Home, LogOut, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearAuthToken } from '@/lib/auth';
import { getWorkspacePageMeta } from './workspace-nav';

export function WorkspaceHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const pageMeta = getWorkspacePageMeta(pathname);

  function handleLogout() {
    clearAuthToken();
    router.replace('/login');
  }

  return (
    <header className="flex items-center justify-between border-b border-border bg-white/90 px-4 py-4 backdrop-blur md:px-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-foreground/45">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 font-semibold text-foreground/75">
            <Home className="h-3.5 w-3.5" />
            ReplyPro Control Tower
          </span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span>{pageMeta.sectionLabel}</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span>{pageMeta.title}</span>
        </div>
        <h1 className="mt-3 truncate text-2xl font-semibold">{pageMeta.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-foreground/60">{pageMeta.description}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/75 md:inline-flex md:items-center md:gap-2">
          <Sparkles className="h-3.5 w-3.5" />
          v0-inspired workspace shell
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
          RP
        </div>
        <Button variant="ghost" className="gap-2" onClick={handleLogout}>
          Keluar
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
