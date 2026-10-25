import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Compass, Ticket, Bookmark, Bell, Bot, Users, User, Settings,
  Megaphone, CalendarDays, BarChart3, ShieldCheck, LogOut, Menu, X, Sparkles,
  Building2, Flag, ClipboardList, Briefcase,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useQuery } from '@tanstack/react-query';
import { get } from '../lib/api';

type Item = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean };

const STUDENT_NAV: Item[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/opportunities', label: 'Opportunities', icon: Compass },
  { to: '/registrations', label: 'My registrations', icon: Ticket },
  { to: '/saved', label: 'Saved', icon: Bookmark },
  { to: '/placements', label: 'Placement drives', icon: Briefcase },
  { to: '/applications', label: 'Applications', icon: ClipboardList },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/assistant', label: 'CampusBot', icon: Bot },
  { to: '/clubs', label: 'Clubs', icon: Users },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const COORD_NAV: Item[] = [
  { to: '/coordinator/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/coordinator/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/coordinator/announcements/new', label: 'Create with AI', icon: Sparkles },
  { to: '/coordinator/events', label: 'Events', icon: CalendarDays },
  { to: '/coordinator/clubs', label: 'My clubs', icon: Building2 },
  { to: '/coordinator/analytics', label: 'Analytics', icon: BarChart3 },
];

const ADMIN_NAV: Item[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users & roles', icon: Users },
  { to: '/admin/clubs', label: 'Clubs', icon: Building2 },
  { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/admin/moderation', label: 'Moderation', icon: Flag },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/settings', label: 'Audit log', icon: ShieldCheck },
];

export function navFor(role: string | undefined): Item[] {
  if (role === 'admin') return ADMIN_NAV;
  if (role === 'coordinator') return COORD_NAV;
  return STUDENT_NAV;
}

function NavList({ items, onNavigate }: { items: Item[]; onNavigate?: () => void }) {
  return (
    <ul className="space-y-1">
      {items.map(({ to, label, icon: Icon, end }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${isActive ? 'bg-brand-100 font-medium text-brand-900 dark:bg-brand-900/40 dark:text-brand-100' : 'text-[var(--muted)] hover:bg-black/5 dark:hover:bg-white/5'}`
            }
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white" aria-hidden>
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="leading-tight">
        <p className="font-semibold">CampusConnect<span className="text-brand-600">.ai</span></p>
        <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Your very own campus buddy</p>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const items = navFor(user?.role);
  const unread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => get<unknown[]>('/notifications?limit=1'),
    enabled: user?.role === 'student',
    refetchInterval: 60_000,
  });
  const unreadCount = (unread.data?.meta?.unread as number | undefined) ?? 0;

  useEffect(() => { setOpen(false); }, [user?.role]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:p-2">Skip to content</a>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r p-4 md:flex" style={{ borderColor: 'var(--border)' }}>
        <div className="mb-6 px-2"><Brand /></div>
        <nav aria-label="Main">
          <NavList items={items} />
        </nav>
        <div className="mt-auto space-y-2 pt-6">
          <div className="rounded-lg px-3 py-2 text-xs text-[var(--muted)]">
            Signed in as <span className="font-medium text-[var(--text)]">{user?.name}</span>
            <br />{user?.role}
          </div>
          <button type="button" onClick={handleLogout} className="btn-ghost w-full justify-start"><LogOut className="h-4 w-4" aria-hidden />Log out</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-[var(--bg)]/95 px-4 py-3 backdrop-blur md:hidden" style={{ borderColor: 'var(--border)' }}>
          <Brand />
          <div className="flex items-center gap-1">
            {user?.role === 'student' && (
              <NavLink to="/notifications" className="btn-ghost relative" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}>
                <Bell className="h-5 w-5" aria-hidden />
                {unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand-500" aria-hidden />}
              </NavLink>
            )}
            <button type="button" className="btn-ghost" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((v) => !v)}>
              {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </header>
        {open && (
          <div id="mobile-menu" className="border-b p-3 md:hidden" style={{ borderColor: 'var(--border)' }}>
            <nav aria-label="Main mobile"><NavList items={items} onNavigate={() => setOpen(false)} /></nav>
            <button type="button" onClick={handleLogout} className="btn-ghost mt-2 w-full justify-start"><LogOut className="h-4 w-4" aria-hidden />Log out</button>
          </div>
        )}

        <main id="main" className="flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10 lg:px-10">
          <Outlet />
        </main>

        {/* Mobile bottom navigation for students */}
        {user?.role === 'student' && (
          <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-[var(--surface)] py-1 md:hidden" style={{ borderColor: 'var(--border)' }}>
            {[
              { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
              { to: '/opportunities', label: 'Explore', icon: Compass },
              { to: '/registrations', label: 'Registered', icon: Ticket },
              { to: '/profile', label: 'Profile', icon: User },
            ].map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? 'text-brand-600 font-medium' : 'text-[var(--muted)]'}`}>
                <Icon className="h-5 w-5" aria-hidden />{label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8"><div className="skeleton h-40 w-full" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={navFor(user.role)[0].to} replace />;
  if (user.role === 'student' && !user.onboarded && !window.location.pathname.startsWith('/onboarding') && !window.location.pathname.startsWith('/profile')) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}
