import { Bell, CalendarCheck2, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/date';
import type { NotificationItem } from '../types';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);

  const loadNotifications = async () => {
    if (!user) return;
    try {
      const res = await api.notifications.list();
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch {
      // Non-blocking notification fetch
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, [user, location.pathname]);

  const handleMarkAllRead = async () => {
    await api.notifications.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinkClass = (path: string) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
      location.pathname === path
        ? 'bg-brand-50 text-brand-700'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
              <CalendarCheck2 className="h-5 w-5" />
            </span>
            <span>Schedulr</span>
          </Link>

          {user && (
            <nav className="hidden items-center gap-1 sm:flex">
              {user.role === 'CLIENT' && (
                <>
                  <Link to="/book" className={navLinkClass('/book')}>
                    Book Appointment
                  </Link>
                  <Link to="/appointments" className={navLinkClass('/appointments')}>
                    My Appointments
                  </Link>
                </>
              )}
              {user.role === 'PROVIDER' && (
                <Link to="/provider" className={navLinkClass('/provider')}>
                  Provider Portal
                </Link>
              )}
              {user.role === 'ADMIN' && (
                <>
                  <Link to="/admin" className={navLinkClass('/admin')}>
                    Admin Console
                  </Link>
                  <Link to="/book" className={navLinkClass('/book')}>
                    Book View
                  </Link>
                </>
              )}
            </nav>
          )}
        </div>

        {user ? (
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                  <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-sm font-semibold text-slate-800">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="py-4 text-center text-xs text-slate-500">
                        No notifications yet
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`rounded-lg p-2.5 text-xs ${
                            n.isRead ? 'bg-slate-50 text-slate-600' : 'bg-brand-50 text-slate-900'
                          }`}
                        >
                          <p className="font-medium">{n.message}</p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {formatDateTime(n.createdAt, user.timezone)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-800">{user.name}</p>
              <p className="text-xs text-slate-500">
                {user.role} · {user.timezone}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}

