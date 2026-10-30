import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Bot, Send, User as UserIcon } from 'lucide-react';
import { Button, PageHeader } from '../../components/ui';
import { errorMessage, post, CATEGORY_LABELS, formatDate } from '../../lib/api';

interface CampusRecord { id: string; title: string; category: string; organizer: string; registrationDeadline: string | null; link: string }
interface Turn { role: 'user' | 'bot'; text: string; records?: CampusRecord[]; error?: boolean }

const EXAMPLES = [
  'Which hackathons are open for registration?',
  'What events are happening this week?',
  'Show AI/ML opportunities for third-year students.',
  'Which registrations have deadlines tomorrow?',
  'Which clubs organise coding events?',
];

export default function Assistant() {
  const [turns, setTurns] = useState<Turn[]>([{ role: 'bot', text: 'Hi, I am CampusBot. Ask me about hackathons, workshops, deadlines or clubs. I answer only from published campus records.' }]);
  const [input, setInput] = useState('');
  const ask = useMutation({
    mutationFn: (question: string) => post<{ answer: string; records: CampusRecord[] }>('/assistant', { question }),
    onSuccess: ({ data }) => setTurns((t) => [...t, { role: 'bot', text: data.answer, records: data.records }]),
    onError: (e) => setTurns((t) => [...t, { role: 'bot', text: errorMessage(e), error: true }]),
  });

  const send = (question: string) => {
    const q = question.trim();
    if (q.length < 3 || ask.isPending) return;
    setTurns((t) => [...t, { role: 'user', text: q }]);
    setInput('');
    ask.mutate(q);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <PageHeader title="CampusBot" subtitle="Grounded in published campus records. Links go to the source." />
      <div className="card flex flex-col gap-4 p-4 md:p-6" role="log" aria-live="polite" aria-label="Conversation">
        {turns.map((t, i) => (
          <div key={i} className={`flex gap-3 ${t.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${t.role === 'bot' ? 'bg-brand-500 text-white' : 'bg-black/10 dark:bg-white/10'}`} aria-hidden>
              {t.role === 'bot' ? <Bot className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
            </span>
            <div className={`max-w-[85%] space-y-2 rounded-xl px-4 py-2.5 text-sm ${t.role === 'user' ? 'bg-brand-500 text-white' : t.error ? 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200' : 'bg-black/5 dark:bg-white/5'}`}>
              <p className="whitespace-pre-line">{t.text}</p>
              {t.records && t.records.length > 0 && (
                <ul className="space-y-1.5 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                  {t.records.map((r) => (
                    <li key={r.id}>
                      <Link to={r.link} className="font-medium underline">{r.title}</Link>
                      <span className="block text-xs text-[var(--muted)]">{CATEGORY_LABELS[r.category]} · {r.organizer || 'Campus club'} · Register by {formatDate(r.registrationDeadline)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
        {ask.isPending && <p className="text-sm text-[var(--muted)]" role="status">CampusBot is searching campus records…</p>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" onClick={() => send(ex)} className="rounded-full border px-3 py-1 text-xs hover:border-brand-400" style={{ borderColor: 'var(--border)' }}>{ex}</button>
        ))}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <label htmlFor="ask" className="sr-only">Ask CampusBot</label>
        <input id="ask" className="input" maxLength={500} placeholder="Ask about events, deadlines or clubs" value={input} onChange={(e) => setInput(e.target.value)} />
        <Button type="submit" disabled={!input.trim() || ask.isPending} aria-label="Send question"><Send className="h-4 w-4" aria-hidden /></Button>
      </form>
    </div>
  );
}
