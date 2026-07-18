import React, { useEffect, useState } from 'react';
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../../core/services/api';
import { formatDate, downloadCsv } from '../utils';

interface AuditLogRow {
  id: number;
  category: string;
  action: string;
  actorEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: string | null;
  ip: string | null;
  createdAt: string;
}

const CATEGORY_BADGE: Record<string, string> = {
  ADMIN: 'bg-purple-50 text-purple-650 border-purple-100',
  AUTH: 'bg-amber-50 text-amber-600 border-amber-100',
  SYSTEM: 'bg-slate-50 text-slate-600 border-slate-200',
};

const ACTIONS = ['USUARIO_ELIMINADO', 'SESSION_REVOKED', 'LOGIN_FAILED', 'JOB_RUN', 'SERVER_ERROR'];

export const AdminAuditoria: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('TODAS');
  const [action, setAction] = useState('TODAS');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string | number> = { page, limit: 25 };
        if (category !== 'TODAS') params.category = category;
        if (action !== 'TODAS') params.action = action;
        if (search.trim()) params.search = search.trim();

        const res = await api.get('/admin/audit-logs', { params });
        setLogs(res.data.data || []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      } catch (err: any) {
        setError(err.response?.data?.error || 'No se pudo cargar el historial de auditoría.');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [page, category, action, search]);

  useEffect(() => {
    setPage(1);
  }, [category, action, search]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (category !== 'TODAS') params.set('category', category);
      if (action !== 'TODAS') params.set('action', action);
      if (search.trim()) params.set('search', search.trim());
      await downloadCsv(`/admin/audit-logs/export?${params.toString()}`, `auditoria-roomly-${new Date().toISOString().split('T')[0]}.csv`);
    } catch {
      setError('No se pudo exportar el historial de auditoría.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
          Auditoría ({total})
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Buscar por correo del actor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-none focus:border-purple-650 transition-colors w-56"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-none focus:border-purple-650 transition-colors"
          >
            <option value="TODAS">Todas las categorías</option>
            <option value="ADMIN">Admin</option>
            <option value="AUTH">Auth</option>
            <option value="SYSTEM">Sistema</option>
          </select>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-none focus:border-purple-650 transition-colors"
          >
            <option value="TODAS">Todas las acciones</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-650 hover:bg-purple-750 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors"
          >
            <Download size={14} />
            {exporting ? 'Exportando...' : 'Exportar CSV'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-10">Cargando historial...</p>
      ) : error ? (
        <p className="text-sm text-red-600 text-center py-10">{error}</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">No hay eventos que coincidan.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-6 py-3 font-semibold">Fecha</th>
                  <th className="px-6 py-3 font-semibold">Categoría</th>
                  <th className="px-6 py-3 font-semibold">Acción</th>
                  <th className="px-6 py-3 font-semibold">Actor</th>
                  <th className="px-6 py-3 font-semibold">Objetivo</th>
                  <th className="px-6 py-3 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                    <td className="px-6 py-3.5 text-muted-foreground whitespace-nowrap">{formatDate(log.createdAt)}</td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2 py-0.5 border text-[10px] font-bold rounded-full uppercase ${CATEGORY_BADGE[log.category] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                        {log.category}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-semibold whitespace-nowrap">{log.action}</td>
                    <td className="px-6 py-3.5 text-muted-foreground whitespace-nowrap">{log.actorEmail || '—'}</td>
                    <td className="px-6 py-3.5 text-muted-foreground whitespace-nowrap">
                      {log.targetType ? `${log.targetType} #${log.targetId}` : '—'}
                    </td>
                    <td className="px-6 py-3.5 text-muted-foreground whitespace-nowrap">{log.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
