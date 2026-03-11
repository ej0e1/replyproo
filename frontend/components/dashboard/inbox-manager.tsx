'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import {
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  Filter,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Search,
  Send,
  Sparkles,
  User,
  Users,
  Wifi,
  X,
  Car,
  Bike,
  DollarSign,
  Building2,
  ArrowRightLeft,
  CreditCard,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clearAuthToken, fetchJson, getAuthToken } from '@/lib/auth';
import { cn } from '@/lib/utils';

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

type DealerQuickReplyTemplate = {
  id: string | null;
  name: string;
  isActive: boolean;
  replyText: string;
};

type DealerQuickRepliesResponse = {
  templates: DealerQuickReplyTemplate[];
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

function getLeadStageColor(stage: ContactSummary['leadStage']) {
  switch (stage) {
    case 'new_lead':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'follow_up':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'test_drive':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'booking':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'loan_submitted':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'won':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'lost':
      return 'bg-neutral-100 text-neutral-500 border-neutral-200';
    default:
      return 'bg-neutral-50 text-neutral-600 border-neutral-200';
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'open':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'pending':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'resolved':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'closed':
      return 'bg-neutral-100 text-neutral-500 border-neutral-200';
    default:
      return 'bg-neutral-50 text-neutral-600 border-neutral-200';
  }
}

function formatRelativeTime(dateString: string | null) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' });
}

function buildDealerQuickReplies(detail: ConversationDetail | null, templates: DealerQuickReplyTemplate[]) {
  const contactName = detail?.contact.name ?? 'tuan/puan';
  const vehicleTypeLabel = detail?.contact.leadDetails.vehicleType === 'motorcycle' ? 'motor' : 'kereta';
  const brand = detail?.contact.leadDetails.brand ?? 'pilihan anda';
  const model = detail?.contact.leadDetails.modelInterest ?? `${brand} ${vehicleTypeLabel}`.trim();
  const budget = detail?.contact.leadDetails.budgetMonthly ?? 'budget bulanan anda';
  const branch = detail?.contact.leadDetails.showroomBranch ?? 'showroom kami';

  const defaults = [
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

  const activeTemplates = templates.filter((template) => template.isActive && template.replyText.trim());
  if (!activeTemplates.length) {
    return defaults;
  }

  return activeTemplates.map((template) => ({
    id: template.id ?? template.name,
    label: template.name,
    text: template.replyText
      .replaceAll('{{contactName}}', contactName)
      .replaceAll('{{vehicleType}}', vehicleTypeLabel)
      .replaceAll('{{brand}}', brand)
      .replaceAll('{{model}}', model)
      .replaceAll('{{budget}}', budget)
      .replaceAll('{{branch}}', branch),
  }));
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

// Sub-components for cleaner code organization

function ConversationListItem({
  conversation,
  isActive,
  onClick,
}: {
  conversation: ConversationSummary;
  isActive: boolean;
  onClick: () => void;
}) {
  const lastMessage = conversation.messages[0];
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group w-full text-left transition-all duration-150',
        'px-4 py-3.5 border-b border-border/50',
        isActive
          ? 'bg-primary/5 border-l-2 border-l-primary'
          : 'hover:bg-muted/50 border-l-2 border-l-transparent'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium',
          isActive ? 'bg-primary text-white' : 'bg-muted text-foreground/70'
        )}>
          {conversation.contact.name?.[0]?.toUpperCase() ?? <User className="h-4 w-4" />}
        </div>
        
        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={cn(
              'truncate text-sm',
              conversation.unreadCount > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'
            )}>
              {conversation.contact.name ?? conversation.contact.phoneNumber}
            </p>
            <span className="shrink-0 text-[11px] text-foreground/50">
              {formatRelativeTime(conversation.lastMessageAt)}
            </span>
          </div>
          
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-foreground/60">
            <Phone className="h-3 w-3" />
            {conversation.contact.phoneNumber}
          </p>
          
          <p className={cn(
            'mt-1.5 line-clamp-1 text-sm',
            conversation.unreadCount > 0 ? 'text-foreground/80' : 'text-foreground/60'
          )}>
            {lastMessage?.content ?? 'No messages yet'}
          </p>
          
          <div className="mt-2 flex items-center gap-2">
            <span className={cn(
              'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide border',
              getLeadStageColor(conversation.contact.leadStage)
            )}>
              {formatLeadStage(conversation.contact.leadStage)}
            </span>
            <span className={cn(
              'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide border',
              getStatusColor(conversation.status)
            )}>
              {conversation.status}
            </span>
            {conversation.unreadCount > 0 && (
              <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">
                {conversation.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ message }: { message: ConversationDetail['messages'][number] }) {
  const isOutbound = message.direction === 'outbound';
  
  return (
    <div className={cn('flex', isOutbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-2.5',
          isOutbound
            ? 'bg-primary text-white rounded-br-md'
            : 'bg-white border border-border text-foreground rounded-bl-md shadow-sm'
        )}
      >
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
          {message.content ?? 'Media / system message'}
        </p>
        <div className={cn(
          'mt-1.5 flex items-center justify-end gap-1.5 text-[10px]',
          isOutbound ? 'text-white/70' : 'text-foreground/50'
        )}>
          <span>{new Date(getMessageTime(message)).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}</span>
          {isOutbound && (
            message.status === 'read' ? (
              <CheckCheck className="h-3 w-3" />
            ) : message.status === 'delivered' ? (
              <CheckCheck className="h-3 w-3 opacity-70" />
            ) : (
              <Check className="h-3 w-3 opacity-70" />
            )
          )}
        </div>
      </div>
    </div>
  );
}

function LeadDetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/70">
        <Icon className="h-4 w-4 text-foreground/60" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/50">{label}</p>
        <p className="mt-0.5 text-sm text-foreground/90">{value ?? '—'}</p>
      </div>
    </div>
  );
}

function KanbanColumn({
  stage,
  title,
  conversations,
  activeConversationId,
  onSelect,
}: {
  stage: ContactSummary['leadStage'];
  title: string;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border/70 bg-white/80">
      <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn(
            'h-2 w-2 rounded-full',
            stage === 'won' ? 'bg-green-500' :
            stage === 'lost' ? 'bg-neutral-400' :
            stage === 'new_lead' ? 'bg-blue-500' :
            stage === 'booking' ? 'bg-emerald-500' :
            'bg-amber-500'
          )} />
          <span className="text-xs font-semibold text-foreground/80">{title}</span>
        </div>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-semibold text-foreground/70">
          {conversations.length}
        </span>
      </div>
      
      <div className="flex-1 space-y-2 p-2 max-h-64 overflow-y-auto">
        {conversations.length > 0 ? (
          conversations.slice(0, 5).map((conv) => (
            <button
              key={conv.id}
              type="button"
              onClick={() => onSelect(conv.id)}
              className={cn(
                'w-full rounded-lg border p-2.5 text-left transition-all',
                conv.id === activeConversationId
                  ? 'border-primary/30 bg-primary/5 ring-1 ring-primary/20'
                  : 'border-border/50 bg-muted/30 hover:border-border hover:bg-muted/50'
              )}
            >
              <p className="text-xs font-medium text-foreground/90 truncate">
                {conv.contact.name ?? conv.contact.phoneNumber}
              </p>
              <p className="mt-1 text-[11px] text-foreground/50 truncate">
                {conv.contact.leadDetails.modelInterest ?? conv.channel.displayName}
              </p>
            </button>
          ))
        ) : (
          <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/30">
            <span className="text-[11px] text-foreground/40">No leads</span>
          </div>
        )}
        {conversations.length > 5 && (
          <p className="px-1 text-[10px] text-foreground/50">+{conversations.length - 5} more</p>
        )}
      </div>
    </div>
  );
}

export function InboxManager() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState('ReplyPro Workspace');
  const [tenantSlug, setTenantSlug] = useState('workspace');
  const [tenantPlan, setTenantPlan] = useState('starter');
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [quickReplyTemplates, setQuickReplyTemplates] = useState<DealerQuickReplyTemplate[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversationDetail, setConversationDetail] = useState<ConversationDetail | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | ContactSummary['leadStage']>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ConversationSummary['status']>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showKanban, setShowKanban] = useState(false);
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
      fetchJson<DealerQuickRepliesResponse>('/api/manage/automations/dealer-quick-replies', undefined, token),
    ])
      .then(([profileData, contactsData, conversationsData, quickRepliesData]) => {
        setProfile(profileData);
        const tenant = profileData.tenantMembers[0]?.tenant;
        setTenantId(tenant?.id ?? null);
        setTenantName(tenant?.name ?? 'ReplyPro Workspace');
        setTenantSlug(tenant?.slug ?? 'workspace');
        setTenantPlan(tenant?.planCode ?? 'starter');
        setContacts(contactsData);
        setConversations(conversationsData);
        setQuickReplyTemplates(quickRepliesData.templates);
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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationDetail?.messages]);

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

  const filteredConversations = useMemo(() => {
    return conversations.filter((conversation) => {
      const matchesStage = stageFilter === 'all' || conversation.contact.leadStage === stageFilter;
      const matchesStatus = statusFilter === 'all' || conversation.status === statusFilter;
      const matchesSearch = !searchQuery.trim() || 
        conversation.contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conversation.contact.phoneNumber.includes(searchQuery);
      return matchesStage && matchesStatus && matchesSearch;
    });
  }, [conversations, stageFilter, statusFilter, searchQuery]);

  const kanbanColumns = useMemo(
    () =>
      dealerLeadStages.map((stage) => ({
        stage,
        title: formatLeadStage(stage),
        conversations: filteredConversations.filter((conversation) => conversation.contact.leadStage === stage),
      })),
    [filteredConversations],
  );

  const quickReplies = useMemo(
    () => buildDealerQuickReplies(conversationDetail, quickReplyTemplates),
    [conversationDetail, quickReplyTemplates],
  );

  const activeFiltersCount = (stageFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

  useEffect(() => {
    if (!filteredConversations.length) {
      return;
    }

    if (!activeConversationId || !filteredConversations.some((conversation) => conversation.id === activeConversationId)) {
      setActiveConversationId(filteredConversations[0]?.id ?? null);
    }
  }, [activeConversationId, filteredConversations]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-120px)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-foreground/60">Loading inbox...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col gap-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-white px-3 py-1.5">
            <div className={cn(
              'h-2 w-2 rounded-full',
              socketConnected ? 'bg-green-500' : 'bg-amber-500 animate-pulse'
            )} />
            <span className="text-xs font-medium text-foreground/70">
              {socketConnected ? 'Live' : 'Connecting'}
            </span>
          </div>
          <div className="hidden items-center gap-4 text-sm text-foreground/60 sm:flex">
            <span><strong className="font-semibold text-foreground">{conversations.length}</strong> conversations</span>
            <span><strong className="font-semibold text-foreground">{contacts.length}</strong> contacts</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={showKanban ? 'secondary' : 'ghost'}
            className="h-8 gap-1.5 text-xs"
            onClick={() => setShowKanban(!showKanban)}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
            Pipeline
          </Button>
        </div>
      </div>

      {/* Kanban Board (collapsible) */}
      {showKanban && (
        <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground/80">Lead Pipeline</h3>
            <span className="text-xs text-foreground/50">{filteredConversations.length} active leads</span>
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
            {kanbanColumns.map((column) => (
              <KanbanColumn
                key={column.stage}
                stage={column.stage}
                title={column.title}
                conversations={column.conversations}
                activeConversationId={activeConversationId}
                onSelect={setActiveConversationId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
          <X className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-700">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main 3-Panel Layout */}
      <div className="flex flex-1 gap-4 overflow-hidden rounded-xl border border-border/70 bg-white shadow-sm">
        {/* Left Panel - Conversation List */}
        <div className="flex w-80 shrink-0 flex-col border-r border-border/50 lg:w-96">
          {/* Search & Filters */}
          <div className="border-b border-border/50 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="h-9 w-full rounded-lg border border-border/70 bg-muted/30 pl-9 pr-3 text-sm outline-none placeholder:text-foreground/40 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
                  showFilters || activeFiltersCount > 0
                    ? 'border-primary/30 bg-primary/5 text-primary'
                    : 'border-border/70 text-foreground/60 hover:bg-muted/50'
                )}
              >
                <Filter className="h-3 w-3" />
                Filters
                {activeFiltersCount > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
              {activeFiltersCount > 0 && (
                <button
                  onClick={() => { setStageFilter('all'); setStatusFilter('all'); }}
                  className="text-xs text-foreground/50 hover:text-foreground/70"
                >
                  Clear all
                </button>
              )}
            </div>
            
            {/* Filter Dropdowns */}
            {showFilters && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium uppercase tracking-wide text-foreground/50">Stage</label>
                  <select
                    value={stageFilter}
                    onChange={(e) => setStageFilter(e.target.value as typeof stageFilter)}
                    className="mt-1 h-8 w-full rounded-lg border border-border/70 bg-white px-2 text-xs outline-none focus:border-primary/50"
                  >
                    <option value="all">All Stages</option>
                    {dealerLeadStages.map((stage) => (
                      <option key={stage} value={stage}>{formatLeadStage(stage)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium uppercase tracking-wide text-foreground/50">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                    className="mt-1 h-8 w-full rounded-lg border border-border/70 bg-white px-2 text-xs outline-none focus:border-primary/50"
                  >
                    <option value="all">All Status</option>
                    {conversationStatuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
          
          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length > 0 ? (
              filteredConversations.map((conversation) => (
                <ConversationListItem
                  key={conversation.id}
                  conversation={conversation}
                  isActive={conversation.id === activeConversationId}
                  onClick={() => setActiveConversationId(conversation.id)}
                />
              ))
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                  <MessageSquare className="h-5 w-5 text-foreground/40" />
                </div>
                <p className="mt-3 text-sm font-medium text-foreground/70">No conversations</p>
                <p className="mt-1 text-xs text-foreground/50">
                  {searchQuery || activeFiltersCount > 0 ? 'Try adjusting your filters' : 'Conversations will appear here'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Center Panel - Message Thread */}
        <div className="flex flex-1 flex-col">
          {conversationDetail ? (
            <>
              {/* Thread Header */}
              <div className="flex items-center justify-between gap-4 border-b border-border/50 px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-medium text-white">
                    {conversationDetail.contact.name?.[0]?.toUpperCase() ?? <User className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-foreground">
                        {conversationDetail.contact.name ?? conversationDetail.contact.phoneNumber}
                      </h2>
                      {conversationDetail.aiEnabled && (
                        <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
                          <Sparkles className="h-3 w-3" />
                          AI
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-foreground/60">{conversationDetail.contact.phoneNumber}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Status Dropdown */}
                  <div className="relative">
                    <select
                      value={conversationDetail.status}
                      onChange={(e) => handleUpdateStatus(e.target.value as 'open' | 'pending' | 'resolved' | 'closed')}
                      disabled={isUpdatingAssignmentOrStatus}
                      className={cn(
                        'h-7 appearance-none rounded-lg border pl-2.5 pr-7 text-xs font-medium outline-none',
                        getStatusColor(conversationDetail.status)
                      )}
                    >
                      {conversationStatuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2" />
                  </div>
                  
                  {/* Assignment Button */}
                  <Button
                    variant="ghost"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => handleUpdateAssignee(conversationDetail.assignedToUser?.id === profile?.id ? 'unassign' : 'assign_to_me')}
                    disabled={isUpdatingAssignmentOrStatus}
                  >
                    <User className="h-3 w-3" />
                    {conversationDetail.assignedToUser?.id === profile?.id ? 'Unassign' : 'Assign to me'}
                  </Button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto bg-muted/20 px-5 py-4">
                <div className="space-y-3">
                  {conversationDetail.messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Quick Replies */}
              <div className="border-t border-border/50 bg-muted/30 px-4 py-2.5">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-foreground/50">Quick:</span>
                  {quickReplies.slice(0, 5).map((reply) => (
                    <button
                      key={reply.id}
                      onClick={() => handleUseQuickReply(reply.text)}
                      className="shrink-0 rounded-full border border-border/70 bg-white px-2.5 py-1 text-xs font-medium text-foreground/70 transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                    >
                      {reply.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compose Box */}
              <div className="border-t border-border/50 p-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={draftMessage}
                    onChange={(e) => setDraftMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    placeholder="Type your message..."
                    className="flex-1 rounded-xl border border-border/70 bg-white px-4 py-2.5 text-sm outline-none placeholder:text-foreground/40 focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={isSending || !draftMessage.trim()}
                    className="h-10 gap-2 rounded-xl px-5"
                  >
                    {isSending ? 'Sending...' : 'Send'}
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                <MessageSquare className="h-7 w-7 text-foreground/30" />
              </div>
              <h3 className="mt-4 font-semibold text-foreground/70">No conversation selected</h3>
              <p className="mt-1 text-sm text-foreground/50">Choose a conversation from the list to view messages</p>
            </div>
          )}
        </div>

        {/* Right Panel - Lead Details */}
        {conversationDetail && (
          <div className="hidden w-80 shrink-0 flex-col border-l border-border/50 xl:flex">
            {/* Lead Summary Header */}
            <div className="border-b border-border/50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground/80">Lead Details</h3>
                <Button
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={handleSaveLeadDetails}
                  disabled={isSavingLeadDetails}
                >
                  {isSavingLeadDetails ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Lead Stage */}
              <div className="mb-4">
                <label className="text-[10px] font-medium uppercase tracking-wide text-foreground/50">Lead Stage</label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {dealerLeadStages.map((stage) => (
                    <button
                      key={stage}
                      onClick={() => handleUpdateLeadStage(stage)}
                      disabled={isUpdatingLeadStage}
                      className={cn(
                        'rounded-md border px-2 py-1 text-[10px] font-medium uppercase tracking-wide transition',
                        conversationDetail.contact.leadStage === stage
                          ? getLeadStageColor(stage)
                          : 'border-border/70 bg-white text-foreground/50 hover:bg-muted/50'
                      )}
                    >
                      {formatLeadStage(stage)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact Tags */}
              {conversationDetail.contact.tags.length > 0 && (
                <div className="mb-4">
                  <label className="text-[10px] font-medium uppercase tracking-wide text-foreground/50">Tags</label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {conversationDetail.contact.tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-2 py-1 text-[11px] font-medium text-foreground/70">
                        <Tag className="h-3 w-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Lead Details Form */}
              <div className="space-y-1">
                <LeadDetailRow
                  icon={conversationDetail.contact.leadDetails.vehicleType === 'motorcycle' ? Bike : Car}
                  label="Vehicle Type"
                  value={leadDetailsForm.vehicleType === 'car' ? 'Car' : leadDetailsForm.vehicleType === 'motorcycle' ? 'Motorcycle' : null}
                />
                <LeadDetailRow icon={Tag} label="Brand" value={leadDetailsForm.brand} />
                <LeadDetailRow icon={Car} label="Model Interest" value={leadDetailsForm.modelInterest} />
                <LeadDetailRow icon={DollarSign} label="Budget Monthly" value={leadDetailsForm.budgetMonthly} />
                <LeadDetailRow icon={CreditCard} label="Purchase Type" value={leadDetailsForm.purchaseType} />
                <LeadDetailRow icon={ArrowRightLeft} label="Trade-in" value={leadDetailsForm.tradeIn === 'yes' ? 'Yes' : leadDetailsForm.tradeIn === 'no' ? 'No' : null} />
                <LeadDetailRow icon={Building2} label="Showroom Branch" value={leadDetailsForm.showroomBranch} />
              </div>

              {/* Edit Lead Details */}
              <div className="mt-4 space-y-3 rounded-lg border border-border/50 bg-muted/30 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-foreground/50">Edit Details</p>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-foreground/50">Vehicle</label>
                    <select
                      value={leadDetailsForm.vehicleType ?? ''}
                      onChange={(e) => updateLeadDetailsForm({ vehicleType: (e.target.value || null) as ContactSummary['leadDetails']['vehicleType'] })}
                      className="mt-1 h-8 w-full rounded-md border border-border/70 bg-white px-2 text-xs outline-none focus:border-primary/50"
                    >
                      <option value="">Select</option>
                      <option value="car">Car</option>
                      <option value="motorcycle">Motorcycle</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-foreground/50">Purchase</label>
                    <select
                      value={leadDetailsForm.purchaseType ?? ''}
                      onChange={(e) => updateLeadDetailsForm({ purchaseType: (e.target.value || null) as ContactSummary['leadDetails']['purchaseType'] })}
                      className="mt-1 h-8 w-full rounded-md border border-border/70 bg-white px-2 text-xs outline-none focus:border-primary/50"
                    >
                      <option value="">Select</option>
                      <option value="cash">Cash</option>
                      <option value="loan">Loan</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-foreground/50">Brand</label>
                  <input
                    type="text"
                    value={leadDetailsForm.brand ?? ''}
                    onChange={(e) => updateLeadDetailsForm({ brand: e.target.value || null })}
                    placeholder="e.g. Honda, Toyota"
                    className="mt-1 h-8 w-full rounded-md border border-border/70 bg-white px-2 text-xs outline-none placeholder:text-foreground/30 focus:border-primary/50"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-foreground/50">Model Interest</label>
                  <input
                    type="text"
                    value={leadDetailsForm.modelInterest ?? ''}
                    onChange={(e) => updateLeadDetailsForm({ modelInterest: e.target.value || null })}
                    placeholder="e.g. City Hatchback"
                    className="mt-1 h-8 w-full rounded-md border border-border/70 bg-white px-2 text-xs outline-none placeholder:text-foreground/30 focus:border-primary/50"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-foreground/50">Monthly Budget</label>
                  <input
                    type="text"
                    value={leadDetailsForm.budgetMonthly ?? ''}
                    onChange={(e) => updateLeadDetailsForm({ budgetMonthly: e.target.value || null })}
                    placeholder="e.g. RM850"
                    className="mt-1 h-8 w-full rounded-md border border-border/70 bg-white px-2 text-xs outline-none placeholder:text-foreground/30 focus:border-primary/50"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-foreground/50">Trade-in</label>
                  <select
                    value={leadDetailsForm.tradeIn ?? ''}
                    onChange={(e) => updateLeadDetailsForm({ tradeIn: (e.target.value || null) as ContactSummary['leadDetails']['tradeIn'] })}
                    className="mt-1 h-8 w-full rounded-md border border-border/70 bg-white px-2 text-xs outline-none focus:border-primary/50"
                  >
                    <option value="">Select</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-foreground/50">Showroom Branch</label>
                  <input
                    type="text"
                    value={leadDetailsForm.showroomBranch ?? ''}
                    onChange={(e) => updateLeadDetailsForm({ showroomBranch: e.target.value || null })}
                    placeholder="e.g. Shah Alam"
                    className="mt-1 h-8 w-full rounded-md border border-border/70 bg-white px-2 text-xs outline-none placeholder:text-foreground/30 focus:border-primary/50"
                  />
                </div>
              </div>

              {/* Assignee Info */}
              <div className="mt-4 rounded-lg border border-border/50 bg-muted/30 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-foreground/50">Assignment</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                    <User className="h-3.5 w-3.5 text-foreground/60" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground/80">
                      {conversationDetail.assignedToUser?.fullName ?? 'Unassigned'}
                    </p>
                    {conversationDetail.assignedToUser && (
                      <p className="text-[10px] text-foreground/50">{conversationDetail.assignedToUser.email}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Channel Info */}
              <div className="mt-4 rounded-lg border border-border/50 bg-muted/30 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-foreground/50">Channel</p>
                <div className="mt-2">
                  <p className="text-xs font-medium text-foreground/80">{conversationDetail.channel.displayName}</p>
                  {conversationDetail.channel.phoneNumber && (
                    <p className="mt-0.5 text-[10px] text-foreground/50">{conversationDetail.channel.phoneNumber}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
