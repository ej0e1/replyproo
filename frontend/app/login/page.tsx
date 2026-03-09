import { ArrowRight, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-mesh px-6 py-8 text-foreground md:px-10 md:py-10">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="rounded-[32px] border border-white/70 bg-[#163c31] p-8 text-white shadow-panel md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            <Sparkles className="h-4 w-4" />
            ReplyPro Phase 1
          </div>
          <h1 className="mt-6 max-w-xl text-4xl font-semibold leading-tight md:text-6xl">
            Login ke command center untuk mula bina WhatsApp SaaS yang betul-betul scalable.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/74">
            Sekarang kita dah ada auth API, tenant demo, Docker stack, Prisma, dan dashboard shell sebagai asas pembangunan produk sebenar.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="rounded-[28px] border border-white/10 bg-white/8 p-5">
              <ShieldCheck className="h-5 w-5" />
              <p className="mt-4 text-lg font-semibold">JWT Auth Ready</p>
              <p className="mt-2 text-sm text-white/68">Frontend boleh login dan consume `/api/auth/me` dari backend NestJS.</p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/8 p-5">
              <Lock className="h-5 w-5" />
              <p className="mt-4 text-lg font-semibold">Demo Credentials</p>
              <p className="mt-2 text-sm text-white/68">owner@replypro.demo / ReplyPro123!</p>
            </div>
          </div>

          <Link href="/" className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-white/85 transition hover:text-white">
            Kembali ke landing page
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <section className="rounded-[32px] border border-white/70 bg-white/86 p-8 shadow-panel backdrop-blur md:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-foreground/45">Masuk</p>
          <h2 className="mt-4 text-3xl font-semibold">Buka workspace anda</h2>
          <p className="mt-3 text-sm leading-6 text-foreground/65">
            Untuk sekarang, gunakan akaun demo seeded dari Prisma. Selepas ini kita akan sambung user invitation, tenant switching, dan protected route yang lebih lengkap.
          </p>

          <div className="mt-8 rounded-[24px] border bg-muted/55 p-5">
            <LoginForm />
          </div>
        </section>
      </div>
    </main>
  );
}
