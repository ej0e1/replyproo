import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function WorkspacePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-foreground/45">Workspace Page</p>
        <h1 className="mt-3 text-3xl font-semibold">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/65">{description}</p>
      </div>

      <div className="rounded-[28px] border bg-white/90 p-6 shadow-panel">
        <p className="text-sm text-foreground/65">
          Page ini sudah dipisahkan dalam shell baru. Untuk fungsi penuh semasa transisi, anda masih boleh guna legacy dashboard.
        </p>
        <Link href="/dashboard/legacy" className="mt-5 inline-flex">
          <Button className="gap-2">
            Buka Legacy Dashboard
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
