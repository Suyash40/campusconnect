import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Field, Button, PageHeader } from '../../components/ui';
import { CATEGORY_LABELS, errorMessage, patch } from '../../lib/api';
import type { User } from '../../lib/api';
import { useAuth } from '../../lib/auth';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your full name'),
  college: z.string().trim().min(2, 'Enter your college'),
  branch: z.string().trim().min(2, 'Enter your branch'),
  year: z.coerce.number().int().min(1).max(4),
  interests: z.string(),
  skills: z.string(),
});
type Values = z.infer<typeof schema>;

const csv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 20);

export default function Profile() {
  const { user, refresh } = useAuth();
  const [cats, setCats] = useState<string[]>(user?.preferredCategories ?? []);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name ?? '', college: user?.college ?? '', branch: user?.branch ?? '', year: user?.year ?? 1,
      interests: (user?.interests ?? []).join(', '), skills: (user?.skills ?? []).join(', '),
    },
  });
  const mutation = useMutation({
    mutationFn: (v: Values) => patch<{ user: User }>('/users/me', {
      ...v,
      interests: csv(v.interests),
      skills: csv(v.skills),
      preferredCategories: cats,
    }),
    onSuccess: async () => { await refresh(); setSaved(true); setServerError(''); },
    onError: (e) => { setSaved(false); setServerError(errorMessage(e)); },
  });
  const toggle = (c: string) => setCats((v) => (v.includes(c) ? v.filter((x) => x !== c) : [...v, c]));
  const hint = useMemo(() => (user?.followedClubs.length ? `You follow ${user.followedClubs.length} club(s).` : 'Follow clubs from the Clubs page.'), [user]);

  return (
    <>
      <PageHeader title="Profile" subtitle="These details drive eligibility checks and your recommendations." />
      <form className="card grid max-w-3xl gap-4 md:grid-cols-2" onSubmit={handleSubmit((v) => { setSaved(false); mutation.mutate(v); })} noValidate>
        {serverError && <p role="alert" className="md:col-span-2 text-sm text-red-600">{serverError}</p>}
        <Field label="Name" id="pname" error={errors.name?.message}><input id="pname" className="input" {...register('name')} /></Field>
        <Field label="College" id="pcollege" error={errors.college?.message}><input id="pcollege" className="input" {...register('college')} /></Field>
        <Field label="Branch" id="pbranch" error={errors.branch?.message}><input id="pbranch" className="input" {...register('branch')} /></Field>
        <Field label="Academic year" id="pyear" error={errors.year?.message}>
          <select id="pyear" className="input" {...register('year')}><option value={1}>1st year</option><option value={2}>2nd year</option><option value={3}>3rd year</option><option value={4}>4th year</option></select>
        </Field>
        <Field label="Interests" id="pint" hint="Comma-separated, for example: machine learning, web development" error={errors.interests?.message}><input id="pint" className="input" {...register('interests')} /></Field>
        <Field label="Skills" id="pskill" hint="Comma-separated, for example: python, sql" error={errors.skills?.message}><input id="pskill" className="input" {...register('skills')} /></Field>
        <fieldset className="md:col-span-2">
          <legend className="label">Preferred opportunity types</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <button key={k} type="button" aria-pressed={cats.includes(k)} onClick={() => toggle(k)} className={`rounded-full border px-3 py-1.5 text-sm ${cats.includes(k) ? 'border-brand-500 bg-brand-500 text-white' : ''}`} style={cats.includes(k) ? undefined : { borderColor: 'var(--border)' }}>{v}</button>
            ))}
          </div>
        </fieldset>
        <p className="md:col-span-2 text-sm text-[var(--muted)]">{hint}</p>
        <div className="md:col-span-2 flex items-center gap-3">
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save profile'}</Button>
          {saved && <span role="status" className="text-sm text-emerald-700 dark:text-emerald-300">Profile saved.</span>}
        </div>
      </form>
    </>
  );
}
