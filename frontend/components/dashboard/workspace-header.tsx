'use client';

import { useRouter } from 'next/navigation';
import { LogOut, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearAuthToken } from '@/lib/auth';

export function WorkspaceHeader() {
  const router = useRouter();

  function handleLogout() {
    clearAuthToken();
    router.replace('/login');
  }

  return (
    <header className="flex items-center justify-between border-b border-border bg-white/90 px-4 py-4 backdrop-blur md:px-6">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-foreground/45">ReplyPro Control Tower</p>
        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/75">
          <Sparkles className="h-3.5 w-3.5" />
          v0-inspired workspace shell
        </div>
      </div>

      <Button variant="ghost" className="gap-2" onClick={handleLogout}>
        Keluar
        <LogOut className="h-4 w-4" />
      </Button>
    </header>
  );
}
