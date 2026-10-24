import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Button, Field, PageHeader } from '../../components/ui';
import { errorMessage, patch, post } from '../../lib/api';
import type { User } from '../../lib/api';
import { useAuth } from '../../lib/auth';

const pwSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: z.string().min(8, 'Use at least 8 characters'),
});
type PwValues = z.infer<typeof pwSchema>;

export default function Settings() {
  const { user, refresh } = useAuth();
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const prefs = user?.notificationPrefs ?? { inApp: true, email: false, deadlineReminders: true };
  const savePrefs = useMutation({
    mutationFn: (next: Partial<typeof prefs>) => patch<{ user: User }>('/users/me', { notificationPrefs: next }),
    onSuccess: async () => { await refresh(); setMsg('Notification preferences saved.'); setErr(''); },
    onError: (e) => setErr(errorMessage(e)),
  });
  const changePw = useMutation({
    mutationFn: (v: PwValues) => post('/auth/change-password', v),
    onSuccess: () => { setMsg('Password changed.'); setErr(''); reset(); },
    onError: (e) => setErr(errorMessage(e)),
  });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PwValues>({ resolver: zodResolver(pwSchema) });

  return (
    <>
      <PageHeader title="Settings" subtitle="Account and notification preferences." />
      {msg && <p role="status" className="mb-4 text-sm text-emerald-700 dark:text-emerald-300">{msg}</p>}
      {err && <p role="alert" className="mb-4 text-sm text-red-600">{err}</p>}
      <div className="grid max-w-3xl gap-6">
        <section className="card space-y-3" aria-labelledby="notif-h">
          <h2 id="notif-h" className="font-semibold">Notifications</h2>
          {([
            ['inApp', 'In-app notifications for new opportunities and club updates'],
            ['deadlineReminders', 'Reminder when a registration closes within 24 hours'],
            ['email', 'Email notifications (requires the college mail service)'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-500" checked={prefs[key]} onChange={(e) => savePrefs.mutate({ [key]: e.target.checked })} />
              <span>{label}</span>
            </label>
          ))}
        </section>
        <section className="card" aria-labelledby="pw-h">
          <h2 id="pw-h" className="mb-3 font-semibold">Change password</h2>
          <form className="grid gap-3 sm:max-w-sm" onSubmit={handleSubmit((v) => { setMsg(''); changePw.mutate(v); })} noValidate>
            <Field label="Current password" id="cur" error={errors.currentPassword?.message}><input id="cur" type="password" autoComplete="current-password" className="input" {...register('currentPassword')} /></Field>
            <Field label="New password" id="new" error={errors.newPassword?.message}><input id="new" type="password" autoComplete="new-password" className="input" {...register('newPassword')} /></Field>
            <Button type="submit" disabled={changePw.isPending}>Update password</Button>
          </form>
        </section>
      </div>
    </>
  );
}
