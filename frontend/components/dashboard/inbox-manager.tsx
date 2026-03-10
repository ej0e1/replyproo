'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import { ChevronRight, MessageCircle, MessagesSquare, Send, ShieldCheck, Sparkles, Users, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clearAuthToken, fetchJson, getAuthToken } from '@/lib/auth';

type MeResponse = {
  id: string;
  fullName: string;
  email: string;
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
  leadStage: 'new_lead' | 'follow_up' | 'test_drive' | 'booking' | 'loan_submitted' | 'won' | 'lost';
  leadDetails: {
    vehicleType: 'car' | 'motorcycle' | null;
    brand: string | null;
    modelInterest: string | null;
    budgetMonthly: string | null;
    purchaseType: 'cash' | 'loan' | null;
    tradeIn: 'yes' | 'no' | null;
    showroomBranch: string | null;
  };
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
    leadStage: 'new_lead' | 'follow_up' | 'test_drive' | 'booking' | 'loan_submitted' | 'won' | 'lost';
    leadDetails: ContactSummary['leadDetails'];
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
    leadStage: 'new_lead' | 'follow_up' | 'test_drive' | 'booking' | 'loan_submitted' | 'won' | 'lost';
    leadDetails: ContactSummary['leadDetails'];
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

function formatLeadStage(stage: ContactSummary['leadStage']) {
  switch (stage) {
    case 'new_lead':
      return 'New Lead';
    case 'follow_up':
      return 'Follow-up';
    case 'test_drive':
      return 'Test Drive';
    case 'booking':
      return 'Booking';
    case 'loan_submitted':
      return 'Loan Submitted';
    case 'won':
      return 'Won';
    case 'lost':
      return 'Lost';
    default:
      return stage;
  }
}

function buildDealerQuickReplies(detail: ConversationDetail | null) {
  const contactName = detail?.contact.name ?? 'tuan/puan';
  const vehicleTypeLabel = detail?.contact.leadDetails.vehicleType === 'motorcycle' ? 'motor' : 'kereta';
  const brand = detail?.contact.leadDetails.brand ?? 'pilihan anda';
  const model = detail?.contact.leadDetails.modelInterest ?? `${brand} ${vehicleTypeLabel}`.trim();
  const budget = detail?.contact.leadDetails.budgetMonthly ?? 'budget bulanan anda';
  const branch = detail?.contact.leadDetails.showroomBranch ?? 'showroom kami';

  return [
    {
      id: 'price',
      label: 'Harga',
      text: `Hi ${contactName}, untuk ${model}, saya boleh bantu semak harga atas jalan, promo semasa, dan anggaran bulanan ikut pakej yang sesuai dengan ${budget}.`,
    },
    {
      id: 'stock',
      label: 'Stok',
      text: `Hi ${contactName}, stok untuk ${model} saya sedang semak sekarang. Jika anda mahu, saya boleh bantu semak warna available dan ETA unit ke ${branch}.`,
    },
    {
      id: 'promo',
      label: 'Promo',
      text: `Hi ${contactName}, sekarang ada promo bulanan untuk ${model}. Saya boleh share rebate, gift, dan pakej installment yang paling sesuai untuk anda.`,
    },
    {
      id: 'test-drive',
      label: 'Test Drive',
      text: `Hi ${contactName}, kalau anda free saya boleh bantu set slot test drive untuk ${model} di ${branch}. Boleh saya tahu hari dan masa yang anda prefer?`,
    },
    {
      id: 'loan-docs',
      label: 'Dokumen Loan',
      text: `Hi ${contactName}, untuk permohonan loan ${model}, biasanya kami perlukan IC, lesen, slip gaji atau penyata bank bergantung pada profile anda. Kalau mahu saya boleh bantu senaraikan ikut situasi anda.`,
    },
    {
      id: 'location',
      label: 'Lokasi',
      text: `Hi ${contactName}, anda boleh datang ke ${branch} untuk tengok unit ${model}. Kalau mahu, saya boleh share lokasi showroom dan arrange sales advisor standby untuk anda.`,
    },
  ];
}

const dealerLeadStages: Array<ContactSummary['leadStage']> = [
  'new_lead',
  'follow_up',
  'test_drive',
  'booking',
  'loan_submitted',
  'won',
  'lost',
];

const conversationStatuses: Array<ConversationSummary['status']> = ['open', 'pending', 'resolved', 'closed'];

export function InboxManager() {
  const router = useRouter();
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState('ReplyPro Workspace');
  const [tenantSlug, setTenantSlug] = useState('workspace');
  const [tenantPlan, setTenantPlan] = useState('starter');
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversationDetail, setConversationDetail] = useState<ConversationDetail | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | ContactSummary['leadStage']>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ConversationSummary['status']>('all');
  const [leadDetailsForm, setLeadDetailsForm] = useState<ContactSummary['leadDetails']>({
    vehicleType: null,
    brand: null,
    modelInterest: null,
    budgetMonthly: null,
    purchaseType: null,
    tradeIn: null,
    showroomBranch: null,
  });
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUpdatingAssignmentOrStatus, setIsUpdatingAssignmentOrStatus] = useState(false);
  const [isUpdatingLeadStage, setIsUpdatingLeadStage] = useState(false);
  const [isSavingLeadDetails, setIsSavingLeadDetails] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshInboxData(token: string) {
    const [contactsData, conversationsData] = await Promise.all([
      fetchJson<ContactSummary[]>('/api/contacts', undefined, token),
      fetchJson<ConversationSummary[]>('/api/conversations', undefined, token),
    ]);

    setContacts(contactsData);
    setConversations(conversationsData);
    setActiveConversationId((current) => current ?? conversationsData[0]?.id ?? null);
  }

  async function refreshConversationDetail(token: string, conversationId: string) {
    const detail = await fetchJson<ConversationDetail>(`/api/conversations/${conversationId}/messages`, undefined, token);
    setConversationDetail(detail);
  }

  function applyConversationSummaryUpdate(updated: ConversationSummary) {
    setConversations((current) =>
      current.map((conversation) => (conversation.id === updated.id ? { ...conversation, ...updated } : conversation)),
    );

    setConversationDetail((current) => {
      if (!current || current.id !== updated.id) {
        return current;
      }

      return {
        ...current,
        status: updated.status,
        unreadCount: updated.unreadCount,
        aiEnabled: updated.aiEnabled,
        assignedToUser: updated.assignedToUser,
        channel: updated.channel,
        contact: {
          ...current.contact,
          ...updated.contact,
        },
      };
    });

    if (updated.contact?.leadDetails) {
      setLeadDetailsForm(updated.contact.leadDetails);
    }
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
        const tenant = profileData.tenantMembers[0]?.tenant;
        setTenantId(tenant?.id ?? null);
        setTenantName(tenant?.name ?? 'ReplyPro Workspace');
        setTenantSlug(tenant?.slug ?? 'workspace');
        setTenantPlan(tenant?.planCode ?? 'starter');
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
    if (!conversationDetail) {
      return;
    }

    setLeadDetailsForm(conversationDetail.contact.leadDetails);
  }, [conversationDetail]);

  useEffect(() => {
    const token = getAuthToken();
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
  }, [activeConversationId, tenantId]);

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
      await refreshConversationDetail(token, activeConversationId);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Gagal hantar mesej');
    } finally {
      setIsSending(false);
    }
  }

  async function handleUpdateStatus(status: 'open' | 'pending' | 'resolved' | 'closed') {
    const token = getAuthToken();
    if (!token || !activeConversationId || isUpdatingAssignmentOrStatus) {
      return;
    }

    try {
      setIsUpdatingAssignmentOrStatus(true);
      setError(null);
      const updated = await fetchJson<ConversationSummary>(
        `/api/conversations/${activeConversationId}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        },
        token,
      );
      applyConversationSummaryUpdate(updated);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Gagal kemas kini status');
    } finally {
      setIsUpdatingAssignmentOrStatus(false);
    }
  }

  async function handleUpdateAssignee(action: 'assign_to_me' | 'unassign') {
    const token = getAuthToken();
    if (!token || !activeConversationId || isUpdatingAssignmentOrStatus) {
      return;
    }

    try {
      setIsUpdatingAssignmentOrStatus(true);
      setError(null);
      const updated = await fetchJson<ConversationSummary>(
        `/api/conversations/${activeConversationId}/assignee`,
        {
          method: 'PATCH',
          body: JSON.stringify({ action }),
        },
        token,
      );
      applyConversationSummaryUpdate(updated);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Gagal kemas kini assignment');
    } finally {
      setIsUpdatingAssignmentOrStatus(false);
    }
  }

  async function handleUpdateLeadStage(stage: ContactSummary['leadStage']) {
    const token = getAuthToken();
    if (!token || !activeConversationId || isUpdatingLeadStage) {
      return;
    }

    try {
      setIsUpdatingLeadStage(true);
      setError(null);
      const updated = await fetchJson<ConversationSummary>(
        `/api/conversations/${activeConversationId}/lead-stage`,
        {
          method: 'PATCH',
          body: JSON.stringify({ stage }),
        },
        token,
      );
      applyConversationSummaryUpdate(updated);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Gagal kemas kini lead stage');
    } finally {
      setIsUpdatingLeadStage(false);
    }
  }

  async function handleSaveLeadDetails() {
    const token = getAuthToken();
    if (!token || !activeConversationId || isSavingLeadDetails) {
      return;
    }

    try {
      setIsSavingLeadDetails(true);
      setError(null);
      const updated = await fetchJson<ConversationSummary>(
        `/api/conversations/${activeConversationId}/lead-details`,
        {
          method: 'PATCH',
          body: JSON.stringify(leadDetailsForm),
        },
        token,
      );
      applyConversationSummaryUpdate(updated);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal simpan lead details');
    } finally {
      setIsSavingLeadDetails(false);
    }
  }

  function updateLeadDetailsForm(patch: Partial<ContactSummary['leadDetails']>) {
    setLeadDetailsForm((current) => ({ ...current, ...patch }));
  }

  function handleUseQuickReply(text: string) {
    setDraftMessage(text);
  }

  const stats = useMemo(
    () => [
      { label: 'Conversations', value: String(conversations.length).padStart(2, '0'), icon: MessagesSquare },
      { label: 'Contacts', value: String(contacts.length).padStart(2, '0'), icon: Users },
      {
        label: 'AI Enabled',
        value: String(conversations.filter((conversation) => conversation.aiEnabled).length).padStart(2, '0'),
        icon: Sparkles,
      },
    ],
    [contacts.length, conversations],
  );

  const filteredConversations = useMemo(
    () =>
      conversations.filter((conversation) => {
        const matchesStage = stageFilter === 'all' || conversation.contact.leadStage === stageFilter;
        const matchesStatus = statusFilter === 'all' || conversation.status === statusFilter;
        return matchesStage && matchesStatus;
      }),
    [conversations, stageFilter, statusFilter],
  );

  const quickReplies = useMemo(() => buildDealerQuickReplies(conversationDetail), [conversationDetail]);

  useEffect(() => {
    if (!filteredConversations.length) {
      return;
    }

    if (!activeConversationId || !filteredConversations.some((conversation) => conversation.id === activeConversationId)) {
      setActiveConversationId(filteredConversations[0]?.id ?? null);
    }
  }, [activeConversationId, filteredConversations]);

  if (loading) {
    return <div className="rounded-[28px] border bg-white/90 px-6 py-10 text-sm text-foreground/65 shadow-panel">Memuatkan inbox workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border bg-white/90 p-6 shadow-panel md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-foreground/45">Inbox Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold">Live Conversation Inbox</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-foreground/65">
              Semua thread pelanggan, realtime refresh, dan composer mesej kini mula dipindahkan ke shell baru berinspirasikan v0.
            </p>
          </div>

          <div className="rounded-[24px] border bg-muted/45 px-4 py-4 text-sm text-foreground/65 lg:w-[320px]">
            <p className="font-medium text-foreground">{tenantName}</p>
            <p className="mt-1">Slug: {tenantSlug}</p>
            <p className="mt-1">Plan: {tenantPlan}</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/72">
              <Wifi className="h-3.5 w-3.5" />
              {socketConnected ? 'Realtime Connected' : 'Realtime Connecting'}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article key={stat.label} className="rounded-[24px] border bg-white/90 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs uppercase tracking-[0.18em] text-foreground/45">Live</span>
              </div>
              <p className="mt-5 text-3xl font-semibold">{stat.value}</p>
              <p className="mt-2 text-sm text-foreground/65">{stat.label}</p>
            </article>
          );
        })}
      </section>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <section className="rounded-[28px] border bg-white/90 p-5 shadow-panel">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-foreground/45">Filter Lead Stage</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant={stageFilter === 'all' ? 'secondary' : 'ghost'} className="h-9" onClick={() => setStageFilter('all')}>
                Semua Stage
              </Button>
              {dealerLeadStages.map((stage) => (
                <Button
                  key={stage}
                  variant={stageFilter === stage ? 'secondary' : 'ghost'}
                  className="h-9"
                  onClick={() => setStageFilter(stage)}
                >
                  {formatLeadStage(stage)}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-foreground/45">Filter Status Thread</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant={statusFilter === 'all' ? 'secondary' : 'ghost'} className="h-9" onClick={() => setStatusFilter('all')}>
                Semua Status
              </Button>
              {conversationStatuses.map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'secondary' : 'ghost'}
                  className="h-9"
                  onClick={() => setStatusFilter(status)}
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <article className="rounded-[28px] border bg-white/90 p-6 shadow-panel">
          <div className="flex items-center gap-3">
            <MessagesSquare className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Conversation Inbox</h2>
          </div>

          <div className="mt-4 rounded-2xl border bg-muted/45 px-4 py-3 text-sm text-foreground/65">
            Menunjukkan {filteredConversations.length} daripada {conversations.length} conversation.
          </div>

          <div className="mt-5 space-y-3">
            {filteredConversations.map((conversation) => (
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
                    <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-foreground/45">
                      {formatLeadStage(conversation.contact.leadStage)}
                    </p>
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

            {!filteredConversations.length ? (
              <div className="rounded-2xl border bg-muted/55 px-4 py-6 text-sm text-foreground/60">
                Tiada conversation yang sepadan dengan filter semasa.
              </div>
            ) : null}
          </div>
        </article>

        <article className="rounded-[28px] border bg-white/90 p-6 shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="text-xl font-semibold">Thread Detail</h2>
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
                  <div className="mt-3 inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/75">
                    {formatLeadStage(conversationDetail.contact.leadStage)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {conversationDetail.contact.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-foreground/75">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-1 text-right text-sm text-foreground/62">
                  <p>{conversationDetail.channel.displayName}</p>
                  <p>{conversationDetail.assignedToUser?.fullName ?? 'Belum assign agent'}</p>
                  <p className="text-xs uppercase tracking-[0.16em]">{conversationDetail.status}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 rounded-[24px] border bg-muted/45 p-3">
                <Button
                  variant="secondary"
                  className="h-10"
                  onClick={() => handleUpdateAssignee(conversationDetail.assignedToUser?.id === profile?.id ? 'unassign' : 'assign_to_me')}
                  disabled={isUpdatingAssignmentOrStatus}
                >
                  {isUpdatingAssignmentOrStatus
                    ? 'Mengemas kini...'
                    : conversationDetail.assignedToUser?.id === profile?.id
                      ? 'Unassign Saya'
                      : 'Assign Kepada Saya'}
                </Button>
                <Button variant="ghost" className="h-10" onClick={() => handleUpdateStatus('open')} disabled={isUpdatingAssignmentOrStatus}>
                  Set Open
                </Button>
                <Button variant="ghost" className="h-10" onClick={() => handleUpdateStatus('pending')} disabled={isUpdatingAssignmentOrStatus}>
                  Set Pending
                </Button>
                <Button variant="ghost" className="h-10" onClick={() => handleUpdateStatus('resolved')} disabled={isUpdatingAssignmentOrStatus}>
                  Mark Resolved
                </Button>
              </div>

              <div className="mt-4 rounded-[24px] border bg-muted/45 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-foreground/45">Dealer Lead Pipeline</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {dealerLeadStages.map((stage) => (
                    <Button
                      key={stage}
                      variant={conversationDetail.contact.leadStage === stage ? 'secondary' : 'ghost'}
                      className="h-9"
                      onClick={() => handleUpdateLeadStage(stage)}
                      disabled={isUpdatingLeadStage}
                    >
                      {isUpdatingLeadStage && conversationDetail.contact.leadStage === stage ? 'Mengemas kini...' : formatLeadStage(stage)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-[24px] border bg-muted/45 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-foreground/45">Lead Details Dealer</p>
                  <Button className="h-9" onClick={handleSaveLeadDetails} disabled={isSavingLeadDetails}>
                    {isSavingLeadDetails ? 'Menyimpan...' : 'Simpan Lead'}
                  </Button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="text-foreground/60">Jenis Kenderaan</span>
                    <select
                      value={leadDetailsForm.vehicleType ?? ''}
                      onChange={(event) => updateLeadDetailsForm({ vehicleType: (event.target.value || null) as ContactSummary['leadDetails']['vehicleType'] })}
                      className="h-11 w-full rounded-[18px] border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    >
                      <option value="">Pilih jenis</option>
                      <option value="car">Kereta</option>
                      <option value="motorcycle">Motor</option>
                    </select>
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="text-foreground/60">Jenama</span>
                    <Input value={leadDetailsForm.brand ?? ''} onChange={(event) => updateLeadDetailsForm({ brand: event.target.value || null })} placeholder="Honda, Toyota, Yamaha" />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="text-foreground/60">Model Minat</span>
                    <Input value={leadDetailsForm.modelInterest ?? ''} onChange={(event) => updateLeadDetailsForm({ modelInterest: event.target.value || null })} placeholder="City Hatchback, Y15ZR" />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="text-foreground/60">Budget Bulanan</span>
                    <Input value={leadDetailsForm.budgetMonthly ?? ''} onChange={(event) => updateLeadDetailsForm({ budgetMonthly: event.target.value || null })} placeholder="RM850 / month" />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="text-foreground/60">Jenis Pembelian</span>
                    <select
                      value={leadDetailsForm.purchaseType ?? ''}
                      onChange={(event) => updateLeadDetailsForm({ purchaseType: (event.target.value || null) as ContactSummary['leadDetails']['purchaseType'] })}
                      className="h-11 w-full rounded-[18px] border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    >
                      <option value="">Pilih jenis</option>
                      <option value="cash">Cash</option>
                      <option value="loan">Loan</option>
                    </select>
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="text-foreground/60">Trade-in</span>
                    <select
                      value={leadDetailsForm.tradeIn ?? ''}
                      onChange={(event) => updateLeadDetailsForm({ tradeIn: (event.target.value || null) as ContactSummary['leadDetails']['tradeIn'] })}
                      className="h-11 w-full rounded-[18px] border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    >
                      <option value="">Pilih status</option>
                      <option value="yes">Ya</option>
                      <option value="no">Tidak</option>
                    </select>
                  </label>

                  <label className="space-y-2 text-sm md:col-span-2">
                    <span className="text-foreground/60">Cawangan / Showroom</span>
                    <Input value={leadDetailsForm.showroomBranch ?? ''} onChange={(event) => updateLeadDetailsForm({ showroomBranch: event.target.value || null })} placeholder="Setapak, Shah Alam, Johor Bahru" />
                  </label>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {conversationDetail.messages.map((message) => (
                  <div key={message.id} className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
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

              <div className="mt-4 rounded-[24px] border bg-muted/45 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-foreground/45">Quick Reply Dealer</p>
                  <span className="text-xs text-foreground/55">Klik untuk auto-isi draft</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {quickReplies.map((reply) => (
                    <Button key={reply.id} variant="ghost" className="h-9" onClick={() => handleUseQuickReply(reply.text)}>
                      {reply.label}
                    </Button>
                  ))}
                </div>
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
        </article>
      </section>

      <section className="rounded-[28px] border bg-white/90 p-6 shadow-panel">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Contacts Snapshot</h2>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {contacts.slice(0, 6).map((contact) => (
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
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
