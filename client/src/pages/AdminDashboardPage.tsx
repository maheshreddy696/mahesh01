import { BarChart3, Briefcase, CalendarCheck, Plus, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AppointmentDetailModal } from '../components/AppointmentDetailModal';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { formatCurrency, formatDateTime } from '../lib/date';
import type { AdminMetrics, Appointment, Provider, Service } from '../types';

export function AdminDashboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'overview' | 'services' | 'providers' | 'appointments'>(
    'overview'
  );
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  // New Service form
  const [svcName, setSvcName] = useState('');
  const [svcDesc, setSvcDesc] = useState('');
  const [svcDuration, setSvcDuration] = useState(30);
  const [svcBuffer, setSvcBuffer] = useState(0);
  const [svcPriceDollars, setSvcPriceDollars] = useState(75);
  const [svcProviderIds, setSvcProviderIds] = useState<string[]>([]);

  // New Provider form
  const [provName, setProvName] = useState('');
  const [provEmail, setProvEmail] = useState('');
  const [provPassword, setProvPassword] = useState('Password123!');
  const [provTitle, setProvTitle] = useState('');
  const [provSpecialty, setProvSpecialty] = useState('');
  const [provServiceIds, setProvServiceIds] = useState<string[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [m, s, p, a] = await Promise.all([
        api.admin.metrics(),
        api.services.list(true),
        api.providers.list(),
        api.appointments.list({ scope: 'all' }),
      ]);
      setMetrics(m);
      setServices(s.services);
      setProviders(p.providers);
      setAppointments(a.appointments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin console');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.services.create({
        name: svcName,
        description: svcDesc,
        durationMinutes: Number(svcDuration),
        bufferMinutes: Number(svcBuffer),
        priceCents: Math.round(Number(svcPriceDollars) * 100),
        providerIds: svcProviderIds,
      });
      setSvcName('');
      setSvcDesc('');
      setSvcProviderIds([]);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create service');
    }
  };

  const handleToggleService = async (service: Service) => {
    try {
      await api.services.update(service.id, { isActive: !service.isActive });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update service');
    }
  };

  const handleCreateProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.providers.create({
        name: provName,
        email: provEmail,
        password: provPassword,
        timezone: user?.timezone || 'UTC',
        title: provTitle,
        specialty: provSpecialty,
        bio: '',
        serviceIds: provServiceIds,
      });
      setProvName('');
      setProvEmail('');
      setProvTitle('');
      setProvSpecialty('');
      setProvServiceIds([]);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create provider');
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Console</h1>
          <p className="text-sm text-slate-600">
            Manage services, providers, utilization metrics, and all appointments.
          </p>
        </div>

        <div className="flex flex-wrap rounded-xl bg-slate-100 p-1">
          {[
            { id: 'overview', label: 'Analytics' },
            { id: 'services', label: 'Services' },
            { id: 'providers', label: 'Providers' },
            { id: 'appointments', label: 'Appointments' },
          ].map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setTab(item.id as typeof tab)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                tab === item.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-500">Loading admin console...</p>
      ) : tab === 'overview' && metrics ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase">Total Bookings</span>
                <CalendarCheck className="h-4 w-4 text-brand-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {metrics.summary.totalAppointments}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase">Est. Revenue</span>
                <BarChart3 className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatCurrency(metrics.summary.estimatedRevenueCents)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase">Active Providers</span>
                <Users className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {metrics.summary.activeProviders}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase">Active Services</span>
                <Briefcase className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {metrics.summary.activeServices}
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-slate-900">Top Providers</h2>
              <div className="space-y-3">
                {metrics.topProviders.map((row) => (
                  <div key={row.name} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800">{row.name}</span>
                    <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-700">
                      {row.count} bookings
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-slate-900">Top Services</h2>
              <div className="space-y-3">
                {metrics.topServices.map((row) => (
                  <div key={row.name} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800">{row.name}</span>
                    <span className="text-slate-600">
                      {row.count} bookings · {formatCurrency(row.revenueCents)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : tab === 'services' ? (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <form
            onSubmit={handleCreateService}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="mb-4 flex items-center gap-1.5 text-base font-semibold text-slate-900">
              <Plus className="h-4 w-4 text-brand-600" />
              Add Service
            </h2>
            <div className="space-y-3">
              <input
                type="text"
                required
                value={svcName}
                onChange={(e) => setSvcName(e.target.value)}
                placeholder="Service Name"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <textarea
                rows={2}
                value={svcDesc}
                onChange={(e) => setSvcDesc(e.target.value)}
                placeholder="Description"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-slate-500">Duration (m)</label>
                  <input
                    type="number"
                    min={10}
                    max={480}
                    value={svcDuration}
                    onChange={(e) => setSvcDuration(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Buffer (m)</label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={svcBuffer}
                    onChange={(e) => setSvcBuffer(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Price ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={svcPriceDollars}
                    onChange={(e) => setSvcPriceDollars(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">Assign Providers</p>
                <div className="space-y-1">
                  {providers.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={svcProviderIds.includes(p.id)}
                        onChange={(e) =>
                          setSvcProviderIds((prev) =>
                            e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                          )
                        }
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Create Service
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {services.map((svc) => (
              <div
                key={svc.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{svc.name}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        svc.isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {svc.isActive ? 'Active' : 'Archived'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {svc.durationMinutes} min · Buffer {svc.bufferMinutes} min ·{' '}
                    {formatCurrency(svc.priceCents)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleService(svc)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {svc.isActive ? 'Disable' : 'Activate'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : tab === 'providers' ? (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <form
            onSubmit={handleCreateProvider}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="mb-4 flex items-center gap-1.5 text-base font-semibold text-slate-900">
              <Plus className="h-4 w-4 text-brand-600" />
              Add Provider
            </h2>
            <div className="space-y-3">
              <input
                type="text"
                required
                value={provName}
                onChange={(e) => setProvName(e.target.value)}
                placeholder="Full Name"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="email"
                required
                value={provEmail}
                onChange={(e) => setProvEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="password"
                required
                minLength={8}
                value={provPassword}
                onChange={(e) => setProvPassword(e.target.value)}
                placeholder="Temporary Password"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                required
                value={provTitle}
                onChange={(e) => setProvTitle(e.target.value)}
                placeholder="Title (e.g., Lead Consultant)"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                required
                value={provSpecialty}
                onChange={(e) => setProvSpecialty(e.target.value)}
                placeholder="Specialty"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">Assigned Services</p>
                <div className="space-y-1">
                  {services
                    .filter((s) => s.isActive)
                    .map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={provServiceIds.includes(s.id)}
                          onChange={(e) =>
                            setProvServiceIds((prev) =>
                              e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                            )
                          }
                        />
                        {s.name}
                      </label>
                    ))}
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Create Provider
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {providers.map((prov) => (
              <div
                key={prov.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{prov.name}</h3>
                    <p className="text-xs text-slate-500">
                      {prov.title} · {prov.specialty} · {prov.timezone}
                    </p>
                  </div>
                  <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                    {prov.services.length} services
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Ref</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {appointments.map((appt) => (
                <tr key={appt.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {appt.referenceCode}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{appt.client.name}</td>
                  <td className="px-4 py-3 text-slate-600">{appt.provider.name}</td>
                  <td className="px-4 py-3 text-slate-600">{appt.service.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDateTime(appt.startUtc, user?.timezone)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={appt.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setDetailId(appt.id)}
                      className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                    >
                      Track
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailId && (
        <AppointmentDetailModal
          appointmentId={detailId}
          timezone={user?.timezone}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

