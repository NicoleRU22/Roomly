import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../features/auth/store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';
import { LayoutGrid, Building2, Users, LogOut, Menu, X, Moon, Sun, ShieldCheck } from 'lucide-react';
import logoImg from '../../../assets/logo.png';

const navItems = [
  { label: 'Resumen', path: '/admin/dashboard', icon: <LayoutGrid className="w-5 h-5" /> },
  { label: 'Tenants', path: '/admin/tenants', icon: <Building2 className="w-5 h-5" /> },
  { label: 'Usuarios', path: '/admin/usuarios', icon: <Users className="w-5 h-5" /> },
];

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const currentLabel = navItems.find(item => location.pathname.startsWith(item.path))?.label || 'Panel de administración';

  const renderNav = (onNavigate?: () => void) => (
    <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
      {navItems.map((item) => {
        const isActive = location.pathname.startsWith(item.path);
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={`flex items-center px-6 py-3.5 text-sm transition-all duration-150 active:scale-[0.98] rounded-xl ${
              isActive
                ? 'text-foreground font-extrabold bg-muted'
                : 'text-muted-foreground hover:text-foreground font-medium hover:bg-muted/40'
            }`}
          >
            <span className={`mr-3.5 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{item.icon}</span>
            <span className="flex-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-[100dvh] bg-background text-foreground font-sans overflow-hidden transition-colors duration-150">

      {/* SIDEBAR ESCRITORIO */}
      <aside className="hidden md:flex md:flex-shrink-0 flex-col w-64 border-r border-border bg-card">
        <div className="flex flex-col items-center gap-3 py-10">
          <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center bg-[#0c0a14] border border-purple-950/10 shadow-md">
            <img src={logoImg} alt="Roomly Logo" className="w-full h-full object-cover" />
          </div>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-650/10 text-purple-650 text-[10px] font-black uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            Superadmin
          </span>
        </div>
        {renderNav()}
      </aside>

      {/* SIDEBAR MÓVIL */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex flex-col w-64 max-w-xs bg-card border-r border-border">
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-transform duration-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center bg-[#0c0a14] border border-purple-950/10 shadow-sm">
                <img src={logoImg} alt="Roomly Logo" className="w-full h-full object-cover" />
              </div>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-650/10 text-purple-650 text-[10px] font-black uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                Superadmin
              </span>
            </div>
            {renderNav(() => setMobileOpen(false))}
          </aside>
        </div>
      )}

      {/* SECCIÓN PRINCIPAL */}
      <div className="flex flex-col flex-1 overflow-hidden bg-background">
        <header className="flex items-center justify-between px-8 py-5 bg-background border-b border-border shrink-0">
          <div className="flex items-center">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-1.5 -ml-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground md:hidden transition-colors mr-2 active:scale-95 duration-100"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-black text-foreground tracking-tight">{currentLabel}</h1>
          </div>
          <div className="flex items-center space-x-6 text-muted-foreground">
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg hover:bg-muted hover:text-foreground active:scale-95 transition-all duration-100"
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-600 active:scale-95 transition-all duration-100"
              title="Cerrar Sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
