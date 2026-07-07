import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../core/services/api';
import { formatDate, formatLastActivity } from '../utils';

interface UsuarioRow {
  id: number;
  email: string;
  firstName: string;
  lastName: string | null;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  tenant: { slug: string; companyName: string } | null;
}

const ROLE_BADGE: Record<string, string> = {
  ADMIN: 'bg-purple-50 text-purple-650 border-purple-100',
  PROPIETARIO: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  INQUILINO: 'bg-emerald-50 text-emerald-600 border-emerald-100',
};

export const AdminUsuarios: React.FC = () => {
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('TODOS');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchUsuarios = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/admin/usuarios');
        setUsuarios(res.data.usuarios || []);
      } catch (err: any) {
        setError(err.response?.data?.error || 'No se pudieron cargar los usuarios.');
      } finally {
        setLoading(false);
      }
    };

    fetchUsuarios();
  }, []);

  const filtered = useMemo(() => {
    return usuarios.filter((u) => {
      const matchesRole = roleFilter === 'TODOS' || u.role === roleFilter;
      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        u.email.toLowerCase().includes(term) ||
        u.firstName.toLowerCase().includes(term) ||
        (u.tenant?.companyName || '').toLowerCase().includes(term);
      return matchesRole && matchesSearch;
    });
  }, [usuarios, roleFilter, search]);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
          Usuarios ({filtered.length})
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Buscar por nombre, correo o empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-none focus:border-purple-650 transition-colors w-56"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-none focus:border-purple-650 transition-colors"
          >
            <option value="TODOS">Todos los roles</option>
            <option value="ADMIN">Admin</option>
            <option value="PROPIETARIO">Propietario</option>
            <option value="INQUILINO">Inquilino</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-10">Cargando usuarios...</p>
      ) : error ? (
        <p className="text-sm text-red-600 text-center py-10">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">No hay usuarios que coincidan.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-6 py-3 font-semibold">Nombre</th>
                <th className="px-6 py-3 font-semibold">Correo</th>
                <th className="px-6 py-3 font-semibold">Rol</th>
                <th className="px-6 py-3 font-semibold">Empresa</th>
                <th className="px-6 py-3 font-semibold">Verificado</th>
                <th className="px-6 py-3 font-semibold">Último acceso</th>
                <th className="px-6 py-3 font-semibold">Creado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                  <td className="px-6 py-3.5 font-semibold whitespace-nowrap">
                    {u.firstName} {u.lastName || ''}
                  </td>
                  <td className="px-6 py-3.5 text-muted-foreground whitespace-nowrap">{u.email}</td>
                  <td className="px-6 py-3.5">
                    <span className={`px-2 py-0.5 border text-[10px] font-bold rounded-full uppercase ${ROLE_BADGE[u.role] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-muted-foreground whitespace-nowrap">
                    {u.tenant ? u.tenant.companyName : '—'}
                  </td>
                  <td className="px-6 py-3.5">
                    {u.emailVerified ? (
                      <span className="text-emerald-600 text-xs font-bold">Sí</span>
                    ) : (
                      <span className="text-amber-600 text-xs font-bold">No</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-muted-foreground whitespace-nowrap">
                    {u.lastLoginAt ? formatLastActivity(u.lastLoginAt) : <span className="text-slate-400">Nunca</span>}
                  </td>
                  <td className="px-6 py-3.5 text-muted-foreground whitespace-nowrap">{formatDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
