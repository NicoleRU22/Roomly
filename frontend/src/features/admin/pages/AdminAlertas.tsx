import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import api from '../../../core/services/api';
import { formatLastActivity } from '../utils';

interface AlertRow {
  email: string;
  totalAttempts: number;
  attemptsLast15Min: number;
  distinctIps: number;
  lastAttempt: string;
}

export const AdminAlertas: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [windowHours, setWindowHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlerts = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/admin/alerts');
        setAlerts(res.data.alerts || []);
        setWindowHours(res.data.windowHours || 24);
      } catch (err: any) {
        setError(err.response?.data?.error || 'No se pudieron cargar las alertas.');
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
          Alertas de seguridad ({alerts.length})
        </h2>
        <span className="text-xs text-muted-foreground">Últimas {windowHours}h</span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-10">Cargando alertas...</p>
      ) : error ? (
        <p className="text-sm text-red-600 text-center py-10">{error}</p>
      ) : alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">Sin actividad sospechosa en las últimas {windowHours} horas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-6 py-3 font-semibold">Correo</th>
                <th className="px-6 py-3 font-semibold text-right">Intentos totales</th>
                <th className="px-6 py-3 font-semibold text-right">Últimos 15 min</th>
                <th className="px-6 py-3 font-semibold text-right">IPs distintas</th>
                <th className="px-6 py-3 font-semibold">Último intento</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.email} className="border-t border-border hover:bg-muted/40 transition-colors">
                  <td className="px-6 py-3.5 font-semibold whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      <ShieldAlert size={15} className="text-rose-600 shrink-0" />
                      {a.email}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right font-bold text-rose-600">{a.totalAttempts}</td>
                  <td className="px-6 py-3.5 text-right">{a.attemptsLast15Min}</td>
                  <td className="px-6 py-3.5 text-right">{a.distinctIps}</td>
                  <td className="px-6 py-3.5 text-muted-foreground whitespace-nowrap">{formatLastActivity(a.lastAttempt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
