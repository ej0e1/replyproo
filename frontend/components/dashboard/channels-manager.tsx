'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import { CheckCircle2, QrCode, Radio, RefreshCw, Smartphone, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearAuthToken, fetchJson, getAuthToken } from '@/lib/auth';

type MeResponse = {
  tenantMembers: Array<{
    tenant: {
      id: string;
      name: string;
      slug: string;
    };
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

type ChannelProfileForm = {
  displayName: string;
  phoneNumber: string;
  showroomBranch: string;
  salesOwner: string;
};

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

function toProfileForm(channel: ChannelSummary): ChannelProfileForm {
  const metadataProfile =
    channel.metadata?.profile && typeof channel.metadata.profile === 'object' && !Array.isArray(channel.metadata.profile)
      ? (channel.metadata.profile as Record<string, unknown>)
      : null;

  return {
    displayName: channel.displayName,
    phoneNumber: channel.phoneNumber ?? '',
    showroomBranch: typeof metadataProfile?.showroomBranch === 'string' ? metadataProfile.showroomBranch : '',
    salesOwner: typeof metadataProfile?.salesOwner === 'string' ? metadataProfile.salesOwner : '',
  };
}

export function ChannelsManager() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState('ReplyPro Workspace');
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingQrByChannel, setLoadingQrByChannel] = useState<Record<string, boolean>>({});
  const [qrCooldownByChannel, setQrCooldownByChannel] = useState<Record<string, boolean>>({});
  const [refreshingByChannel, setRefreshingByChannel] = useState<Record<string, boolean>>({});
  const [socketConnected, setSocketConnected] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<ChannelProfileForm | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  async function loadChannels(token: string) {
    const channelsData = await fetchJson<ChannelSummary[]>('/api/manage/channels', undefined, token);
    setChannels(channelsData);
  }

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    Promise.all([
      fetchJson<MeResponse>('/api/auth/me', undefined, token),
      fetchJson<ChannelSummary[]>('/api/manage/channels', undefined, token),
    ])
      .then(([profile, channelsData]) => {
        const tenant = profile.tenantMembers[0]?.tenant;
        setTenantId(tenant?.id ?? null);
        setTenantName(tenant?.name ?? 'ReplyPro Workspace');
        setChannels(channelsData);
        setError(null);
      })
      .catch((fetchError) => {
        clearAuthToken();
        setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuatkan channels');
        router.replace('/login');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

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
      loadChannels(token).catch(() => null);
    };

    socketClient.on('connect', () => {
      setSocketConnected(true);
      socketClient.emit('tenant:subscribe', { tenantId });
    });

    socketClient.on('disconnect', () => {
      setSocketConnected(false);
    });

    socketClient.on('channel.updated', refresh);

    return () => {
      socketClient.disconnect();
    };
  }, [tenantId]);

  async function handleConnectChannel(channelId: string) {
    const token = getAuthToken();
    if (!token || loadingQrByChannel[channelId] || qrCooldownByChannel[channelId]) {
      return;
    }

    try {
      setLoadingQrByChannel((current) => ({ ...current, [channelId]: true }));
      setError(null);
      await fetchJson(`/api/manage/channels/${channelId}/connect`, { method: 'POST' }, token);
      await loadChannels(token);
      setQrCooldownByChannel((current) => ({ ...current, [channelId]: true }));
      window.setTimeout(() => {
        setQrCooldownByChannel((current) => ({ ...current, [channelId]: false }));
      }, 15000);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Gagal ambil QR');
    } finally {
      setLoadingQrByChannel((current) => ({ ...current, [channelId]: false }));
    }
  }

  async function handleRefreshChannel(channelId: string) {
    const token = getAuthToken();
    if (!token || refreshingByChannel[channelId]) {
      return;
    }

    try {
      setRefreshingByChannel((current) => ({ ...current, [channelId]: true }));
      setError(null);
      await fetchJson(`/api/manage/channels/${channelId}/refresh`, { method: 'POST' }, token);
      await loadChannels(token);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Gagal refresh channel');
    } finally {
      setRefreshingByChannel((current) => ({ ...current, [channelId]: false }));
    }
  }

  function openProfileModal(channel: ChannelSummary) {
    setEditingChannelId(channel.id);
    setProfileForm(toProfileForm(channel));
    setError(null);
  }

  function closeProfileModal(force = false) {
    if (savingProfile && !force) {
      return;
    }

    setEditingChannelId(null);
    setProfileForm(null);
  }

  async function handleSaveProfile() {
    const token = getAuthToken();
    if (!token || !editingChannelId || !profileForm || savingProfile) {
      return;
    }

    if (!profileForm.displayName.trim()) {
      setError('Nama channel wajib diisi sebelum simpan profil.');
      return;
    }

    try {
      setSavingProfile(true);
      setError(null);
      await fetchJson(`/api/manage/channels/${editingChannelId}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: profileForm.displayName.trim(),
          phoneNumber: profileForm.phoneNumber.trim() || null,
          showroomBranch: profileForm.showroomBranch.trim() || null,
          salesOwner: profileForm.salesOwner.trim() || null,
        }),
      }, token);
      await loadChannels(token);
      closeProfileModal(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal simpan profil channel');
    } finally {
      setSavingProfile(false);
    }
  }

  const stats = useMemo(
    () => [
      { label: 'Total Numbers', value: String(channels.length).padStart(2, '0'), icon: Smartphone },
      {
        label: 'Connected',
        value: String(channels.filter((channel) => channel.status === 'connected').length).padStart(2, '0'),
        icon: CheckCircle2,
      },
      {
        label: 'QR Pending',
        value: String(channels.filter((channel) => channel.status === 'qr_pending').length).padStart(2, '0'),
        icon: QrCode,
      },
    ],
    [channels],
  );

  const editingChannel = editingChannelId ? channels.find((channel) => channel.id === editingChannelId) ?? null : null;

  useEffect(() => {
    const target = channels.find((channel) => {
      if (channel.status !== 'connected') {
        return false;
      }

      const completedAt = channel.metadata?.profileCompletedAt;
      return !(typeof completedAt === 'string' && completedAt.trim());
    });

    if (!target || editingChannelId) {
      return;
    }

    setEditingChannelId(target.id);
    setProfileForm(toProfileForm(target));
    setError(null);
  }, [channels, editingChannelId]);

  if (loading) {
    return <div className="rounded-[28px] border bg-white/90 px-6 py-10 text-sm text-foreground/65 shadow-panel">Memuatkan channels workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border bg-white/90 p-6 shadow-panel md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-foreground/45">Channels Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold">WhatsApp Numbers & QR</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-foreground/65">
              Urus connect, QR retrieval, refresh status, dan health nombor WhatsApp tanpa perlu kembali ke legacy dashboard.
            </p>
          </div>

          <div className="rounded-[24px] border bg-muted/45 px-4 py-4 text-sm text-foreground/65 lg:w-[300px]">
            <p className="font-medium text-foreground">{tenantName}</p>
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

      <section className="space-y-4">
        {channels.map((channel) => {
          const qrImage = normalizeQrCode(channel.qrCode);
          const qrError = extractQrError(channel);
          const isQrLoading = Boolean(loadingQrByChannel[channel.id]);
          const isQrCoolingDown = Boolean(qrCooldownByChannel[channel.id]);
          const isRefreshing = Boolean(refreshingByChannel[channel.id]);
          const disableQrRequest = channel.status === 'connected' || isQrLoading || isQrCoolingDown;

          return (
            <article key={channel.id} className="rounded-[28px] border bg-white/90 p-6 shadow-panel">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xl font-semibold">{channel.displayName}</p>
                  <p className="mt-1 text-sm text-foreground/60">{channel.phoneNumber ?? channel.evolutionInstanceName}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-foreground/45">
                    {channel.lastConnectedAt ? `Last connected ${new Date(channel.lastConnectedAt).toLocaleString('ms-MY')}` : 'Belum pernah connected'}
                  </p>
                </div>

                <div
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${channel.status === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
                >
                  {channel.status === 'connected' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Radio className="h-3.5 w-3.5" />}
                  {channel.status}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="secondary" className="h-10" onClick={() => handleConnectChannel(channel.id)} disabled={disableQrRequest}>
                  {channel.status === 'connected'
                    ? 'Sudah Connect'
                    : isQrLoading
                      ? 'Meminta QR...'
                      : isQrCoolingDown
                        ? 'Tunggu Sebentar'
                        : 'Ambil QR'}
                </Button>
                <Button variant="ghost" className="h-10 gap-2" onClick={() => handleRefreshChannel(channel.id)} disabled={isRefreshing}>
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Refresh...' : 'Refresh Status'}
                </Button>
                <Button variant="ghost" className="h-10" onClick={() => openProfileModal(channel)}>
                  Edit Profil
                </Button>
              </div>

              {qrImage ? (
                <div className="mt-5 rounded-[28px] border bg-muted/35 p-4">
                  <img src={qrImage} alt={`QR ${channel.displayName}`} className="mx-auto h-auto w-full max-w-[320px] rounded-2xl bg-white p-4" />
                </div>
              ) : (
                <div className="mt-5 rounded-[24px] border bg-muted/35 px-4 py-4 text-sm text-foreground/60">
                  {qrError ?? (channel.status === 'connected' ? 'Channel sudah tersambung dan tidak memerlukan QR baharu.' : 'QR belum tersedia untuk channel ini. Tekan Ambil QR dan scan secepat mungkin.')}
                </div>
              )}
            </article>
          );
        })}

        {!channels.length ? (
          <div className="rounded-[28px] border bg-white/90 px-6 py-10 text-sm text-foreground/60 shadow-panel">
            Belum ada channel untuk tenant ini.
          </div>
        ) : null}
      </section>

      {editingChannel && profileForm ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#08120f]/50 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[30px] border bg-white p-6 shadow-panel md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-foreground/45">Post-QR Setup</p>
                <h2 className="mt-2 text-2xl font-semibold">Kemaskini Profil Channel</h2>
                <p className="mt-2 text-sm text-foreground/65">Lengkapkan nama nombor, branch showroom, dan PIC supaya handoff inbox kepada sales team lebih jelas.</p>
              </div>
              <div className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/75">
                {editingChannel.status}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="text-foreground/70">Nama Channel</span>
                <input
                  value={profileForm.displayName}
                  onChange={(event) => setProfileForm((current) => (current ? { ...current, displayName: event.target.value } : current))}
                  className="h-11 w-full rounded-2xl border bg-white px-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  placeholder="WA Showroom Utama"
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="text-foreground/70">Nombor WhatsApp</span>
                <input
                  value={profileForm.phoneNumber}
                  onChange={(event) => setProfileForm((current) => (current ? { ...current, phoneNumber: event.target.value } : current))}
                  className="h-11 w-full rounded-2xl border bg-white px-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  placeholder="60123456789"
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="text-foreground/70">Branch Showroom</span>
                <input
                  value={profileForm.showroomBranch}
                  onChange={(event) => setProfileForm((current) => (current ? { ...current, showroomBranch: event.target.value } : current))}
                  className="h-11 w-full rounded-2xl border bg-white px-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  placeholder="Setia Alam"
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="text-foreground/70">PIC Sales</span>
                <input
                  value={profileForm.salesOwner}
                  onChange={(event) => setProfileForm((current) => (current ? { ...current, salesOwner: event.target.value } : current))}
                  className="h-11 w-full rounded-2xl border bg-white px-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  placeholder="Ain / Hakim"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => closeProfileModal()} disabled={savingProfile}>
                Tutup
              </Button>
              <Button onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? 'Menyimpan...' : 'Simpan Profil'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
