import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ImageOff } from 'lucide-react';

interface TicketImageProps {
  url: string;
}

/**
 * Extracts the storage object path from a stored URL.
 * Supports both /object/public/<bucket>/... and /object/sign/<bucket>/... shapes,
 * plus a bare "<bucket>/path" string.
 */
function extractPath(stored: string): string | null {
  const m = stored.match(/\/ticket-attachments\/([^?]+)/);
  if (m) return decodeURIComponent(m[1]);
  if (stored.startsWith('ticket-attachments/')) {
    return stored.replace(/^ticket-attachments\//, '');
  }
  return null;
}

export function TicketImage({ url }: TicketImageProps) {
  const [signed, setSigned] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const path = extractPath(url);
    if (!path) {
      setFailed(true);
      return;
    }
    supabase.storage
      .from('ticket-attachments')
      .createSignedUrl(path, 60 * 60)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.signedUrl) {
          setFailed(true);
        } else {
          setSigned(data.signedUrl);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (failed) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground border border-border rounded-xl px-3 py-2 bg-muted/30">
        <ImageOff className="h-3.5 w-3.5" />
        Image unavailable
      </div>
    );
  }

  if (!signed) {
    return (
      <div className="w-[180px] h-[180px] rounded-xl bg-muted animate-pulse" />
    );
  }

  return (
    <a href={signed} target="_blank" rel="noopener noreferrer">
      <img
        src={signed}
        alt="Attached"
        className="max-w-[220px] max-h-[220px] rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity border border-border"
      />
    </a>
  );
}
