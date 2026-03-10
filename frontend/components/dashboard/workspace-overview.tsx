import Link from 'next/link';
import { ArrowRight, Bot, MessagesSquare, Phone, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const sections = [
  {
    href: '/dashboard/inbox',
    title: 'Inbox Workspace',
    text: 'Akan jadi tempat utama untuk conversation list, thread detail, dan composer.',
    icon: MessagesSquare,
  },
  {
    href: '/dashboard/channels',
    title: 'Channels Workspace',
    text: 'Route khusus untuk QR, status connection, dan reconnect flow WhatsApp.',
    icon: Phone,
  },
  {
    href: '/dashboard/automations',
    title: 'Automations Workspace',
    text: 'Sudah aktif untuk multi-rule keyword auto-reply dalam shell baru ala v0.',
    icon: Bot,
  },
  {
    href: '/dashboard/contacts',
    title: 'Contacts Workspace',
    text: 'Akan menempatkan contact list, tags, opt-in, dan segment asas.',
    icon: Users,
  },
];

export function WorkspaceOverview() {
  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border bg-white/90 p-6 shadow-panel md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/75">
              <Sparkles className="h-3.5 w-3.5" />
              Phase 1 full-shell adoption
            </div>
            <h1 className="mt-4 text-3xl font-semibold md:text-4xl">Dashboard utama kini masuk shell baru berinspirasikan v0.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/65 md:text-base">
              Kita kekalkan logic live yang sudah stabil, tetapi layout, navigation, dan struktur route kini bergerak ke workspace berasingan yang lebih mudah diskala.
            </p>
          </div>

          <div className="rounded-[28px] border bg-muted/45 p-5 text-sm text-foreground/65 lg:w-[320px]">
            <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">Transisi Selamat</p>
            <p className="mt-3 leading-6">
              Legacy dashboard masih disimpan untuk fallback sementara kita pindahkan inbox dan channels satu per satu.
            </p>
            <Link href="/dashboard/legacy" className="mt-4 inline-flex">
              <Button className="gap-2">
                Buka Legacy Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <article key={section.href} className="rounded-[28px] border bg-white/90 p-5 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-xl font-semibold">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-foreground/68">{section.text}</p>
              <Link href={section.href} className="mt-5 inline-flex">
                <Button variant="ghost" className="gap-2 px-0">
                  Buka Section
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </article>
          );
        })}
      </section>
    </div>
  );
}
