import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import api from '../../../core/services/api';
import { formatLastActivity, formatDate } from '../utils';

interface JobStatus {
  jobName: string;
  lastRunAt: string | null;
  detail: Record<string, unknown> | null;
}

interface ErrorLog {
  id: number;
  createdAt: string;
  metadata: string | null;
}

interface Health {
  jobs: JobStatus[];
  errorCount24h: number;
  errorCount1h: number;
  recentErrors: ErrorLog[];
}

const JOB_LABELS: Record<string, string> = {
  recurring_invoices: 'Facturación recurrente',
  contract_expiration: 'Vencimiento de contratos',
};

export const AdminSalud: React.FC = () => {
  const [data, setData] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/admin/health');
        setData(res.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'No se pudo cargar el estado de salud del sistema.');
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-16">Cargando estado del sistema...</p>;
  }

  if (error || !data) {
    return <p className="text-sm text-red-600 text-center py-16">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-card flex items-center gap-4">
          {data.errorCount1h > 0 ? (
            <AlertCircle className="w-7 h-7 text-rose-600" />
          ) : (
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          )}
          <div>
            <p className="text-2xl font-black">{data.errorCount1h}</p>
            <p className="text-xs text-muted-foreground">Errores en la última hora</p>
          </div>
        </div>
        <div className="p-5 rounded-2xl border border-border bg-card flex items-center gap-4">
          {data.errorCount24h > 0 ? (
            <AlertCircle className="w-7 h-7 text-amber-600" />
          ) : (
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          )}
          <div>
            <p className="text-2xl font-black">{data.errorCount24h}</p>
            <p className="text-xs text-muted-foreground">Errores en las últimas 24h</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Jobs en segundo plano</h2>
        </div>
        <div className="divide-y divide-border">
          {data.jobs.map((job) => (
            <div key={job.jobName} className="px-6 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {job.lastRunAt ? (
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                ) : (
                  <XCircle size={16} className="text-slate-400 shrink-0" />
                )}
                <span className="text-sm font-semibold">{JOB_LABELS[job.jobName] || job.jobName}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {job.lastRunAt ? formatLastActivity(job.lastRunAt) : 'Nunca ejecutado'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Errores recientes del servidor</h2>
        </div>
        {data.recentErrors.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Sin errores registrados.</p>
        ) : (
          <div className="divide-y divide-border">
            {data.recentErrors.map((err) => (
              <div key={err.id} className="px-6 py-3.5 flex items-start justify-between gap-4">
                <p className="text-xs text-muted-foreground font-mono break-all">{err.metadata || '—'}</p>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{formatDate(err.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
