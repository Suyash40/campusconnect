import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../components/ui';
import { CATEGORY_LABELS, errorMessage, patch } from '../../lib/api';
import type { User } from '../../lib/api';
import { useAuth } from '../../lib/auth';

const INTERESTS = ['Machine learning', 'Web development', 'Data science', 'Cybersecurity', 'Robotics', 'Mobile apps', 'Cloud', 'Design / UI-UX', 'Music', 'Dance', 'Writing', 'Entrepreneurship'];
const SKILLS = ['Python', 'Java', 'C++', 'JavaScript', 'React', 'SQL', 'Figma', 'Public speaking', 'Teamwork', 'Video editing'];
const CATEGORIES = Object.keys(CATEGORY_LABELS);

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function Onboarding() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<string[]>(user?.interests ?? []);
  const [skills, setSkills] = useState<string[]>(user?.skills ?? []);
  const [categories, setCategories] = useState<string[]>(user?.preferredCategories ?? []);
  const [prefs, setPrefs] = useState({ inApp: true, email: false, deadlineReminders: true });
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: () => patch<{ user: User }>('/users/me', {
      interests: interests.map((i) => i.toLowerCase()),
      skills: skills.map((s) => s.toLowerCase()),
      preferredCategories: categories,
      notificationPrefs: prefs,
      onboarded: true,
    }),
    onSuccess: async () => { await refresh(); navigate('/dashboard'); },
    onError: (e) => setError(errorMessage(e)),
  });

  const steps = ['Interests', 'Skills', 'Categories', 'Notifications'];
  const chip = (label: string, selected: boolean, onClick: () => void) => (
    <button key={label} type="button" aria-pressed={selected} onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition focus-visible:ring-2 focus-visible:ring-brand-500 ${selected ? 'border-brand-500 bg-brand-500 text-white' : 'hover:border-brand-400'}`}
      style={selected ? undefined : { borderColor: 'var(--border)' }}>
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm text-[var(--muted)]">Step {step + 1} of {steps.length}</p>
      <h1 className="mt-1 text-2xl font-semibold">Personalise your campus feed</h1>
      <div className="mt-4 h-1.5 w-full rounded-full bg-black/10 dark:bg-white/10" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1}>
        <div className="h-1.5 rounded-full bg-brand-500 transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>

      <div className="card mt-6">
        {step === 0 && (<><h2 className="mb-3 font-medium">What are you interested in?</h2><div className="flex flex-wrap gap-2">{INTERESTS.map((i) => chip(i, interests.includes(i), () => setInterests((v) => toggle(v, i))))}</div></>)}
        {step === 1 && (<><h2 className="mb-3 font-medium">Which skills do you have?</h2><div className="flex flex-wrap gap-2">{SKILLS.map((s) => chip(s, skills.includes(s), () => setSkills((v) => toggle(v, s))))}</div></>)}
        {step === 2 && (<><h2 className="mb-3 font-medium">Which opportunity types do you prefer?</h2><div className="flex flex-wrap gap-2">{CATEGORIES.map((c) => chip(CATEGORY_LABELS[c], categories.includes(c), () => setCategories((v) => toggle(v, c))))}</div></>)}
        {step === 3 && (
          <fieldset className="space-y-3">
            <legend className="mb-3 font-medium">How should we notify you?</legend>
            {([
              ['inApp', 'In-app notifications for new opportunities and updates'],
              ['deadlineReminders', 'Reminders when a registration closes within 24 hours'],
              ['email', 'Email notifications (available once the college mail service is configured)'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-500" checked={prefs[key]} onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))} />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
        )}
      </div>

      {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex items-center justify-between">
        <Button variant="secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => { setError(''); save.mutate(); }} disabled={save.isPending}>Skip for now</Button>
          {step < steps.length - 1
            ? <Button onClick={() => setStep((s) => s + 1)}>Continue</Button>
            : <Button onClick={() => { setError(''); save.mutate(); }} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Finish'}</Button>}
        </div>
      </div>
    </div>
  );
}
