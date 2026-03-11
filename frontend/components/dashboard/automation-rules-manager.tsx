'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clearAuthToken, fetchJson, getAuthToken } from '@/lib/auth';

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

type DealerQuickReply = {
  id: string | null;
  name: string;
  isActive: boolean;
  replyText: string;
};

type DealerQuickRepliesResponse = {
  templates: DealerQuickReply[];
};

type KeywordRuleForm = {
  id: string | null;
  name: string;
  isActive: boolean;
  keywordsText: string;
  replyText: string;
};

type DealerQuickReplyForm = {
  id: string | null;
  name: string;
  isActive: boolean;
  replyText: string;
};

function toRuleForms(rules: KeywordRule[]) {
  return rules.map((rule) => ({
    id: rule.id,
    name: rule.name,
    isActive: rule.isActive,
    keywordsText: rule.keywords.join(', '),
    replyText: rule.replyText,
  }));
}

function toQuickReplyForms(templates: DealerQuickReply[]) {
  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    isActive: template.isActive,
    replyText: template.replyText,
  }));
}

export function AutomationRulesManager() {
  const router = useRouter();
  const [rules, setRules] = useState<KeywordRuleForm[]>([]);
  const [quickReplies, setQuickReplies] = useState<DealerQuickReplyForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    Promise.all([
      fetchJson<KeywordRulesResponse>('/api/manage/automations/keyword-rules', undefined, token),
      fetchJson<DealerQuickRepliesResponse>('/api/manage/automations/dealer-quick-replies', undefined, token),
    ])
      .then(([rulesData, quickRepliesData]) => {
        setRules(toRuleForms(rulesData.rules));
        setQuickReplies(toQuickReplyForms(quickRepliesData.templates));
        setError(null);
      })
      .catch((fetchError) => {
        clearAuthToken();
        setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuatkan automation rules');
        router.replace('/login');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  const validationError = useMemo(() => {
    const invalidIndex = rules.findIndex((rule) => {
      const hasKeywords = rule.keywordsText
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean).length;
      return !rule.name.trim() || !hasKeywords || !rule.replyText.trim();
    });

    if (invalidIndex !== -1) {
      return `Rule ${invalidIndex + 1} perlukan nama, sekurang-kurangnya satu keyword, dan reply text.`;
    }

    const invalidTemplateIndex = quickReplies.findIndex((template) => !template.name.trim() || !template.replyText.trim());
    if (invalidTemplateIndex !== -1) {
      return `Quick reply ${invalidTemplateIndex + 1} perlukan nama dan reply text.`;
    }

    return null;
  }, [quickReplies, rules]);

  function handleAddRule() {
    setRules((current) => [
      ...current,
      {
        id: null,
        name: `Keyword Auto Reply ${current.length + 1}`,
        isActive: true,
        keywordsText: '',
        replyText: '',
      },
    ]);
    setSuccess(null);
  }

  function handleAddQuickReply() {
    setQuickReplies((current) => [
      ...current,
      {
        id: null,
        name: `Dealer Reply ${current.length + 1}`,
        isActive: true,
        replyText: '',
      },
    ]);
    setSuccess(null);
  }

  function handleRemoveRule(index: number) {
    const target = rules[index];
    if (target && !window.confirm(`Buang rule "${target.name || `Rule ${index + 1}`}"?`)) {
      return;
    }

    setRules((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setSuccess(null);
  }

  function handleRemoveQuickReply(index: number) {
    const target = quickReplies[index];
    if (target && !window.confirm(`Buang quick reply "${target.name || `Template ${index + 1}`}"?`)) {
      return;
    }

    setQuickReplies((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setSuccess(null);
  }

  function updateRule(index: number, patch: Partial<KeywordRuleForm>) {
    setRules((current) => current.map((rule, currentIndex) => (currentIndex === index ? { ...rule, ...patch } : rule)));
    setSuccess(null);
  }

  function updateQuickReply(index: number, patch: Partial<DealerQuickReplyForm>) {
    setQuickReplies((current) => current.map((item, currentIndex) => (currentIndex === index ? { ...item, ...patch } : item)));
    setSuccess(null);
  }

  async function handleSaveRules() {
    const token = getAuthToken();
    if (!token || validationError) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = await fetchJson<KeywordRulesResponse>(
        '/api/manage/automations/keyword-rules',
        {
          method: 'PUT',
          body: JSON.stringify({
            rules: rules.map((rule) => ({
              id: rule.id,
              name: rule.name.trim(),
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

      const quickReplyPayload = await fetchJson<DealerQuickRepliesResponse>(
        '/api/manage/automations/dealer-quick-replies',
        {
          method: 'PUT',
          body: JSON.stringify({
            templates: quickReplies.map((template) => ({
              id: template.id,
              name: template.name.trim(),
              isActive: template.isActive,
              replyText: template.replyText.trim(),
            })),
          }),
        },
        token,
      );

      setRules(toRuleForms(payload.rules));
      setQuickReplies(toQuickReplyForms(quickReplyPayload.templates));
      setSuccess('Automation rules berjaya disimpan.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal simpan automation rules');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-[28px] border bg-white/90 px-6 py-10 text-sm text-foreground/65 shadow-panel">Memuatkan automation rules...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-foreground/45">Automations</p>
          <h1 className="mt-3 text-3xl font-semibold">Keyword Rules</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/65">
            Gunakan shell baru ala v0 untuk urus beberapa auto-reply rule. Rule pertama yang padan akan hantar balasan automatik.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" className="gap-2" onClick={handleAddRule}>
            <Plus className="h-4 w-4" />
            Tambah Rule
          </Button>
          <Button className="gap-2" onClick={handleSaveRules} disabled={saving || Boolean(validationError)}>
            <Save className="h-4 w-4" />
            {saving ? 'Menyimpan...' : 'Simpan Semua'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border bg-white/90 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">Total Rules</p>
          <p className="mt-4 text-3xl font-semibold">{String(rules.length).padStart(2, '0')}</p>
        </div>
        <div className="rounded-[24px] border bg-white/90 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">Active Rules</p>
          <p className="mt-4 text-3xl font-semibold">{String(rules.filter((rule) => rule.isActive).length).padStart(2, '0')}</p>
        </div>
        <div className="rounded-[24px] border bg-white/90 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">Dealer Replies</p>
          <p className="mt-4 text-3xl font-semibold">{String(quickReplies.filter((reply) => reply.isActive).length).padStart(2, '0')}</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/75">
            <Sparkles className="h-3.5 w-3.5" />
            localhost mode
          </div>
          <p className="mt-4 text-sm leading-6 text-foreground/65">Sesuai untuk test auto-reply sebelum deploy semula ke VPS.</p>
        </div>
      </div>

      {validationError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{validationError}</div> : null}
      {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {rules.length ? (
        rules.map((rule, index) => (
          <div key={rule.id ?? `rule-${index}`} className="grid gap-4 rounded-[28px] border bg-white/90 p-5 shadow-panel lg:grid-cols-[0.88fr_1.12fr]">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">Rule {index + 1}</p>
                  <p className="mt-2 text-sm text-foreground/60">Workflow ID: {rule.id ?? 'akan dicipta semasa save'}</p>
                </div>
                <Button variant="ghost" className="gap-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => handleRemoveRule(index)}>
                  <Trash2 className="h-4 w-4" />
                  Buang
                </Button>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">Workflow Name</p>
                <Input className="mt-2" value={rule.name} onChange={(event) => updateRule(index, { name: event.target.value })} placeholder="Keyword Auto Reply" />
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">Keywords</p>
                <Input
                  className="mt-2"
                  value={rule.keywordsText}
                  onChange={(event) => updateRule(index, { keywordsText: event.target.value })}
                  placeholder="stok, harga, delivery"
                />
                <p className="mt-2 text-xs text-foreground/55">Pisahkan keyword dengan koma. Matching dibuat secara lowercase.</p>
              </div>

              <label className="flex items-center justify-between rounded-2xl border bg-muted/45 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">Rule aktif</p>
                  <p className="text-xs text-foreground/55">Rule ini hanya trigger bila diaktifkan.</p>
                </div>
                <input
                  type="checkbox"
                  checked={rule.isActive}
                  onChange={(event) => updateRule(index, { isActive: event.target.checked })}
                  className="h-4 w-4 accent-[#17352b]"
                />
              </label>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">Reply Text</p>
              <textarea
                value={rule.replyText}
                onChange={(event) => updateRule(index, { replyText: event.target.value })}
                placeholder="Terima kasih. Team kami akan balas sebentar lagi."
                className="mt-2 min-h-[220px] w-full rounded-[24px] border border-border bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              <div className="mt-3 rounded-2xl bg-muted/45 px-4 py-3 text-xs leading-5 text-foreground/55">
                Preview keyword aktif: {rule.keywordsText || 'belum diisi'}
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-[28px] border bg-white/90 px-6 py-12 text-center shadow-panel">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-secondary">
            <Bot className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-xl font-semibold">Belum ada automation rule</h2>
          <p className="mt-2 text-sm text-foreground/60">Mulakan dengan menambah satu rule keyword untuk balasan automatik pertama anda.</p>
          <Button className="mt-5 gap-2" onClick={handleAddRule}>
            <Plus className="h-4 w-4" />
            Tambah Rule
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-foreground/45">Dealer Quick Replies</p>
          <h2 className="mt-3 text-3xl font-semibold">Template Balasan Pantas</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/65">
            Template ini akan muncul dalam inbox dealer untuk pricing, stok, promo, test drive, loan, dan lokasi showroom. Sales boleh edit template ikut brand dan branch.
          </p>
        </div>

        <Button variant="ghost" className="gap-2" onClick={handleAddQuickReply}>
          <Plus className="h-4 w-4" />
          Tambah Quick Reply
        </Button>
      </div>

      {quickReplies.length ? (
        quickReplies.map((template, index) => (
          <div key={template.id ?? `quick-reply-${index}`} className="grid gap-4 rounded-[28px] border bg-white/90 p-5 shadow-panel lg:grid-cols-[0.88fr_1.12fr]">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">Template {index + 1}</p>
                  <p className="mt-2 text-sm text-foreground/60">Template ID: {template.id ?? 'akan dicipta semasa save'}</p>
                </div>
                <Button variant="ghost" className="gap-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => handleRemoveQuickReply(index)}>
                  <Trash2 className="h-4 w-4" />
                  Buang
                </Button>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">Template Name</p>
                <Input className="mt-2" value={template.name} onChange={(event) => updateQuickReply(index, { name: event.target.value })} placeholder="Harga / Stok / Promo" />
              </div>

              <label className="flex items-center justify-between rounded-2xl border bg-muted/45 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">Template aktif</p>
                  <p className="text-xs text-foreground/55">Template aktif akan dipaparkan dalam quick replies inbox.</p>
                </div>
                <input
                  type="checkbox"
                  checked={template.isActive}
                  onChange={(event) => updateQuickReply(index, { isActive: event.target.checked })}
                  className="h-4 w-4 accent-[#17352b]"
                />
              </label>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">Reply Text</p>
              <textarea
                value={template.replyText}
                onChange={(event) => updateQuickReply(index, { replyText: event.target.value })}
                placeholder="Hi {{contactName}}, untuk {{model}} saya boleh bantu semak harga..."
                className="mt-2 min-h-[220px] w-full rounded-[24px] border border-border bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              <div className="mt-3 rounded-2xl bg-muted/45 px-4 py-3 text-xs leading-5 text-foreground/55">
                Placeholder yang boleh digunakan: <code>{'{{contactName}}'}</code>, <code>{'{{model}}'}</code>, <code>{'{{budget}}'}</code>, <code>{'{{branch}}'}</code>, <code>{'{{brand}}'}</code>, <code>{'{{vehicleType}}'}</code>.
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-[24px] border bg-muted/55 px-4 py-10 text-sm text-foreground/60">
          Belum ada dealer quick reply. Tekan `Tambah Quick Reply` untuk mula bina template sales.
        </div>
      )}
    </div>
  );
}
