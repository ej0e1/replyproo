'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Bot, ChevronLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { workspaceNavItems } from './workspace-nav';

export function WorkspaceSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');

  const filteredItems = workspaceNavItems.filter((item) => {
    const normalizedSearch = search.trim().toLowerCase();
    return !normalizedSearch || item.label.toLowerCase().includes(normalizedSearch);
  });

  const renderSection = (section: 'workspace' | 'fallback', title: string) => {
    const sectionItems = filteredItems.filter((item) => item.section === section);
    if (!sectionItems.length) {
      return null;
    }

    return (
      <div className="space-y-2">
        {!collapsed ? <p className="px-3 text-[11px] uppercase tracking-[0.24em] text-white/35">{title}</p> : null}
        <div className="space-y-1">
          {sectionItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 transition',
                  collapsed ? 'justify-center rounded-xl px-2 py-3' : 'rounded-2xl px-4 py-3',
                  isActive
                    ? 'bg-white text-[#0f231d] shadow-sm'
                    : 'text-white/78 hover:bg-white/8 hover:text-white',
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed ? (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.label}</p>
                    <p className={cn('truncate text-[11px]', isActive ? 'text-[#0f231d]/60' : 'text-white/42')}>
                      {item.description}
                    </p>
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

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

      {!collapsed ? (
        <div className="border-b border-white/10 px-4 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search pages"
              className="h-10 border-white/10 bg-white/8 pl-9 text-white placeholder:text-white/35 focus:border-white/20 focus:ring-white/10"
            />
          </div>
        </div>
      ) : null}

      <nav className={cn('flex-1 space-y-5 overflow-y-auto py-4', collapsed ? 'px-2' : 'px-3')}>
        {renderSection('workspace', 'Workspace')}
        {renderSection('fallback', 'Fallback')}
      </nav>

      <div className={cn('border-t border-white/10 py-4', collapsed ? 'px-2' : 'px-3')}>
        <Button
          variant="ghost"
          className={cn('w-full text-white hover:bg-white/8 hover:text-white', collapsed ? 'justify-center px-2' : 'justify-start')}
          onClick={() => setCollapsed((value) => !value)}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
          {!collapsed ? <span className="ml-2">Collapse Sidebar</span> : null}
        </Button>
      </div>
    </aside>
  );
}
