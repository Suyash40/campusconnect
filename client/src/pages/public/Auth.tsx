import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Field, Button } from '../../components/ui';
import { errorMessage, post } from '../../lib/api';
import type { User } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { navFor } from '../../components/Layout';

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name'),
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(8, 'Use at least 8 characters'),
  college: z.string().trim().min(2, 'Enter your college'),
  branch: z.string().trim().min(2, 'Enter your branch, for example CSE'),
  year: z.coerce.number({ invalid_type_error: 'Choose your year' }).int().min(1, 'Choose your year').max(4, 'Choose your year'),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="grid min-h-screen md:grid-cols-[1fr_1fr]">
      <aside className="hidden flex-col justify-between bg-brand-900 p-12 text-brand-50 md:flex">
        <Link to="/" className="font-semibold tracking-tight">CampusConnect<span className="text-brand-300">.ai</span></Link>
        <div className="max-w-md">
          <p className="font-display text-4xl leading-snug">Every opportunity your campus posts, in one place, sorted for you.</p>
          <p className="mt-4 text-sm text-brand-200">Hackathons, internships, workshops and club events, with deadlines tracked before they close.</p>
        </div>
        <p className="text-xs text-brand-300">Your very own campus buddy</p>
      </aside>
      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-10 block font-semibold tracking-tight md:hidden">CampusConnect<span className="text-brand-600">.ai</span></Link>
          <h1 className="font-display text-4xl">{title}</h1>
          <p className="mb-8 mt-2 text-sm text-[var(--muted)]">{subtitle}</p>
          {children}
          <p className="mt-8 text-sm text-[var(--muted)]">{footer}</p>
        </div>
      </main>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const mutation = useMutation({
    mutationFn: (v: LoginValues) => post<{ token: string; user: User }>('/auth/login', v),
    onSuccess: ({ data }) => {
      login(data.token, data.user);
      navigate(data.user.role === 'student' && !data.user.onboarded ? '/onboarding' : navFor(data.user.role)[0].to);
    },
    onError: (e) => setServerError(errorMessage(e)),
  });

  return (
    <AuthShell title="Welcome back" subtitle="Log in to see your campus feed." footer={<>New here? <Link to="/register" className="font-medium text-brand-600">Create an account</Link></>}>
      <form className="space-y-4" onSubmit={handleSubmit((v) => { setServerError(''); mutation.mutate(v); })} noValidate>
        {serverError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">{serverError}</p>}
        <Field label="Email" id="email" error={errors.email?.message}>
          <input id="email" type="email" autoComplete="email" className="input" {...register('email')} />
        </Field>
        <Field label="Password" id="password" error={errors.password?.message}>
          <input id="password" type="password" autoComplete="current-password" className="input" {...register('password')} />
        </Field>
        <Button type="submit" className="w-full py-2.5" disabled={mutation.isPending}>{mutation.isPending ? 'Logging in…' : 'Log in'}</Button>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });
  const mutation = useMutation({
    mutationFn: (v: RegisterValues) => post<{ token: string; user: User }>('/auth/register', v),
    onSuccess: ({ data }) => { login(data.token, data.user); navigate('/onboarding'); },
    onError: (e) => setServerError(errorMessage(e)),
  });

  return (
    <AuthShell title="Create your student account" subtitle="Takes under a minute. You can set interests next." footer={<>Already registered? <Link to="/login" className="font-medium text-brand-600">Log in</Link></>}>
      <form className="space-y-4" onSubmit={handleSubmit((v) => { setServerError(''); mutation.mutate(v); })} noValidate>
        {serverError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">{serverError}</p>}
        <Field label="Full name" id="name" error={errors.name?.message}><input id="name" className="input" autoComplete="name" {...register('name')} /></Field>
        <Field label="College email" id="email" error={errors.email?.message}><input id="email" type="email" className="input" autoComplete="email" {...register('email')} /></Field>
        <Field label="Password" id="password" hint="At least 8 characters" error={errors.password?.message}><input id="password" type="password" className="input" autoComplete="new-password" {...register('password')} /></Field>
        <Field label="College" id="college" error={errors.college?.message}><input id="college" className="input" {...register('college')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Branch" id="branch" error={errors.branch?.message}><input id="branch" className="input" placeholder="CSE" {...register('branch')} /></Field>
          <Field label="Academic year" id="year" error={errors.year?.message}>
            <select id="year" className="input" defaultValue="" {...register('year')}>
              <option value="" disabled>Select</option>
              <option value="1">1st year</option><option value="2">2nd year</option><option value="3">3rd year</option><option value="4">4th year</option>
            </select>
          </Field>
        </div>
        <Button type="submit" className="w-full py-2.5" disabled={mutation.isPending}>{mutation.isPending ? 'Creating account…' : 'Create account'}</Button>
        <p className="text-xs text-[var(--muted)]">Coordinator and admin accounts are issued by the college administration, not through public sign-up.</p>
      </form>
    </AuthShell>
  );
}
