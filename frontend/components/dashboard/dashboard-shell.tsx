'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  LogOut,
  MessageCircle,
  MessageCircleMore,
  MessagesSquare,
  Phone,
  Radio,
  Send,
  ShieldCheck,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clearAuthToken, fetchJson, getAuthToken } from '@/lib/auth';

type MeResponse = {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  tenantMembers: Array<{
    role: string;
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

type ConversationDetail = {
  id: string;
  status: string;
  aiEnabled: boolean;
  unreadCount: number;
  contact: {
    id: string;
    name: string | null;
    phoneNumber: string;
    email: string | null;
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
    providerMessageId: string | null;
    createdAt: string;
    sentAt: string | null;
    deliveredAt: string | null;
    readAt: string | null;
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

type KeywordRuleForm = {
  id: string | null;
  name: string;
  isActive: boolean;
  keywordsText: string;
  replyText: string;
};

function toAutomationRuleForms(rules: KeywordRule[]): KeywordRuleForm[] {
  return rules.map((rule) => ({
    id: rule.id,
    name: rule.name,
    isActive: rule.isActive,
    keywordsText: rule.keywords.join(', '),
    replyText: rule.replyText,
  }));
}

function normalizeQrCode(qrCode: string | null) {
  if (!qrCode) {
    return null;
  }

  const normalized = qrCode.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('data:image/')) {
    return normalized;
  }

  const compact = normalized.replace(/\s+/g, '');
  if (compact.length >= 128 && compact.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(compact)) {
    return `data:image/png;base64,${compact}`;
  }

  return null;
}

function extractQrError(channel: ChannelSummary) {
  const metadataError = channel.metadata?.lastQrError;
  if (typeof metadataError === 'string' && metadataError.trim()) {
    return metadataError.trim();
  }

  if (!channel.qrCode || !channel.qrCode.trim().startsWith('{')) {
    return null;
  }

  try {
    const parsed = JSON.parse(channel.qrCode) as {
      message?: unknown;
      data?: { message?: unknown; error?: unknown };
    };

    const candidates = [parsed.message, parsed.data?.message, parsed.data?.error];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function DashboardShell() {
  const router = useRouter();
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversationDetail, setConversationDetail] = useState<ConversationDetail | null>(null);
  const [automationSettings, setAutomationSettings] = useState<KeywordRulesResponse>({ rules: [] });
  const [draftMessage, setDraftMessage] = useState('');
  const [automationRules, setAutomationRules] = useState<KeywordRuleForm[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isSavingAutomation, setIsSavingAutomation] = useState(false);
  const [loadingQrByChannel, setLoadingQrByChannel] = useState<Record<string, boolean>>({});
  const [qrCooldownByChannel, setQrCooldownByChannel] = useState<Record<string, boolean>>({});
  const [socketConnected, setSocketConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshInboxData(token: string) {
    const [contactsData, conversationsData, channelsData] = await Promise.all([
      fetchJson<ContactSummary[]>('/api/contacts', undefined, token),
      fetchJson<ConversationSummary[]>('/api/conversations', undefined, token),
      fetchJson<ChannelSummary[]>('/api/manage/channels', undefined, token),
    ]);

    setContacts(contactsData);
    setConversations(conversationsData);
    setChannels(channelsData);
    setActiveConversationId((current) => current ?? conversationsData[0]?.id ?? null);
  }

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
      .then(([profileData, contactsData, conversationsData, channelsData, automationData]) => {
        setProfile(profileData);
        setContacts(contactsData);
        setConversations(conversationsData);
        setChannels(channelsData);
        setAutomationSettings(automationData);
        setAutomationRules(toAutomationRuleForms(automationData.rules));
        setActiveConversationId(conversationsData[0]?.id ?? null);
        setError(null);
      })
      .catch((fetchError) => {
        clearAuthToken();
        setError(fetchError instanceof Error ? fetchError.message : 'Sesi tidak sah');
        router.replace('/login');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  useEffect(() => {
    const token = getAuthToken();

    if (!token || !activeConversationId) {
      setConversationDetail(null);
      return;
    }

    fetchJson<ConversationDetail>(`/api/conversations/${activeConversationId}/messages`, undefined, token)
      .then((data) => {
        setConversationDetail(data);
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuatkan mesej');
      });
  }, [activeConversationId]);

  useEffect(() => {
    const token = getAuthToken();
    const tenantId = profile?.tenantMembers[0]?.tenant.id;

    if (!token || !tenantId) {
      return;
    }

    const socketClient: Socket = io('/', {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
    });

    const refresh = () => {
      refreshInboxData(token).catch(() => null);

      if (activeConversationId) {
        fetchJson<ConversationDetail>(`/api/conversations/${activeConversationId}/messages`, undefined, token)
          .then(setConversationDetail)
          .catch(() => null);
      }
    };

    socketClient.on('connect', () => {
      setSocketConnected(true);
      socketClient.emit('tenant:subscribe', { tenantId });
    });

    socketClient.on('disconnect', () => {
      setSocketConnected(false);
    });

    socketClient.on('inbox.updated', refresh);
    socketClient.on('message.queued', refresh);
    socketClient.on('channel.updated', refresh);

    return () => {
      socketClient.disconnect();
    };
  }, [activeConversationId, profile]);

  const primaryTenant = useMemo(() => profile?.tenantMembers[0]?.tenant ?? null, [profile]);
  const formatMessageStatus = (status: string) => {
    switch (status) {
      case 'queued':
        return 'Beratur';
      case 'processing':
        return 'Diproses';
      case 'sent':
        return 'Dihantar';
      case 'delivered':
        return 'Diterima';
      case 'read':
        return 'Dibaca';
      case 'failed':
        return 'Gagal';
      default:
        return status;
    }
  };

  const getMessageTime = (message: ConversationDetail['messages'][number]) => {
    return message.readAt ?? message.deliveredAt ?? message.sentAt ?? message.createdAt;
  };

  const stats = useMemo(
    () => [
      { label: 'Conversations', value: String(conversations.length).padStart(2, '0'), icon: MessageCircleMore },
      { label: 'Contacts', value: String(contacts.length).padStart(2, '0'), icon: MessageCircle },
      { label: 'AI Enabled', value: String(conversations.filter((item) => item.aiEnabled).length).padStart(2, '0'), icon: Bot },
      {
        label: 'Connected Numbers',
        value: String(new Set(conversations.map((item) => item.channel.id)).size).padStart(2, '0'),
        icon: Radio,
      },
    ],
    [contacts.length, conversations],
  );

  function handleLogout() {
    clearAuthToken();
    router.replace('/login');
  }

  async function handleSendMessage() {
    const token = getAuthToken();

    if (!token || !activeConversationId || !draftMessage.trim()) {
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      await fetchJson(
        `/api/conversations/${activeConversationId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ content: draftMessage.trim() }),
        },
        token,
      );

      setDraftMessage('');
      await refreshInboxData(token);
      const detail = await fetchJson<ConversationDetail>(
        `/api/conversations/${activeConversationId}/messages`,
        undefined,
        token,
      );
      setConversationDetail(detail);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Gagal hantar mesej');
    } finally {
      setIsSending(false);
    }
  }

  async function handleConnectChannel(channelId: string) {
    const token = getAuthToken();
    if (!token) {
      return;
    }

    if (loadingQrByChannel[channelId] || qrCooldownByChannel[channelId]) {
      return;
    }

    try {
      setLoadingQrByChannel((current) => ({ ...current, [channelId]: true }));
      await fetchJson(`/api/manage/channels/${channelId}/connect`, { method: 'POST' }, token);
      await refreshInboxData(token);
      setQrCooldownByChannel((current) => ({ ...current, [channelId]: true }));
      window.setTimeout(() => {
        setQrCooldownByChannel((current) => ({ ...current, [channelId]: false }));
      }, 15000);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Gagal connect channel');
    } finally {
      setLoadingQrByChannel((current) => ({ ...current, [channelId]: false }));
    }
  }

  async function handleRefreshChannel(channelId: string) {
    const token = getAuthToken();
    if (!token) {
      return;
    }

    try {
      await fetchJson(`/api/manage/channels/${channelId}/refresh`, { method: 'POST' }, token);
      await refreshInboxData(token);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Gagal refresh channel');
    }
  }

  async function handleSaveAutomationSettings() {
    const token = getAuthToken();
    if (!token) {
      return;
    }

    setIsSavingAutomation(true);
    setError(null);

    try {
      const payload = await fetchJson<KeywordRulesResponse>(
        '/api/manage/automations/keyword-rules',
        {
          method: 'PUT',
          body: JSON.stringify({
            rules: automationRules.map((rule) => ({
              id: rule.id,
              name: rule.name.trim() || 'Keyword Auto Reply',
              isActive: rule.isActive,
              keywords: rule.keywordsText
                .split(',')
                .map((keyword) => keyword.trim())
                .filter(Boolean),
              replyText: rule.replyText.trim(),
            })),
          }),
        },
        token,
      );

      setAutomationSettings(payload);
      setAutomationRules(toAutomationRuleForms(payload.rules));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal simpan automation');
    } finally {
      setIsSavingAutomation(false);
    }
  }

  function handleAddAutomationRule() {
    setAutomationRules((current) => [
      ...current,
      {
        id: null,
        name: `Keyword Auto Reply ${current.length + 1}`,
        isActive: true,
        keywordsText: '',
        replyText: '',
      },
    ]);
  }

  function handleRemoveAutomationRule(index: number) {
    setAutomationRules((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function updateAutomationRule(index: number, patch: Partial<KeywordRuleForm>) {
    setAutomationRules((current) => current.map((rule, currentIndex) => (currentIndex === index ? { ...rule, ...patch } : rule)));
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-mesh px-6 text-foreground">
        <div className="rounded-[28px] border bg-white/85 px-6 py-5 shadow-panel">
          Memuatkan ReplyPro workspace...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-mesh px-4 py-4 text-foreground md:px-6 md:py-6">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-[28px] border bg-white/85 p-5 shadow-panel backdrop-blur">
          <div className="rounded-[24px] bg-primary px-4 py-5 text-white">
            <p className="text-xs uppercase tracking-[0.28em] opacity-80">ReplyPro</p>
            <h1 className="mt-3 text-2xl font-semibold">Control Tower</h1>
              <p className="mt-2 text-sm opacity-80">Phase 2 dashboard untuk inbox, contacts, dan message timeline.</p>
          </div>

          <div className="mt-5 space-y-3 rounded-[24px] border bg-muted/60 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-foreground/45">Logged in</p>
            <p className="text-lg font-semibold">{profile?.fullName}</p>
            <p className="text-sm text-foreground/65">{profile?.email}</p>
            <div className="inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
              {profile?.tenantMembers[0]?.role ?? 'member'}
            </div>
          </div>

          <div className="mt-5 space-y-2 text-sm text-foreground/72">
            {['Overview', 'Inbox Live', 'Contacts', 'Numbers', 'Campaigns', 'Analytics'].map((item) => (
              <div key={item} className="rounded-2xl px-3 py-2 transition hover:bg-secondary/70">
                {item}
              </div>
            ))}
          </div>

          <Button variant="ghost" className="mt-6 w-full justify-between" onClick={handleLogout}>
            Keluar
            <LogOut className="h-4 w-4" />
          </Button>
        </aside>

        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1.35fr_0.95fr]">
            <div className="rounded-[28px] border bg-white/85 p-6 shadow-panel">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.26em] text-foreground/45">Workspace</p>
                  <h2 className="mt-3 text-3xl font-semibold">{primaryTenant?.name ?? 'Tenant belum dipilih'}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/68">
                    Dashboard kini dah tarik data conversation, contact, dan timeline mesej sebenar dari backend Prisma. Ini jadi asas kepada team inbox dan operasi support seterusnya.
                  </p>
                </div>

                <div className="rounded-[24px] border bg-muted/70 px-4 py-4 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <Building2 className="h-4 w-4" />
                    {primaryTenant?.slug ?? 'no-tenant'}
                  </div>
                  <p className="mt-2 text-foreground/65">Plan: {primaryTenant?.planCode ?? 'starter'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border bg-[#17352b] p-6 text-white shadow-panel">
              <p className="text-xs uppercase tracking-[0.26em] text-white/60">Inbox State</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="rounded-2xl bg-white/10 p-3">
                  <MessagesSquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-lg font-semibold">Inbox API Connected</p>
                  <p className="text-sm text-white/70">Conversation list, contact list, dan message detail kini datang dari backend protected endpoints.</p>
                </div>
              </div>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                <Wifi className="h-3.5 w-3.5" />
                {socketConnected ? 'Realtime connected' : 'Realtime connecting'}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <article key={stat.label} className="rounded-[26px] border bg-white/85 p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="rounded-2xl bg-secondary p-3">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs uppercase tracking-[0.2em] text-foreground/45">Live</span>
                  </div>
                  <p className="mt-5 text-3xl font-semibold">{stat.value}</p>
                  <p className="mt-2 text-sm text-foreground/65">{stat.label}</p>
                </article>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
            <article className="rounded-[28px] border bg-white/85 p-6 shadow-panel">
              <div className="flex items-center gap-3">
                <MessagesSquare className="h-5 w-5" />
                <h3 className="text-xl font-semibold">Conversation Inbox</h3>
              </div>
              <div className="mt-5 space-y-3">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setActiveConversationId(conversation.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${conversation.id === activeConversationId ? 'border-primary bg-secondary/55' : 'bg-muted/55 hover:bg-secondary/35'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{conversation.contact.name ?? conversation.contact.phoneNumber}</p>
                        <p className="text-sm text-foreground/60">{conversation.channel.displayName}</p>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/70">
                        {conversation.status}
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-foreground/68">
                      {conversation.messages[0]?.content ?? 'Belum ada mesej dalam thread ini.'}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs text-foreground/52">
                      <span>{conversation.assignedToUser?.fullName ?? 'Unassigned'}</span>
                      <span>{conversation.unreadCount} unread</span>
                    </div>
                  </button>
                ))}
                {!conversations.length ? (
                  <div className="rounded-2xl border bg-muted/55 px-4 py-6 text-sm text-foreground/60">
                    Tiada conversation lagi untuk tenant ini.
                  </div>
                ) : null}
              </div>
            </article>

            <article className="rounded-[28px] border bg-white/85 p-6 shadow-panel">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5" />
                  <h3 className="text-xl font-semibold">Thread Detail</h3>
                </div>
                {conversationDetail?.aiEnabled ? (
                  <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/75">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Enabled
                  </div>
                ) : null}
              </div>

              {conversationDetail ? (
                <>
                  <div className="mt-5 flex flex-wrap items-start justify-between gap-3 rounded-[24px] border bg-muted/55 p-4">
                    <div>
                      <p className="font-medium">{conversationDetail.contact.name ?? conversationDetail.contact.phoneNumber}</p>
                      <p className="text-sm text-foreground/60">{conversationDetail.contact.phoneNumber}</p>
                    </div>
                    <div className="space-y-1 text-right text-sm text-foreground/62">
                      <p>{conversationDetail.channel.displayName}</p>
                      <p>{conversationDetail.assignedToUser?.fullName ?? 'Belum assign agent'}</p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {conversationDetail.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-[24px] px-4 py-3 text-sm shadow-sm ${message.direction === 'outbound' ? 'bg-primary text-white' : 'border bg-muted/60 text-foreground'}`}
                        >
                          <p className="leading-6">{message.content ?? 'Media / system message'}</p>
                          <div className={`mt-2 flex items-center gap-2 text-[11px] ${message.direction === 'outbound' ? 'text-white/70' : 'text-foreground/50'}`}>
                            <span>{formatMessageStatus(message.status)}</span>
                            <ChevronRight className="h-3 w-3" />
                            <span>{new Date(getMessageTime(message)).toLocaleString('ms-MY')}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex gap-3 rounded-[24px] border bg-muted/55 p-3">
                    <Input
                      value={draftMessage}
                      onChange={(event) => setDraftMessage(event.target.value)}
                      placeholder="Taip balasan kepada pelanggan..."
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={isSending || !draftMessage.trim()}
                      className="h-11 gap-2"
                    >
                      {isSending ? 'Hantar...' : 'Hantar'}
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="mt-5 rounded-[24px] border bg-muted/55 px-4 py-10 text-sm text-foreground/60">
                  Pilih satu conversation untuk lihat thread mesej.
                </div>
              )}
              {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
            </article>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <article className="rounded-[28px] border bg-white/85 p-6 shadow-panel">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5" />
                <h3 className="text-xl font-semibold">Contacts</h3>
              </div>
              <div className="mt-5 space-y-3">
                {contacts.map((contact) => (
                  <div key={contact.id} className="rounded-2xl border bg-muted/55 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{contact.name ?? contact.phoneNumber}</p>
                        <p className="text-sm text-foreground/60">{contact.phoneNumber}</p>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/70">
                        {contact.optIn ? 'opt-in' : 'blocked'}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {contact.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground/75">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[28px] border bg-white/85 p-6 shadow-panel">
              <div className="flex items-center gap-3">
                <Radio className="h-5 w-5" />
                <h3 className="text-xl font-semibold">Channels & QR</h3>
              </div>
              <div className="mt-5 space-y-3 text-sm text-foreground/68">
                {channels.map((channel) => {
                  const qrImage = normalizeQrCode(channel.qrCode);
                  const qrError = extractQrError(channel);
                  const isQrLoading = Boolean(loadingQrByChannel[channel.id]);
                  const isQrCoolingDown = Boolean(qrCooldownByChannel[channel.id]);
                  const disableQrRequest = channel.status === 'connected' || isQrLoading || isQrCoolingDown;

                  return (
                    <div key={channel.id} className="rounded-2xl border bg-muted/55 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{channel.displayName}</p>
                          <p className="text-sm text-foreground/60">
                            {channel.phoneNumber ?? channel.evolutionInstanceName}
                          </p>
                        </div>
                        <div
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${channel.status === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
                        >
                          {channel.status === 'connected' ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <Radio className="h-3.5 w-3.5" />
                          )}
                          {channel.status}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          className="h-10"
                          onClick={() => handleConnectChannel(channel.id)}
                          disabled={disableQrRequest}
                        >
                          {channel.status === 'connected'
                            ? 'Sudah Connect'
                            : isQrLoading
                              ? 'Meminta QR...'
                              : isQrCoolingDown
                                ? 'Tunggu Sebentar'
                                : 'Ambil QR'}
                        </Button>
                        <Button variant="ghost" className="h-10" onClick={() => handleRefreshChannel(channel.id)}>
                          Refresh Status
                        </Button>
                      </div>
                      {qrImage ? (
                        <div className="mt-3 rounded-2xl border bg-white p-4">
                          <img
                            src={qrImage}
                            alt={`QR ${channel.displayName}`}
                            className="mx-auto h-auto w-full max-w-[280px] rounded-xl"
                          />
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-foreground/55">
                          {qrError ?? (channel.status === 'connected'
                            ? 'Channel sudah tersambung.'
                            : 'QR belum tersedia untuk channel ini.')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          </div>

          <article className="rounded-[28px] border bg-white/85 p-6 shadow-panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5" />
                <div>
                  <h3 className="text-xl font-semibold">Automation Settings</h3>
                  <p className="text-sm text-foreground/60">Urus keyword auto-reply untuk tenant semasa terus dari localhost.</p>
                </div>
              </div>
              <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                {automationRules.filter((rule) => rule.isActive).length} Active Rules
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border bg-muted/55 p-4 text-sm text-foreground/65">
                <span>Total rule: {automationRules.length}</span>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={handleAddAutomationRule} className="h-10">
                    Tambah Rule
                  </Button>
                  <Button onClick={handleSaveAutomationSettings} disabled={isSavingAutomation} className="h-10">
                    {isSavingAutomation ? 'Menyimpan...' : 'Simpan Semua'}
                  </Button>
                </div>
              </div>

              {automationRules.length ? (
                automationRules.map((rule, index) => (
                  <div key={rule.id ?? `new-${index}`} className="grid gap-4 rounded-[24px] border bg-muted/55 p-4 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-foreground/45">Workflow Name</p>
                        <Input
                          className="mt-2"
                          value={rule.name}
                          onChange={(event) => updateAutomationRule(index, { name: event.target.value })}
                          placeholder="Keyword Auto Reply"
                        />
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-foreground/45">Keyword List</p>
                        <Input
                          className="mt-2"
                          value={rule.keywordsText}
                          onChange={(event) => updateAutomationRule(index, { keywordsText: event.target.value })}
                          placeholder="stok, harga, delivery"
                        />
                        <p className="mt-2 text-xs text-foreground/55">Pisahkan keyword dengan koma. Matching dibuat secara lowercase.</p>
                      </div>

                      <label className="flex items-center justify-between rounded-2xl border bg-white px-4 py-3 text-sm">
                        <div>
                          <p className="font-medium">Rule aktif</p>
                          <p className="text-xs text-foreground/55">Rule ini akan trigger bila keyword dipadan.</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={rule.isActive}
                          onChange={(event) => updateAutomationRule(index, { isActive: event.target.checked })}
                          className="h-4 w-4 accent-[#17352b]"
                        />
                      </label>

                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-foreground/65">
                        <span>Workflow ID: {rule.id ?? 'akan dicipta semasa save'}</span>
                        <Button variant="ghost" onClick={() => handleRemoveAutomationRule(index)} className="h-9">
                          Buang Rule
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-foreground/45">Reply Text</p>
                      <textarea
                        value={rule.replyText}
                        onChange={(event) => updateAutomationRule(index, { replyText: event.target.value })}
                        placeholder="Terima kasih. Team kami akan balas sebentar lagi."
                        className="mt-2 min-h-[180px] w-full rounded-[22px] border border-border bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                      <p className="mt-2 text-xs text-foreground/55">Balasan ini akan dihantar bila mesej masuk mengandungi salah satu keyword rule ini.</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border bg-muted/55 px-4 py-10 text-sm text-foreground/60">
                  Belum ada rule automation. Tekan `Tambah Rule` untuk mula bina auto-reply keyword.
                </div>
              )}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
