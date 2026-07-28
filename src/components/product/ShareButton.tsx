'use client';

import { useEffect, useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ShareStatus = 'idle' | 'copied' | 'error';

export function ShareButton({ title, url }: { title: string; url: string }) {
  const [status, setStatus] = useState<ShareStatus>('idle');

  useEffect(() => {
    if (status === 'idle') return;
    const timeout = window.setTimeout(() => setStatus('idle'), 2_500);
    return () => window.clearTimeout(timeout);
  }, [status]);

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setStatus('copied');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setStatus('error');
    }
  }

  const label =
    status === 'copied'
      ? 'Enlace copiado'
      : status === 'error'
        ? 'No se pudo compartir'
        : 'Compartir producto';

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="rounded-full"
        aria-label={label}
        title={label}
        onClick={share}
      >
        {status === 'copied' ? (
          <Check className="h-4 w-4" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
      </Button>
      <span className="sr-only" aria-live="polite">
        {status === 'idle' ? '' : label}
      </span>
    </>
  );
}
