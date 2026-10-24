import { Link } from 'react-router-dom';

export default function About() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link to="/" className="text-sm text-brand-600">← Back to home</Link>
      <h1 className="mt-4 text-3xl font-semibold">About CampusConnect.ai</h1>
      <p className="mt-4 text-[var(--muted)]">Campus updates are scattered across WhatsApp groups, emails and notice boards, so students miss events, workshops, internships and deadlines. CampusConnect.ai centralises them in one platform.</p>
      <h2 className="mt-8 text-xl font-semibold">How it works</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--muted)]">
        <li>Coordinators paste an existing message. AI drafts a structured announcement, and missing or uncertain fields are flagged for review before publishing.</li>
        <li>Students get a ranking based on branch, year, interests, skills, followed clubs and deadlines. Every recommendation shows its reasons, and students can say "more like this" or "not relevant".</li>
        <li>CampusBot answers questions using published records only, and links to the source.</li>
      </ul>
      <h2 className="mt-8 text-xl font-semibold">Honest limits</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--muted)]">
        <li>Recommendations use transparent scoring rules. No machine-learning model has been trained on campus data.</li>
        <li>Messages are pasted manually. The platform does not access private WhatsApp groups.</li>
        <li>Email delivery needs a configured mail service. Without one, notifications are in-app only.</li>
      </ul>
    </div>
  );
}
