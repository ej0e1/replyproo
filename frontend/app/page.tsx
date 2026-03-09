import Link from 'next/link';
import { Activity, ArrowRight, Bot, ChartSpline, MessageSquareShare, QrCode, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const cards = [
  {
    title: 'Inbox Berpasukan',
    text: 'Urus semua chat pelanggan dengan assignment, notes, dan SLA yang jelas.',
    icon: Users,
  },
  {
    title: 'Automation Workflow',
    text: 'Trigger ikut keyword, waktu, tag, atau event dari CRM dan store anda.',
    icon: MessageSquareShare,
  },
  {
    title: 'AI Auto Reply',
    text: 'Balas soalan lazim, cadangkan jawapan, dan naikkan handoff kepada agent bila perlu.',
    icon: Bot,
  },
  {
    title: 'Campaign Analytics',
    text: 'Pantau volume mesej, conversion, dan health setiap nombor WhatsApp.',
    icon: ChartSpline,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-mesh px-6 py-8 text-foreground md:px-10">
      <section className="mx-auto flex max-w-7xl flex-col gap-8 rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-panel backdrop-blur md:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-foreground/80">
              <QrCode className="h-4 w-4" />
              ReplyPro Control Tower
            </div>
            <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
              Automasi WhatsApp yang nampak enterprise, bukan sekadar bot biasa.
            </h1>
            <p className="max-w-xl text-base text-foreground/75 md:text-lg">
              Baseline dashboard ini sedia untuk multi-tenant inbox, workflow builder,
              broadcast queue, dan AI reply orchestration.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/login">
                <Button className="gap-2">
                  Masuk ke ReplyPro
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="secondary">Buka Dashboard Demo</Button>
              </Link>
            </div>
          </div>

          <div className="dashboard-grid grid min-w-[280px] gap-4 rounded-[28px] border bg-card p-5 md:w-[420px]">
            <div className="rounded-3xl bg-primary p-5 text-white">
              <div className="flex items-center justify-between text-sm opacity-90">
                <span>Realtime Throughput</span>
                <Activity className="h-4 w-4" />
              </div>
              <div className="mt-5 text-4xl font-semibold">108,420</div>
              <p className="mt-2 text-sm opacity-80">mesej diproses minggu ini</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border bg-white p-4">
                <p className="text-sm text-foreground/60">Connected Numbers</p>
                <p className="mt-3 text-3xl font-semibold">24</p>
              </div>
              <div className="rounded-3xl border bg-white p-4">
                <p className="text-sm text-foreground/60">Queue Lag</p>
                <p className="mt-3 text-3xl font-semibold">1.2s</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.title} className="rounded-[28px] border bg-card p-5 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-xl font-semibold">{card.title}</h2>
                <p className="mt-2 text-sm leading-6 text-foreground/70">{card.text}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
