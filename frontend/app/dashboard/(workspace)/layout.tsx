import type { ReactNode } from 'react';
import { WorkspaceHeader } from '@/components/dashboard/workspace-header';
import { WorkspaceSidebar } from '@/components/dashboard/workspace-sidebar';

export default function DashboardWorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-mesh text-foreground lg:flex">
      <WorkspaceSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceHeader />
        <main className="flex-1 px-4 py-4 md:px-6 md:py-6">{children}</main>
      </div>
    </div>
  );
}
