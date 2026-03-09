'use client';

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, LockKeyhole, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchJson, setAuthToken } from '@/lib/auth';

type LoginResponse = {
  accessToken: string;
  tokenType: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    tenants: Array<{
      tenantId: string;
      role: string;
      name: string;
      slug: string;
    }>;
  };
};

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('owner@replypro.demo');
  const [password, setPassword] = useState('ReplyPro123!');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const data = await fetchJson<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      setAuthToken(data.accessToken);
      router.push('/dashboard');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Login gagal');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/75">Emel</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
          <Input
            type="email"
            className="pl-11"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="owner@replypro.demo"
            autoComplete="email"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/75">Kata laluan</label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
          <Input
            type="password"
            className="pl-11"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Masukkan kata laluan"
            autoComplete="current-password"
            required
          />
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      ) : null}

      <Button className="h-11 w-full justify-center gap-2" disabled={isSubmitting}>
        {isSubmitting ? 'Sedang masuk...' : 'Masuk ke dashboard'}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  );
}
