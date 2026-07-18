import React, { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import api from '../../../core/services/api';
import { ConfirmModal } from '../../../core/components/ui/ConfirmModal';
import { formatLastActivity } from '../utils';

interface SessionRow {
  id: number;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  usuario: {
    id: number;
    email: string;
    firstName: string;
    lastName: string | null;
    role: string;
    tenant: { slug: string; companyName: string } | null;
  };
}

const ROLE_BADGE: Record<string, string> = {
  ADMIN: 'bg-purple-50 text-purple-650 border-purple-100',
  PROPIETARIO: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  INQUILINO: 'bg-emerald-50 text-emerald-600 border-emerald-100',
};

export const AdminSesiones: React.FC = () => {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<SessionRow | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/sessions');
      setSessions(res.data.sessions || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudieron cargar las sesiones activas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      await api.post(`/admin/sessions/${revokeTarget.id}/revoke`);
      setSessions((prev) => prev.filter((s) => s.id !== revokeTarget.id));
      setRevokeTarget(null);
    } catch (err: any) {
      setRevokeError(err.response?.data?.error || 'No se pudo revocar la sesión.');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
          Sesiones activas ({sessions.length})
        </h2>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-10">Cargando sesiones...</p>
      ) : error ? (
        <p className="text-sm text-red-600 text-center py-10">{error}</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">No hay sesiones activas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-6 py-3 font-semibold">Usuario</th>
                <th className="px-6 py-3 font-semibold">Rol</th>
                <th className="px-6 py-3 font-semibold">Empresa</th>
                <th className="px-6 py-3 font-semibold">IP</th>
                <th className="px-6 py-3 font-semibold">Última actividad</th>
                <th className="px-6 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <p className="font-semibold">{s.usuario.firstName} {s.usuario.lastName || ''}</p>
                    <p className="text-xs text-muted-foreground">{s.usuario.email}</p>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`px-2 py-0.5 border text-[10px] font-bold rounded-full uppercase ${ROLE_BADGE[s.usuario.role] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                      {s.usuario.role}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-muted-foreground whitespace-nowrap">
                    {s.usuario.tenant ? s.usuario.tenant.companyName : '—'}
                  </td>
                  <td className="px-6 py-3.5 text-muted-foreground whitespace-nowrap">{s.ip || '—'}</td>
                  <td className="px-6 py-3.5 text-muted-foreground whitespace-nowrap">{formatLastActivity(s.lastSeenAt)}</td>
                  <td className="px-6 py-3.5 text-right">
                    <button
                      onClick={() => setRevokeTarget(s)}
                      title="Revocar sesión"
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <LogOut size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        isOpen={!!revokeTarget}
        title="Revocar sesión"
        message={
          `¿Seguro que quieres revocar la sesión de ${revokeTarget?.usuario.firstName || ''} (${revokeTarget?.usuario.email})? La próxima petición con ese token será rechazada y deberá iniciar sesión de nuevo.` +
          (revokeError ? `\n\n⚠ ${revokeError}` : '')
        }
        confirmText={revoking ? 'Revocando...' : 'Revocar'}
        isDestructive
        onConfirm={handleRevoke}
        onCancel={() => {
          setRevokeTarget(null);
          setRevokeError(null);
        }}
      />
    </div>
  );
};
