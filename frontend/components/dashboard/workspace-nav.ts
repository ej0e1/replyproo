import type { LucideIcon } from 'lucide-react';
import { BarChart3, Bot, LayoutDashboard, MessagesSquare, Phone, Users } from 'lucide-react';

export type WorkspaceNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  section: 'workspace' | 'fallback';
  description: string;
};

export const workspaceNavItems: WorkspaceNavItem[] = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: LayoutDashboard,
    section: 'workspace',
    description: 'Ringkasan workspace dan pintasan utama.',
  },
  {
    href: '/dashboard/inbox',
    label: 'Inbox',
    icon: MessagesSquare,
    section: 'workspace',
    description: 'Conversation list, thread detail, dan reply composer.',
  },
  {
    href: '/dashboard/channels',
    label: 'Channels',
    icon: Phone,
    section: 'workspace',
    description: 'QR, connection status, dan reconnect nombor WhatsApp.',
  },
  {
    href: '/dashboard/automations',
    label: 'Automations',
    icon: Bot,
    section: 'workspace',
    description: 'Keyword rules dan automation settings.',
  },
  {
    href: '/dashboard/contacts',
    label: 'Contacts',
    icon: Users,
    section: 'workspace',
    description: 'Contact list, tags, dan opt-in snapshot.',
  },
  {
    href: '/dashboard/analytics',
    label: 'Analytics',
    icon: BarChart3,
    section: 'workspace',
    description: 'Laporan performance dan health workspace.',
  },
  {
    href: '/dashboard/legacy',
    label: 'Legacy Dashboard',
    icon: LayoutDashboard,
    section: 'fallback',
    description: 'Fallback sementara sepanjang migrasi ke shell baru.',
  },
];

export function getWorkspacePageMeta(pathname: string) {
  const matched =
    workspaceNavItems.find((item) => item.href !== '/dashboard' && pathname.startsWith(item.href)) ??
    workspaceNavItems.find((item) => item.href === pathname) ??
    workspaceNavItems[0];

  return {
    title: matched.label,
    description: matched.description,
    sectionLabel: matched.section === 'fallback' ? 'Fallback' : 'Workspace',
  };
}
