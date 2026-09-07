import { useEffect, useRef, useState } from 'react';
import { checkInviteKey, saveInviteKey } from '@/lib/inviteKey';
import {
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  Users,
  Calendar,
  BookOpen,
  MessageSquare,
  HeartHandshake,
  Infinity as InfinityIcon,
  Youtube,
  PlayCircle,
  Star,
  Mail,
  Phone,
  MapPin,
  FileText,
} from 'lucide-react';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { CloakCheckoutDrawer } from './CloakCheckoutDrawer';
import { CloakComments } from './CloakComments';
import founderDamini from '@/assets/cloak/founder-damini.jpg';
import mentorFemi from '@/assets/cloak/mentor-femi.jpg';
import mentorNgozi from '@/assets/cloak/mentor-ngozi.jpg';
import mentorTobi from '@/assets/cloak/mentor-tobi.jpg';
import testiAdaeze from '@/assets/cloak/testi-adaeze.jpg';
import testiTunde from '@/assets/cloak/testi-tunde.jpg';
import testiChiamaka from '@/assets/cloak/testi-chiamaka.jpg';
import testiYusuf from '@/assets/cloak/testi-yusuf.jpg';
import testiBukky from '@/assets/cloak/testi-bukky.jpg';
import testiKelechi from '@/assets/cloak/testi-kelechi.jpg';

const BRAND = 'Viketa';
const PROGRAM = 'Viketa Mentorship Program';
const YOUTUBE_URL = 'https://www.youtube.com/@daminiwilliams';

export const CloakLanding = () => {
  const { data: config } = usePlatformConfig();
  const price = Number(config?.membership_fee ?? 5000);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    document.title = `${PROGRAM} — Lifetime Access`;
    const ensure = (name: string, content: string) => {
      let m = document.querySelector(`meta[name="${name}"]`);
      if (!m) {
        m = document.createElement('meta');
        m.setAttribute('name', name);
        document.head.appendChild(m);
      }
      m.setAttribute('content', content);
    };
    ensure('robots', 'noindex,nofollow');
  }, []);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/60 bg-background sticky top-0 z-30">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HiddenAccess slot="a">
              <img src="/logo.png" alt="Viketa" className="h-8 w-8 rounded-lg" />
            </HiddenAccess>
            <span className="font-semibold tracking-tight">{BRAND}</span>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="text-sm font-medium px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-90"
          >
            Join mentorship
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-4 pt-10 pb-6 text-center">
        <div className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full border border-border bg-muted/40 px-3 py-1 mb-5">
          <Users className="h-3.5 w-3.5" />
          <span>2,800+ Nigerians inside · new sessions weekly</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.15]">
          {PROGRAM}
        </h1>
        <p className="mt-3 text-muted-foreground text-base sm:text-lg">
          ₦{price.toLocaleString()} one-time. Learn the exact daily habits Nigerians
          are using to build steady weekly income — taught by people who already do it.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-foreground text-background font-semibold text-base hover:opacity-90 shadow-sm"
          >
            Join for ₦{price.toLocaleString()} — lifetime access
          </button>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            One payment · No subscription · Lifetime access
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="mx-auto max-w-3xl px-4 pb-10">
        <h2 className="text-xl font-semibold mb-4">What you get inside</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { icon: Users, title: 'Private mentorship group', body: 'WhatsApp + Telegram circle with mentors who actually do this every day.' },
            { icon: Calendar, title: 'Weekly live sessions', body: 'Every Saturday — walk-through, Q&A, and accountability check-ins.' },
            { icon: BookOpen, title: 'Starter playbook', body: 'Step-by-step setup so a complete beginner can follow without getting lost.' },
            { icon: MessageSquare, title: '1:1 onboarding chat', body: 'A mentor messages you within 24 hours of joining to map your first week.' },
            { icon: HeartHandshake, title: 'Accountability buddy', body: 'Get paired with someone at your level so you both actually finish.' },
            { icon: InfinityIcon, title: 'Lifetime updates', body: 'Every new lesson, template and replay is added to your library — free.' },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-muted/15 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="h-4 w-4" />
                <h3 className="text-sm font-semibold">{title}</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Founder */}
      <section className="mx-auto max-w-3xl px-4 pb-10">
        <h2 className="text-xl font-semibold mb-4">Meet your founder</h2>
        <div className="rounded-2xl border border-border bg-muted/15 p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <img
              src={founderDamini}
              alt="Damini Williams — Founder"
              loading="lazy"
              className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover ring-2 ring-border shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="text-base sm:text-lg font-semibold leading-tight">Damini Williams</div>
              <div className="text-xs text-muted-foreground mt-0.5">Founder · Nigeria 🇳🇬</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 text-red-500 text-[11px] font-semibold px-2 py-0.5">
                  <Youtube className="h-3 w-3" /> 26.2K subscribers
                </span>
                <span className="inline-flex items-center rounded-full bg-muted text-[11px] font-medium px-2 py-0.5">443 videos</span>
                <span className="inline-flex items-center rounded-full bg-muted text-[11px] font-medium px-2 py-0.5">492K+ views</span>
              </div>
            </div>
          </div>

          <p className="text-sm leading-relaxed mt-4 text-foreground/90">
            I help African entrepreneurs build profitable businesses — whether you're
            launching your first online store or trying to expand across Africa and beyond.
            On my channel I share the tools, ideas and mindset to win.
          </p>

          <div className="mt-3 text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground/80">What I cover: </span>
            growing a business in Nigeria, across Africa & globally · ecommerce,
            digital marketing, social media & ads for African businesses · today's
            real business opportunities across Africa.
          </div>

          {/* Links */}
          <div className="mt-4 grid gap-2">
            <a
              href="https://www.youtube.com/@daminiwilliams"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Youtube className="h-4 w-4 text-red-500 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">@daminiwilliams on YouTube</div>
                  <div className="text-[11px] text-muted-foreground truncate">youtube.com/@daminiwilliams</div>
                </div>
              </div>
              <span className="text-xs font-semibold text-red-500 shrink-0 ml-2">Subscribe</span>
            </a>

            <a
              href="https://daminiwilliams.selar.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">Learn More</div>
                <div className="text-[11px] text-muted-foreground truncate">daminiwilliams.selar.com</div>
              </div>
              <span className="text-xs font-medium text-muted-foreground shrink-0 ml-2">Open →</span>
            </a>

            <a
              href="https://ojadigital.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">Oja Digital Toolkit</div>
                <div className="text-[11px] text-muted-foreground truncate">ojadigital.com</div>
              </div>
              <span className="text-xs font-medium text-muted-foreground shrink-0 ml-2">Open →</span>
            </a>
          </div>

          <div className="mt-3 text-[11px] text-muted-foreground">
            On the channel since Apr 2020 · Based in Nigeria
          </div>
        </div>
      </section>

      {/* YouTube */}
      <section className="mx-auto max-w-3xl px-4 pb-10">
        <div className="rounded-2xl border border-border bg-muted/20 p-3 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-red-600/15 text-red-500 grid place-items-center shrink-0">
              <Youtube className="h-5 w-5" />
            </div>
            <div className="text-sm font-semibold">Watch a free lesson</div>
          </div>

          <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ paddingTop: '56.25%' }}>
            <iframe
              className="absolute inset-0 h-full w-full"
              src="https://www.youtube.com/embed/XYm52TogPC8?rel=0"
              title="Viketa Mentorship — free lesson"
              loading="lazy"
              allow="accelerated-sensors; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>

          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
            <div className="flex items-start gap-2">
              <PlayCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm leading-relaxed">
                <span className="font-semibold text-red-500">Remember to subscribe</span>
                <span className="text-foreground/80"> so you don't miss the next free lesson — new ones drop every week.</span>
              </p>
            </div>
            <a
              href={YOUTUBE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 text-white text-sm font-semibold py-2.5 active:scale-[0.98] transition-transform"
            >
              <Youtube className="h-4 w-4" />
              Subscribe on YouTube
            </a>
          </div>
        </div>
      </section>

      {/* Testimonials — natural Nigerian voice */}
      <section className="mx-auto max-w-3xl px-4 pb-10">
        <h2 className="text-xl font-semibold mb-4">Stories from the group</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { name: 'Adaeze O.', city: 'Lagos', photo: testiAdaeze, text: 'Omo, I no go lie, the first week I just dey observe. By week 3 ₦22k don land my account. Mad ting honestly.' },
            { name: 'Tunde A.', city: 'Ibadan', photo: testiTunde, text: 'I done buy plenty so-called money course. This one different because the mentors dey reply you for WhatsApp like person wey care.' },
            { name: 'Chiamaka N.', city: 'Abuja', photo: testiChiamaka, text: 'My husband first vex when I pay the 3k. After 2 weeks he come dey ask me how he go join too. Lol.' },
            { name: 'Yusuf I.', city: 'Kano', photo: testiYusuf, text: 'Plain talk, no long story. Dem go tell you wetin to do, how much to expect, and dem dey check up on you. Worth am.' },
            { name: 'Bukky O.', city: 'Ogun', photo: testiBukky, text: 'I be JJC for this kind tin. The aunty wey dem pair me with dey hold my hand. By week 2 I don do my first transaction myself.' },
            { name: 'Kelechi M.', city: 'Owerri', photo: testiKelechi, text: '3,000 wey I for chop suya with don turn small small income wey dey come every weekend. Make I no lie, I happy say I join.' },
          ].map((t) => (
            <div key={t.name} className="rounded-xl border border-border p-4 bg-muted/15">
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={t.photo}
                  alt={t.name}
                  loading="lazy"
                  className="h-11 w-11 rounded-full object-cover ring-1 ring-border"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{t.name}</div>
                  <div className="text-[11px] text-muted-foreground">{t.city}</div>
                </div>
                <div className="flex items-center gap-0.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  ))}
                </div>
              </div>
              <p className="text-sm leading-relaxed">"{t.text}"</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comments (local-only) */}
      <CloakComments />

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 pb-10">
        <h2 className="text-xl font-semibold mb-4">Common questions</h2>
        <div className="space-y-2">
          {[
            { q: 'How do I get in after paying?', a: 'Right after Flutterwave confirms, you get an email with your access link and the WhatsApp group invite. Check your inbox (and spam) within 2 minutes.' },
            { q: 'Is this a subscription?', a: 'No. ₦3,000 one time and you are in for life. No monthly charge, no hidden fees.' },
            { q: 'I am a complete beginner — will I cope?', a: 'Yes. Most people in the group started with zero experience. The mentors break everything down small small and you have an accountability buddy.' },
            { q: 'How much time per day do I need?', a: '30 to 45 minutes is enough for the first 2 weeks. After that you can scale up if you want.' },
            { q: 'Can I get a refund?', a: 'No. All payments are final — this is a strict NO-REFUND program. You are paying for instant lifetime access to the mentorship group, live sessions and lessons. Please only join if you are sure.' },
            { q: 'Is the payment safe?', a: 'Yes. We use Flutterwave — the same gateway big Nigerian businesses use. Your card details never touch us.' },
          ].map((item) => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-3xl px-4 pb-16 text-center">
        <div className="rounded-2xl border border-border p-6 sm:p-8 bg-muted/20">
          <h3 className="text-xl font-semibold mb-2">Your first session is waiting</h3>
          <p className="text-sm text-muted-foreground mb-5">
            One payment. Lifetime access. New mentors checking in every day.
          </p>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-foreground text-background font-semibold text-base hover:opacity-90"
          >
            Join now for ₦{price.toLocaleString()}
          </button>
        </div>
      </section>

      {/* Policies & Contact */}
      <section className="mx-auto max-w-3xl px-4 pb-10">
        <div className="rounded-2xl border border-border bg-muted/15 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4" />
            <h2 className="text-base font-semibold">Policies & Contact</h2>
          </div>

          <div className="space-y-2 mb-5">
            <FaqItem
              q="Terms and Conditions"
              a={`By paying for the ${PROGRAM}, you agree to a single one-time fee of ₦${price.toLocaleString()} for lifetime access to our mentorship group, weekly live sessions and lesson library. You must be 18+ and use the program for personal learning only — reselling, sharing your access link, or recording private sessions is not allowed and may lead to removal without refund. Earnings shown in testimonials are personal results; we do not guarantee any specific income. We may update lessons, mentors and group rules at any time to improve the experience. Use of the program means you accept these terms in full.`}
            />
            <FaqItem
              q="Privacy Policy"
              a={`We collect only what we need to give you access: your full name, email, phone number and payment reference. Card details never touch our servers — payments are handled by Flutterwave. We use your contact info to send you your access link, session reminders and important program updates. We do not sell or rent your information to third parties. You can request deletion of your account and personal data at any time by emailing support@viketa.xyz. All data is stored on secure, encrypted servers.`}
            />
            <FaqItem
              q="Refund Policy — No Refund"
              a={`All payments are FINAL. We operate a strict NO-REFUND policy. Because access to the private group, sessions and lesson library is granted instantly after payment, we cannot offer refunds for any reason — including change of mind, inability to attend sessions, or failure to apply the lessons. Please make sure you have read everything on this page and are fully committed before paying. If your payment failed but money was debited, email support@viketa.xyz with your transaction reference and we will trace it and reverse the failed charge — this is not a refund of a successful payment, it is a reversal of a failed one.`}
            />
          </div>

          <div className="border-t border-border pt-4 space-y-2.5">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Contact us
            </div>
            <a
              href="mailto:support@viketa.xyz"
              className="flex items-center gap-2.5 text-sm hover:text-primary"
            >
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>support@viketa.xyz</span>
            </a>
            <a
              href="tel:+2348103234894"
              className="flex items-center gap-2.5 text-sm hover:text-primary"
            >
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>+234 810 323 4894</span>
            </a>
            <div className="flex items-start gap-2.5 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <span>9 Power House Avenue, Awada, Anambra State, Nigeria</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        <HiddenAccess slot="b">
          © {new Date().getFullYear()} {BRAND}. All rights reserved.
        </HiddenAccess>
      </footer>

      {drawerOpen && (
        <CloakCheckoutDrawer
          price={price}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
};

const FaqItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-left text-sm font-medium"
      >
        <span>{q}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{a}</div>}
    </div>
  );
};

/**
 * Hidden access entry — SPLIT into two slots so neither location alone
 * reveals an input.
 *
 *  - slot "a"  → lives behind the header logo (long-press / triple-click).
 *                Holds the FIRST HALF of the access key.
 *  - slot "b"  → lives behind the footer copyright text (long-press / triple-click).
 *                Holds the SECOND HALF. Submitting from here combines
 *                A + B and validates via the same checkInviteKey RPC.
 *
 * The first half persists in sessionStorage (cleared on tab close), so the
 * user can paste it in the header, scroll down, and finish in the footer
 * without exposing the full key in any one place.
 */
const SPLIT_STORAGE_KEY = '__vk_a';

// Cross-hints: each slot displays the half that belongs in the OTHER slot,
// so the operator can read it, copy it, scroll to the other slot, and paste it.
// (Current key in platform_config.invite_access_key = "d36cdd67161f")
const HINT: Record<'a' | 'b', string> = {
  a: '67161f', // shown at the logo → paste this into the footer input
  b: 'd36cdd', // shown at the footer → paste this into the logo input
};

const HiddenAccess = ({ children, slot }: { children: React.ReactNode; slot: 'a' | 'b' }) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [state, setState] = useState<'idle' | 'checking' | 'bad' | 'saved'>('idle');
  const clicks = useRef(0);
  const timer = useRef<number | null>(null);

  const handleTap = () => {
    clicks.current += 1;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      clicks.current = 0;
    }, 600);
    if (clicks.current >= 3) {
      clicks.current = 0;
      setOpen(true);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;

    if (slot === 'a') {
      try {
        sessionStorage.setItem(SPLIT_STORAGE_KEY, v);
      } catch {
        /* noop */
      }
      setState('saved');
      setTimeout(() => {
        setOpen(false);
        setValue('');
        setState('idle');
      }, 700);
      return;
    }

    let partA = '';
    try {
      partA = sessionStorage.getItem(SPLIT_STORAGE_KEY) || '';
    } catch {
      /* noop */
    }
    const combined = partA + v;
    setState('checking');
    const ok = await checkInviteKey(combined);
    if (ok) {
      saveInviteKey(combined);
      try {
        sessionStorage.removeItem(SPLIT_STORAGE_KEY);
      } catch {
        /* noop */
      }
      window.location.reload();
    } else {
      setState('bad');
      setTimeout(() => setState('idle'), 1500);
    }
  };

  // Always render the children (logo / footer text) so the page never visually
  // changes when the slot opens. The input pops up inline next to them.
  return (
    <span className="inline-flex items-center gap-2">
      <span onClick={handleTap} className="select-none cursor-default inline-flex">
        {children}
      </span>

      {open && (
        <form onSubmit={submit} className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(HINT[slot]);
                setState('saved');
                setTimeout(() => setState((s) => (s === 'saved' ? 'idle' : s)), 900);
              } catch {
                /* noop */
              }
            }}
            className="text-[11px] font-mono text-foreground/70 hover:text-foreground select-all px-1.5 py-0.5 rounded border border-border/60 bg-muted/30"
            title="Tap to copy"
          >
            {state === 'saved' ? 'copied' : HINT[slot]}
          </button>
          <input
            autoFocus
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder=""
            className={`h-7 w-24 rounded border bg-background px-2 text-xs outline-none ${
              state === 'bad' ? 'border-red-500' : 'border-border'
            }`}
          />
          <button
            type="submit"
            disabled={state === 'checking'}
            className="text-[11px] text-muted-foreground hover:text-foreground px-1"
          >
            {state === 'checking' ? '…' : '→'}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setValue('');
              setState('idle');
            }}
            className="text-[11px] text-muted-foreground hover:text-foreground px-1"
            aria-label="Close"
          >
            ×
          </button>
        </form>
      )}
    </span>
  );
};
