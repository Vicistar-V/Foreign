import { useEffect, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';

/**
 * Local-only comments — never leaves the device.
 * Stored in localStorage under `viketa_cloak_comments`.
 */

type Comment = { name: string; text: string; at: number };

const STORAGE_KEY = 'viketa_cloak_comments';

const SEED: Comment[] = [
  { name: 'Blessing from PH', text: 'I dey reason this thing for like 2 weeks before I finally join. No regret at all. The mentors dey respond sharp sharp.', at: Date.now() - 1000 * 60 * 60 * 26 },
  { name: 'Ifeanyi', text: 'Una never see anything. The WhatsApp group alone don change how I dey think about money. Worth more than the 3k abeg.', at: Date.now() - 1000 * 60 * 60 * 9 },
  { name: 'Mama Tobi', text: 'My pikin send me the link. As a 52yr old woman, even me I understand wetin dem dey teach. Beginner friendly true true.', at: Date.now() - 1000 * 60 * 60 * 3 },
  { name: 'Samuel A.', text: 'Bro just pay and stop dulling. By next month you go thank yourself.', at: Date.now() - 1000 * 60 * 40 },
];

const timeAgo = (ts: number) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

export const CloakComments = () => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [name, setName] = useState('');
  const [text, setText] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed: Comment[] = raw ? JSON.parse(raw) : [];
      setComments(parsed);
    } catch {
      setComments([]);
    }
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    const t = text.trim();
    if (!n || !t) return;
    const next = [{ name: n, text: t, at: Date.now() }, ...comments];
    setComments(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {/* noop */}
    setText('');
  };

  const all = [...comments, ...SEED];

  return (
    <section className="mx-auto max-w-3xl px-4 pb-10">
      <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
        <MessageCircle className="h-5 w-5" />
        What people are saying
      </h2>
      <p className="text-xs text-muted-foreground mb-4">{all.length} comments</p>

      <form onSubmit={submit} className="rounded-xl border border-border bg-muted/20 p-3 mb-5 space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={40}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Share your thoughts..."
          rows={2}
          maxLength={400}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
        />
        <button
          type="submit"
          disabled={!name.trim() || !text.trim()}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-foreground text-background font-medium text-sm disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          Post comment
        </button>
      </form>

      <div className="space-y-3">
        {all.map((c, i) => (
          <div key={i} className="rounded-xl border border-border bg-muted/10 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-7 w-7 rounded-full bg-foreground/10 grid place-items-center text-xs font-semibold">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.name}</div>
                <div className="text-[11px] text-muted-foreground">{timeAgo(c.at)}</div>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{c.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
