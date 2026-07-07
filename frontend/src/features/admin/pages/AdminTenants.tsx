import React, { useEffect, useState } from 'react';
import api from '../../../core/services/api';
import { formatDate, formatLastActivity } from '../utils';

interface TenantRow {
  id: number;
  slug: string;
  companyName: string;
  createdAt: string;
  lastActivity: string | null;
  _count: {
    usuarios: number;
    properties: number;
    inquilinos: number;
    contratos: number;
    payments: number;
    tickets: number;
  };
}

export const AdminTenants: React.FC = () => {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTenants = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/admin/tenants');
        setTenants(res.data.tenants || []);
      } catch (err: any) {
        setError(err.response?.data?.error || 'No se pudieron cargar los tenants.');
      } finally {
        setLoading(false);
      }
    };

    fetchTenants();
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
          Tenants ({tenants.length})
        </h2>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-10">Cargando tenants...</p>
      ) : error ? (
        <p className="text-sm text-red-600 text-center py-10">{error}</p>
      ) : tenants.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">No hay tenants registrados todavía.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-6 py-3 font-semibold">Empresa</th>
                <th className="px-6 py-3 font-semibold">Slug</th>
                <th className="px-6 py-3 font-semibold">Creado</th>
                <th className="px-6 py-3 font-semibold">Última actividad</th>
                <th className="px-6 py-3 font-semibold text-right">Usuarios</th>
                <th className="px-6 py-3 font-semibold text-right">Propiedades</th>
                <th className="px-6 py-3 font-semibold text-right">Inquilinos</th>
                <th className="px-6 py-3 font-semibold text-right">Contratos</th>
                <th className="px-6 py-3 font-semibold text-right">Pagos</th>
                <th className="px-6 py-3 font-semibold text-right">Tickets</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                  <td className="px-6 py-3.5 font-semibold whitespace-nowrap">{tenant.companyName}</td>
                  <td className="px-6 py-3.5 text-muted-foreground whitespace-nowrap">{tenant.slug}</td>
                  <td className="px-6 py-3.5 text-muted-foreground whitespace-nowrap">{formatDate(tenant.createdAt)}</td>
                  <td className="px-6 py-3.5 text-muted-foreground whitespace-nowrap">
                    {tenant.lastActivity ? formatLastActivity(tenant.lastActivity) : <span className="text-slate-400">Nunca</span>}
                  </td>
                  <td className="px-6 py-3.5 text-right">{tenant._count.usuarios}</td>
                  <td className="px-6 py-3.5 text-right">{tenant._count.properties}</td>
                  <td className="px-6 py-3.5 text-right">{tenant._count.inquilinos}</td>
                  <td className="px-6 py-3.5 text-right">{tenant._count.contratos}</td>
                  <td className="px-6 py-3.5 text-right">{tenant._count.payments}</td>
                  <td className="px-6 py-3.5 text-right">{tenant._count.tickets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
