import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Users, Home, FileCheck, Clock, UserCheck } from 'lucide-react';
import api from '../../../core/services/api';
import { formatDate } from '../utils';
import { GrowthChart } from '../components/GrowthChart';

interface Overview {
  tenantCount: number;
  usuarioCount: number;
  roleCounts: Record<string, number>;
  propertyCount: number;
  inquilinoActivosCount: number;
  contratoActivosCount: number;
  pagosPendientesCount: number;
  recentTenants: { id: number; slug: string; companyName: string; createdAt: string }[];
}

interface GrowthPoint {
  weekStart: string;
  newTenants: number;
  newUsuarios: number;
}

const ROLE_LABELS: Record<string, string> = {
  PROPIETARIO: 'Propietarios',
  INQUILINO: 'Inquilinos',
  ADMIN: 'Admins',
};

export const AdminOverview: React.FC = () => {
  const [data, setData] = useState<Overview | null>(null);
  const [growth, setGrowth] = useState<GrowthPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOverview = async () => {
      setLoading(true);
      setError(null);
      try {
        const [overviewRes, growthRes] = await Promise.all([
          api.get('/admin/overview'),
          api.get('/admin/growth')
        ]);
        setData(overviewRes.data);
        setGrowth(growthRes.data.series || []);
      } catch (err: any) {
        setError(err.response?.data?.error || 'No se pudo cargar el resumen de la plataforma.');
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-16">Cargando resumen...</p>;
  }

  if (error || !data) {
    return <p className="text-sm text-red-600 text-center py-16">{error}</p>;
  }

  const cards = [
    { label: 'Empresas (tenants)', value: data.tenantCount, icon: <Building2 className="w-7 h-7 text-purple-650" /> },
    { label: 'Usuarios totales', value: data.usuarioCount, icon: <Users className="w-7 h-7 text-purple-650" /> },
    { label: 'Propiedades', value: data.propertyCount, icon: <Home className="w-7 h-7 text-purple-650" /> },
    { label: 'Inquilinos activos', value: data.inquilinoActivosCount, icon: <UserCheck className="w-7 h-7 text-purple-650" /> },
    { label: 'Contratos vigentes', value: data.contratoActivosCount, icon: <FileCheck className="w-7 h-7 text-purple-650" /> },
    { label: 'Pagos pendientes', value: data.pagosPendientesCount, icon: <Clock className="w-7 h-7 text-purple-650" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="p-5 rounded-2xl border border-border bg-card flex items-center gap-4">
            {card.icon}
            <div>
              <p className="text-2xl font-black">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
            Crecimiento (últimas {growth.length} semanas)
          </h2>
        </div>
        <div className="p-6">
          {growth.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sin datos de crecimiento todavía.</p>
          ) : (
            <GrowthChart series={growth} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Tenants recientes</h2>
            <Link to="/admin/tenants" className="text-xs font-bold text-purple-650 hover:underline">Ver todos</Link>
          </div>
          <div className="divide-y divide-border">
            {data.recentTenants.map((tenant) => (
              <div key={tenant.id} className="px-6 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{tenant.companyName}</p>
                  <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(tenant.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Usuarios por rol</h2>
          </div>
          <div className="divide-y divide-border">
            {Object.entries(data.roleCounts).map(([role, count]) => (
              <div key={role} className="px-6 py-3.5 flex items-center justify-between">
                <span className="text-sm font-semibold">{ROLE_LABELS[role] || role}</span>
                <span className="text-sm font-black">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
