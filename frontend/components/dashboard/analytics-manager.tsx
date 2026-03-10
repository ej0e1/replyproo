'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Bot, CheckCircle2, Clock3, MessagesSquare, Phone, Tags, Users } from 'lucide-react';
import { clearAuthToken, fetchJson, getAuthToken } from '@/lib/auth';

type MeResponse = {
  tenantMembers: Array<{
    tenant: {
      id: string;
      name: string;
      slug: string;
      planCode: string;
    };
  }>;
};

type ContactSummary = {
  id: string;
  name: string | null;
  phoneNumber: string;
  email: string | null;
  tags: string[];
  optIn: boolean;
  lastSeenAt: string | null;
};

type ConversationSummary = {
  id: string;
  status: string;
  unreadCount: number;
  aiEnabled: boolean;
  lastMessageAt: string | null;
  contact: {
    id: string;
    name: string | null;
    phoneNumber: string;
    tags: string[];
  };
  channel: {
    id: string;
    displayName: string;
    phoneNumber: string | null;
    status: string;
  };
  assignedToUser: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  messages: Array<{
    id: string;
    direction: 'inbound' | 'outbound';
    content: string | null;
    status: string;
    createdAt: string;
  }>;
};

type ChannelSummary = {
  id: string;
  displayName: string;
  phoneNumber: string | null;
  evolutionInstanceName: string;
  status: string;
  qrCode: string | null;
  lastConnectedAt: string | null;
  metadata: Record<string, unknown>;
};

type KeywordRule = {
  id: string | null;
  name: string;
  isActive: boolean;
  keywords: string[];
  replyText: string;
};

type KeywordRulesResponse = {
  rules: KeywordRule[];
};

export function AnalyticsManager() {
  const router = useRouter();
  const [tenantName, setTenantName] = useState('ReplyPro Workspace');
  const [tenantSlug, setTenantSlug] = useState('workspace');
  const [tenantPlan, setTenantPlan] = useState('starter');
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [rules, setRules] = useState<KeywordRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    Promise.all([
      fetchJson<MeResponse>('/api/auth/me', undefined, token),
      fetchJson<ContactSummary[]>('/api/contacts', undefined, token),
      fetchJson<ConversationSummary[]>('/api/conversations', undefined, token),
      fetchJson<ChannelSummary[]>('/api/manage/channels', undefined, token),
      fetchJson<KeywordRulesResponse>('/api/manage/automations/keyword-rules', undefined, token),
    ])
      .then(([profileData, contactsData, conversationsData, channelsData, rulesData]) => {
        const tenant = profileData.tenantMembers[0]?.tenant;
        setTenantName(tenant?.name ?? 'ReplyPro Workspace');
        setTenantSlug(tenant?.slug ?? 'workspace');
        setTenantPlan(tenant?.planCode ?? 'starter');
        setContacts(contactsData);
        setConversations(conversationsData);
        setChannels(channelsData);
        setRules(rulesData.rules);
        setError(null);
      })
      .catch((fetchError) => {
        clearAuthToken();
        setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuatkan analytics');
        router.replace('/login');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const contact of contacts) {
      for (const tag of contact.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [contacts]);

  const recentConversations = useMemo(
    () =>
      [...conversations]
        .sort((a, b) => new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime())
        .slice(0, 5),
    [conversations],
  );

  const unreadTotal = useMemo(() => conversations.reduce((total, item) => total + item.unreadCount, 0), [conversations]);

  const connectedChannels = channels.filter((channel) => channel.status === 'connected');
  const pendingChannels = channels.filter((channel) => channel.status !== 'connected');
  const activeRules = rules.filter((rule) => rule.isActive);

  const kpis = [
    { label: 'Total Contacts', value: String(contacts.length).padStart(2, '0'), icon: Users },
    { label: 'Open Conversations', value: String(conversations.length).padStart(2, '0'), icon: MessagesSquare },
    { label: 'Unread Messages', value: String(unreadTotal).padStart(2, '0'), icon: Activity },
    { label: 'Connected Channels', value: String(connectedChannels.length).padStart(2, '0'), icon: Phone },
  ];

  if (loading) {
    return <div className="rounded-[28px] border bg-white/90 px-6 py-10 text-sm text-foreground/65 shadow-panel">Memuatkan analytics workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border bg-white/90 p-6 shadow-panel md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-foreground/45">Analytics Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold">Workspace Performance Snapshot</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-foreground/65">
              Guna data live sedia ada untuk baca health workspace, channel readiness, contact composition, dan automation coverage sebelum modul analytics penuh dibina.
            </p>
          </div>

          <div className="rounded-[24px] border bg-muted/45 px-4 py-4 text-sm text-foreground/65 lg:w-[320px]">
            <p className="font-medium text-foreground">{tenantName}</p>
            <p className="mt-1">Slug: {tenantSlug}</p>
            <p className="mt-1">Plan: {tenantPlan}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article key={kpi.label} className="rounded-[24px] border bg-white/90 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs uppercase tracking-[0.18em] text-foreground/45">Live</span>
              </div>
              <p className="mt-5 text-3xl font-semibold">{kpi.value}</p>
              <p className="mt-2 text-sm text-foreground/65">{kpi.label}</p>
            </article>
          );
        })}
      </section>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[28px] border bg-white/90 p-6 shadow-panel">
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Channel Health</h2>
          </div>

          <div className="mt-5 space-y-3">
            {channels.map((channel) => (
              <div key={channel.id} className="rounded-2xl border bg-muted/45 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{channel.displayName}</p>
                    <p className="text-sm text-foreground/60">{channel.phoneNumber ?? channel.evolutionInstanceName}</p>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${channel.status === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {channel.status}
                  </div>
                </div>
                <p className="mt-3 text-xs text-foreground/52">
                  {channel.lastConnectedAt
                    ? `Last connected ${new Date(channel.lastConnectedAt).toLocaleString('ms-MY')}`
                    : 'Belum pernah connected'}
                </p>
              </div>
            ))}

            {!channels.length ? <div className="rounded-2xl border bg-muted/45 px-4 py-6 text-sm text-foreground/60">Belum ada channel untuk dipaparkan.</div> : null}
          </div>
        </article>

        <article className="rounded-[28px] border bg-white/90 p-6 shadow-panel">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Automation Coverage</h2>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border bg-muted/45 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-foreground/45">Active Rules</p>
              <p className="mt-3 text-3xl font-semibold">{String(activeRules.length).padStart(2, '0')}</p>
              <p className="mt-2 text-sm text-foreground/60">Daripada {rules.length} total rule keyword.</p>
            </div>

            <div className="rounded-2xl border bg-muted/45 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-foreground/45">Keyword Coverage</p>
              <p className="mt-3 text-3xl font-semibold">{String(activeRules.reduce((total, rule) => total + rule.keywords.length, 0)).padStart(2, '0')}</p>
              <p className="mt-2 text-sm text-foreground/60">Jumlah keyword aktif yang sedang memantau inbound messages.</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {rules.slice(0, 4).map((rule) => (
              <div key={rule.id ?? rule.name} className="rounded-2xl border bg-muted/45 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{rule.name}</p>
                    <p className="mt-2 text-sm text-foreground/60">{rule.keywords.join(', ') || 'Tiada keyword'}</p>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${rule.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {rule.isActive ? 'active' : 'paused'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[28px] border bg-white/90 p-6 shadow-panel">
          <div className="flex items-center gap-3">
            <Tags className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Top Contact Tags</h2>
          </div>

          <div className="mt-5 space-y-3">
            {topTags.length ? (
              topTags.map((item) => (
                <div key={item.tag} className="flex items-center justify-between rounded-2xl border bg-muted/45 px-4 py-3">
                  <span className="font-medium">{item.tag}</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/70">{item.count}</span>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border bg-muted/45 px-4 py-6 text-sm text-foreground/60">Belum ada tag pada contacts.</div>
            )}
          </div>
        </article>

        <article className="rounded-[28px] border bg-white/90 p-6 shadow-panel">
          <div className="flex items-center gap-3">
            <Clock3 className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Recent Activity</h2>
          </div>

          <div className="mt-5 space-y-3">
            {recentConversations.length ? (
              recentConversations.map((conversation) => (
                <div key={conversation.id} className="rounded-2xl border bg-muted/45 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{conversation.contact.name ?? conversation.contact.phoneNumber}</p>
                      <p className="text-sm text-foreground/60">{conversation.channel.displayName}</p>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${conversation.unreadCount ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {conversation.unreadCount ? `${conversation.unreadCount} unread` : 'clear'}
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-foreground/68">{conversation.messages[0]?.content ?? 'Belum ada mesej dalam thread ini.'}</p>
                  <p className="mt-3 text-xs text-foreground/52">
                    {conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleString('ms-MY') : 'Tiada masa mesej'}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border bg-muted/45 px-4 py-6 text-sm text-foreground/60">Belum ada activity conversations.</div>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[24px] border bg-white/90 p-5 shadow-sm">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <p className="mt-5 text-sm uppercase tracking-[0.18em] text-foreground/45">Readiness</p>
          <p className="mt-3 text-2xl font-semibold">{pendingChannels.length ? 'Needs Attention' : 'Healthy'}</p>
          <p className="mt-2 text-sm text-foreground/65">{pendingChannels.length ? `${pendingChannels.length} channel perlukan refresh atau reconnect.` : 'Semua channel kini connected.'}</p>
        </article>

        <article className="rounded-[24px] border bg-white/90 p-5 shadow-sm">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
            <Users className="h-5 w-5" />
          </div>
          <p className="mt-5 text-sm uppercase tracking-[0.18em] text-foreground/45">Opt-in Ratio</p>
          <p className="mt-3 text-2xl font-semibold">{contacts.length ? `${Math.round((contacts.filter((item) => item.optIn).length / contacts.length) * 100)}%` : '0%'}</p>
          <p className="mt-2 text-sm text-foreground/65">Peratus contact yang masih boleh menerima mesej aktif.</p>
        </article>

        <article className="rounded-[24px] border bg-white/90 p-5 shadow-sm">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
            <Bot className="h-5 w-5" />
          </div>
          <p className="mt-5 text-sm uppercase tracking-[0.18em] text-foreground/45">Automation Share</p>
          <p className="mt-3 text-2xl font-semibold">{conversations.length ? `${Math.round((conversations.filter((item) => item.aiEnabled).length / conversations.length) * 100)}%` : '0%'}</p>
          <p className="mt-2 text-sm text-foreground/65">Conversation yang currently ditanda AI-enabled dalam inbox data semasa.</p>
        </article>
      </section>
    </div>
  );
}
