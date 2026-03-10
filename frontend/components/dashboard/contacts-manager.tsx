'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, CarFront, Clock3, CreditCard, Phone, Tags, UserCheck, Users, Wallet, Wifi } from 'lucide-react';
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

export function ContactsManager() {
  const router = useRouter();
  const [tenantName, setTenantName] = useState('ReplyPro Workspace');
  const [tenantSlug, setTenantSlug] = useState('workspace');
  const [tenantPlan, setTenantPlan] = useState('starter');
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
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
    ])
      .then(([profileData, contactsData]) => {
        const tenant = profileData.tenantMembers[0]?.tenant;
        setTenantName(tenant?.name ?? 'ReplyPro Workspace');
        setTenantSlug(tenant?.slug ?? 'workspace');
        setTenantPlan(tenant?.planCode ?? 'starter');
        setContacts(contactsData);
        setError(null);
      })
      .catch((fetchError) => {
        clearAuthToken();
        setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuatkan contacts');
        router.replace('/login');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  const stats = useMemo(
    () => [
      { label: 'Total Contacts', value: String(contacts.length).padStart(2, '0'), icon: Users },
      { label: 'Opt-in', value: String(contacts.filter((contact) => contact.optIn).length).padStart(2, '0'), icon: UserCheck },
      {
        label: 'Dealer Leads',
        value: String(contacts.filter((contact) => contact.leadStage !== 'new_lead' || contact.leadDetails.modelInterest).length).padStart(2, '0'),
        icon: Tags,
      },
    ],
    [contacts],
  );

  if (loading) {
    return <div className="rounded-[28px] border bg-white/90 px-6 py-10 text-sm text-foreground/65 shadow-panel">Memuatkan contacts workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border bg-white/90 p-6 shadow-panel md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-foreground/45">Contacts Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold">Customer Contacts</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-foreground/65">
              Page ini memusatkan contact list, opt-in status, tag, dan last seen dalam shell baru supaya lebih mudah urus sebelum kita tambah filtering dan contact actions.
            </p>
          </div>

          <div className="rounded-[24px] border bg-muted/45 px-4 py-4 text-sm text-foreground/65 lg:w-[320px]">
            <p className="font-medium text-foreground">{tenantName}</p>
            <p className="mt-1">Slug: {tenantSlug}</p>
            <p className="mt-1">Plan: {tenantPlan}</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/72">
              <Wifi className="h-3.5 w-3.5" />
              Contacts synced
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {contacts.map((contact) => (
          <article key={contact.id} className="rounded-[28px] border bg-white/90 p-5 shadow-panel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">{contact.name ?? contact.phoneNumber}</p>
                <div className="mt-2 flex items-center gap-2 text-sm text-foreground/60">
                  <Phone className="h-4 w-4" />
                  <span>{contact.phoneNumber}</span>
                </div>
                {contact.email ? <p className="mt-1 text-sm text-foreground/55">{contact.email}</p> : null}
              </div>

              <div className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${contact.optIn ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {contact.optIn ? 'opt-in' : 'blocked'}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/75">
                {formatLeadStage(contact.leadStage)}
              </span>
              {contact.leadDetails.vehicleType ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2.5 py-1 text-xs font-medium text-foreground/70">
                  {contact.leadDetails.vehicleType === 'car' ? <CarFront className="h-3 w-3" /> : <Bike className="h-3 w-3" />}
                  {contact.leadDetails.vehicleType === 'car' ? 'Kereta' : 'Motor'}
                </span>
              ) : null}
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-foreground/45">
              <Clock3 className="h-3.5 w-3.5" />
              {contact.lastSeenAt ? `Last seen ${new Date(contact.lastSeenAt).toLocaleString('ms-MY')}` : 'Belum ada aktiviti'}
            </div>

            <div className="mt-4 grid gap-2 rounded-2xl border bg-muted/45 px-3 py-3 text-xs text-foreground/68">
              <div className="flex items-center justify-between gap-3">
                <span>Brand / Model</span>
                <span className="text-right font-medium text-foreground/82">
                  {[contact.leadDetails.brand, contact.leadDetails.modelInterest].filter(Boolean).join(' - ') || 'Belum diisi'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1"><Wallet className="h-3 w-3" /> Budget</span>
                <span className="text-right font-medium text-foreground/82">{contact.leadDetails.budgetMonthly ?? 'Belum diisi'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1"><CreditCard className="h-3 w-3" /> Purchase</span>
                <span className="text-right font-medium text-foreground/82">
                  {contact.leadDetails.purchaseType ? `${contact.leadDetails.purchaseType}${contact.leadDetails.tradeIn ? ` / trade-in ${contact.leadDetails.tradeIn}` : ''}` : 'Belum diisi'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Showroom</span>
                <span className="text-right font-medium text-foreground/82">{contact.leadDetails.showroomBranch ?? 'Belum diisi'}</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {contact.tags.length ? (
                contact.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground/75">
                    {tag}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-muted/70 px-2.5 py-1 text-xs font-medium text-foreground/55">Tiada tag</span>
              )}
            </div>
          </article>
        ))}

        {!contacts.length ? (
          <div className="rounded-[28px] border bg-white/90 px-6 py-10 text-sm text-foreground/60 shadow-panel">
            Belum ada contacts untuk tenant ini.
          </div>
        ) : null}
      </section>
    </div>
  );
}
