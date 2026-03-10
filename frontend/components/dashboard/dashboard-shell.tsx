'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import { ArrowRight, ChevronRight, LogOut, MessagesSquare, Send, ShieldCheck, Sparkles, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clearAuthToken, fetchJson, getAuthToken } from '@/lib/auth';

type MeResponse = {
  fullName: string;
  email: string;
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

function formatMessageStatus(status: string) {
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
}

function getMessageTime(message: ConversationDetail['messages'][number]) {
  return message.readAt ?? message.deliveredAt ?? message.sentAt ?? message.createdAt;
}

export function DashboardShell() {
  const router = useRouter();
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversationDetail, setConversationDetail] = useState<ConversationDetail | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshInboxData(token: string) {
    const [contactsData, conversationsData] = await Promise.all([
      fetchJson<ContactSummary[]>('/api/contacts', undefined, token),
      fetchJson<ConversationSummary[]>('/api/conversations', undefined, token),
    ]);

    setContacts(contactsData);
    setConversations(conversationsData);
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
    ])
      .then(([profileData, contactsData, conversationsData]) => {
        setProfile(profileData);
        setContacts(contactsData);
        setConversations(conversationsData);
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
      .then(setConversationDetail)
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

    return () => {
      socketClient.disconnect();
    };
  }, [activeConversationId, profile]);

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
      const detail = await fetchJson<ConversationDetail>(`/api/conversations/${activeConversationId}/messages`, undefined, token);
      setConversationDetail(detail);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Gagal hantar mesej');
    } finally {
      setIsSending(false);
    }
  }

  function handleLogout() {
    clearAuthToken();
    router.replace('/login');
  }

  const primaryTenant = profile?.tenantMembers[0]?.tenant ?? null;
  const stats = useMemo(
    () => [
      { label: 'Conversations', value: String(conversations.length).padStart(2, '0') },
      { label: 'Contacts', value: String(contacts.length).padStart(2, '0') },
      { label: 'Unread', value: String(conversations.reduce((sum, item) => sum + item.unreadCount, 0)).padStart(2, '0') },
    ],
    [contacts.length, conversations],
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-mesh px-6 text-foreground">
        <div className="rounded-[28px] border bg-white/85 px-6 py-5 shadow-panel">Memuatkan legacy fallback...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-mesh px-4 py-4 text-foreground md:px-6 md:py-6">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[28px] border bg-white/90 p-5 shadow-panel">
          <div className="rounded-[24px] bg-primary px-4 py-5 text-white">
            <p className="text-xs uppercase tracking-[0.28em] opacity-80">Legacy Fallback</p>
            <h1 className="mt-3 text-2xl font-semibold">Inbox Backup View</h1>
            <p className="mt-2 text-sm opacity-80">Legacy kini dibersihkan dan tinggal sebagai fallback inbox sementara.</p>
          </div>

          <div className="mt-5 rounded-[24px] border bg-muted/60 p-4 text-sm text-foreground/72">
            <p className="font-semibold">{profile?.fullName}</p>
            <p className="mt-1">{profile?.email}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-foreground/45">{primaryTenant?.name ?? 'Tenant belum dipilih'}</p>
            <p className="mt-1 text-xs text-foreground/55">Plan: {primaryTenant?.planCode ?? 'starter'}</p>
          </div>

          <div className="mt-5 space-y-2">
            {[
              { href: '/dashboard', label: 'Workspace Overview' },
              { href: '/dashboard/inbox', label: 'Inbox Baharu' },
              { href: '/dashboard/channels', label: 'Channels Baharu' },
              { href: '/dashboard/automations', label: 'Automations Baharu' },
              { href: '/dashboard/contacts', label: 'Contacts Baharu' },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="flex items-center justify-between rounded-2xl border bg-muted/45 px-4 py-3 text-sm transition hover:bg-secondary/50">
                <span>{item.label}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>

          <Button variant="ghost" className="mt-6 w-full justify-between" onClick={handleLogout}>
            Keluar
            <LogOut className="h-4 w-4" />
          </Button>
        </aside>

        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[28px] border bg-white/90 p-6 shadow-panel">
              <p className="text-xs uppercase tracking-[0.26em] text-foreground/45">Legacy Notice</p>
              <h2 className="mt-3 text-3xl font-semibold">Feature baharu sudah berpindah ke workspace baru.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/68">
                Channels, contacts, automations, dan analytics kini hidup dalam shell baru. Route ini hanya mengekalkan inbox fallback supaya transisi kekal selamat sepanjang development.
              </p>
            </div>

            <div className="rounded-[28px] border bg-[#17352b] p-6 text-white shadow-panel">
              <p className="text-xs uppercase tracking-[0.26em] text-white/60">Realtime State</p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                <Wifi className="h-3.5 w-3.5" />
                {socketConnected ? 'Realtime connected' : 'Realtime connecting'}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {stats.map((stat) => (
              <article key={stat.label} className="rounded-[26px] border bg-white/90 p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-foreground/45">{stat.label}</p>
                <p className="mt-5 text-3xl font-semibold">{stat.value}</p>
              </article>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
            <article className="rounded-[28px] border bg-white/90 p-6 shadow-panel">
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
              </div>
            </article>

            <article className="rounded-[28px] border bg-white/90 p-6 shadow-panel">
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
                      <div key={message.id} className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-[24px] px-4 py-3 text-sm shadow-sm ${message.direction === 'outbound' ? 'bg-primary text-white' : 'border bg-muted/60 text-foreground'}`}>
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
                    <Input value={draftMessage} onChange={(event) => setDraftMessage(event.target.value)} placeholder="Taip balasan kepada pelanggan..." />
                    <Button onClick={handleSendMessage} disabled={isSending || !draftMessage.trim()} className="h-11 gap-2">
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
        </section>
      </div>
    </main>
  );
}
