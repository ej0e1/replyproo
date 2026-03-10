'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Bot,
  ChevronLeft,
  LayoutDashboard,
  MessagesSquare,
  Phone,
  BarChart3,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const items = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/inbox', label: 'Inbox', icon: MessagesSquare },
  { href: '/dashboard/channels', label: 'Channels', icon: Phone },
  { href: '/dashboard/automations', label: 'Automations', icon: Bot },
  { href: '/dashboard/contacts', label: 'Contacts', icon: Users },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/legacy', label: 'Legacy Dashboard', icon: LayoutDashboard },
];

export function WorkspaceSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'hidden h-screen shrink-0 border-r border-border bg-[#0f231d] text-white lg:flex lg:flex-col',
        collapsed ? 'lg:w-20' : 'lg:w-72',
      )}
    >
      <div className={cn('flex items-center gap-3 border-b border-white/10 py-5', collapsed ? 'justify-center px-3' : 'px-5')}>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1f7a5c]">
          <Bot className="h-5 w-5" />
        </div>
        {!collapsed ? (
          <div>
            <p className="text-sm uppercase tracking-[0.26em] text-white/45">ReplyPro</p>
            <p className="text-lg font-semibold">Workspace</p>
          </div>
        ) : null}
      </div>

      <nav className={cn('flex-1 space-y-1 overflow-y-auto py-4', collapsed ? 'px-2' : 'px-3')}>
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-2xl transition',
                collapsed ? 'justify-center px-2 py-3' : 'px-4 py-3',
                isActive ? 'bg-white text-[#0f231d]' : 'text-white/78 hover:bg-white/8 hover:text-white',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed ? <span className="text-sm font-medium">{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className={cn('border-t border-white/10 py-4', collapsed ? 'px-2' : 'px-3')}>
        <Button
          variant="ghost"
          className={cn('w-full text-white hover:bg-white/8 hover:text-white', collapsed ? 'justify-center px-2' : 'justify-start')}
          onClick={() => setCollapsed((value) => !value)}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
          {!collapsed ? <span className="ml-2">Collapse</span> : null}
        </Button>
      </div>
    </aside>
  );
}
