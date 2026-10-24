import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

const steps = [
  { n: '01', t: 'Paste the message', d: 'Copy an announcement from WhatsApp, email or a notice board. Nothing else to fill in.' },
  { n: '02', t: 'Review what the AI found', d: 'Every field it could not confirm is highlighted. Nothing is guessed, so you decide what goes live.' },
  { n: '03', t: 'Publish to campus', d: 'Eligible students are notified and can register straight away. Deadlines are tracked for them.' },
];

const student = [
  'Opportunities ranked by your branch, year and interests, with the reason shown',
  'Reminders 24 hours before a registration closes',
  'Expired events clearly marked, never shown as open',
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-[var(--bg)]/90 backdrop-blur" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-500 text-white"><Sparkles className="h-3.5 w-3.5" aria-hidden /></span>
            CampusConnect<span className="text-brand-600">.ai</span>
          </Link>
          <nav aria-label="Public" className="hidden items-center gap-8 text-sm text-[var(--muted)] md:flex">
            <a href="#how" className="hover:text-[var(--text)]">How it works</a>
            <a href="#students" className="hover:text-[var(--text)]">Students</a>
            <Link to="/about" className="hover:text-[var(--text)]">About</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-ghost">Log in</Link>
            <Link to="/register" className="btn-primary">Get started</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pb-20 pt-16 md:pt-24">
        <p className="mb-6 text-xs font-medium uppercase tracking-[0.2em] text-brand-700">Your very own campus buddy</p>
        <h1 className="max-w-4xl font-display text-5xl leading-[1.05] md:text-7xl">
          Your entire campus. <em className="text-brand-600">One</em> intelligent platform.
        </h1>
        <div className="mt-8 grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
          <p className="max-w-xl text-lg leading-relaxed text-[var(--muted)]">
            Hackathons, placements and club events are scattered across group chats. CampusConnect turns those messages into structured announcements and shows each student the ones that fit them.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/register" className="btn-primary px-5 py-2.5">Explore opportunities <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            <a href="#how" className="btn-secondary px-5 py-2.5">See how it works</a>
          </div>
        </div>

        {/* Product preview: the composer, not a generic dashboard */}
        <figure className="mt-16 overflow-hidden rounded-xl border bg-[var(--surface)] shadow-[0_30px_80px_-40px_rgba(124,45,18,0.35)]" style={{ borderColor: 'var(--border)' }} aria-label="Preview of the announcement composer">
          <div className="grid md:grid-cols-2">
            <div className="border-b p-6 md:border-b-0 md:border-r" style={{ borderColor: 'var(--border)' }}>
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Source message</p>
              <p className="rounded-lg bg-black/[0.03] p-4 font-mono text-[13px] leading-relaxed text-[var(--muted)] dark:bg-white/[0.03]">
                The Coding Club is organizing a hackathon on 15 November. Registration closes on 10 November. Students from second and third year can participate. Register here: https://example.com/register
              </p>
            </div>
            <div className="p-6">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Extracted draft</p>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4 border-b pb-2" style={{ borderColor: 'var(--border)' }}><dt className="text-[var(--muted)]">Category</dt><dd>Hackathon</dd></div>
                <div className="flex justify-between gap-4 border-b pb-2" style={{ borderColor: 'var(--border)' }}><dt className="text-[var(--muted)]">Eligible years</dt><dd>2nd, 3rd</dd></div>
                <div className="flex justify-between gap-4 border-b pb-2" style={{ borderColor: 'var(--border)' }}><dt className="text-[var(--muted)]">Register by</dt><dd>10 Nov</dd></div>
                <div className="flex justify-between gap-4 border-b border-dashed pb-2 text-amber-700 dark:text-amber-300" style={{ borderColor: '#D97706' }}><dt>Event year</dt><dd>Not stated, please confirm</dd></div>
                <div className="flex justify-between gap-4 pb-2 text-amber-700 dark:text-amber-300"><dt>Venue</dt><dd>Missing from message</dd></div>
              </dl>
            </div>
          </div>
        </figure>
      </section>

      {/* How it works */}
      <section id="how" className="border-y" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 md:grid-cols-[1fr_2fr]">
          <div>
            <h2 className="font-display text-4xl leading-tight">From message to published in three steps.</h2>
          </div>
          <ol className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {steps.map((s) => (
              <li key={s.n} className="grid gap-2 py-6 sm:grid-cols-[4rem_1fr]">
                <span className="font-display text-2xl text-brand-600">{s.n}</span>
                <div>
                  <h3 className="font-semibold">{s.t}</h3>
                  <p className="mt-1 text-[var(--muted)]">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Audiences */}
      <section id="students" className="mx-auto grid max-w-6xl gap-16 px-5 py-20 md:grid-cols-2">
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-brand-700">For students</p>
          <h2 className="font-display text-4xl leading-tight">Fewer missed deadlines.</h2>
          <ul className="mt-6 space-y-4">
            {student.map((s) => (
              <li key={s} className="flex gap-3 text-[var(--muted)]"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-brand-700">For coordinators</p>
          <h2 className="font-display text-4xl leading-tight">Stop retyping the same details.</h2>
          <p className="mt-6 text-[var(--muted)]">Paste the message you already wrote. Correct the draft, publish it, and see who registered and from which branch, all in one place.</p>
          <p className="mt-4 text-[var(--muted)]">Every publish, role change and moderation action is recorded in an audit log.</p>
        </div>
      </section>

      {/* Closing */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="flex flex-col items-start justify-between gap-6 rounded-xl bg-brand-900 p-10 text-brand-50 md:flex-row md:items-center md:p-14">
          <h2 className="font-display text-4xl leading-tight">Start with the opportunities you already missed.</h2>
          <div className="flex gap-3">
            <Link to="/register" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-brand-900 hover:bg-brand-50">Create account</Link>
            <Link to="/login" className="inline-flex items-center rounded-lg border border-brand-300/40 px-5 py-2.5 text-sm font-medium hover:bg-white/10">Log in</Link>
          </div>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-[var(--muted)]" style={{ borderColor: 'var(--border)' }}>
        <p>CampusConnect.ai · B.Tech CSE (AI &amp; ML) major project</p>
      </footer>
    </div>
  );
}
