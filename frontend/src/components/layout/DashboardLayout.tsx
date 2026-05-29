import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';
import { 
  Home, 
  LayoutGrid,
  Users, 
  LogOut, 
  Menu, 
  X,
  Bell,
  DollarSign,
  FileText,
  Moon,
  Sun,
  Settings
} from 'lucide-react';
import logoImg from '../../assets/logo.png';

export const DashboardLayout: React.FC = () => {
  const { tenant, logout, user } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Panel de control', path: `/${tenant?.slug}/dashboard`, icon: <LayoutGrid className="w-5 h-5" /> },
    ...(user?.role !== 'INQUILINO' ? [
      { label: 'Propiedades', path: `/${tenant?.slug}/propiedades`, icon: <Home className="w-5 h-5" /> },
      { label: 'Inquilinos', path: `/${tenant?.slug}/inquilinos`, icon: <Users className="w-5 h-5" /> }
    ] : []),
    { label: 'Pagos', path: `/${tenant?.slug}/pagos`, icon: <DollarSign className="w-5 h-5" /> },
    { label: 'Contratos', path: `/${tenant?.slug}/contratos`, icon: <FileText className="w-5 h-5" /> },
  ];

  const currentLabel = navItems.find(item => location.pathname.startsWith(item.path))?.label || 'Panel de control';

  // Guardar acceso a rutas administrativas si es inquilino
  const isLandlordRoute = 
    location.pathname.endsWith('/propiedades') || 
    location.pathname.includes('/propiedades/') || 
    location.pathname.endsWith('/inquilinos') || 
    location.pathname.endsWith('/servicios');

  if (user?.role === 'INQUILINO' && isLandlordRoute) {
    return <Navigate to={`/${tenant?.slug}/dashboard`} replace />;
  }

  return (
    <div className="flex h-[100dvh] bg-background text-foreground font-sans overflow-hidden transition-colors duration-150">
      
      {/* SIDEBAR ESCRITORIO */}
      <aside className="hidden md:flex md:flex-shrink-0 flex-col w-64 border-r border-border bg-card">
        
        {/* Header Sidebar: Logo Oficial Centrado y Ampliado */}
        <div className="flex justify-center items-center py-10">
          <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center bg-[#0c0a14] border border-purple-950/10 shadow-md">
            <img src={logoImg} alt="Roomly Logo" className="w-full h-full object-cover" />
          </div>
        </div>

        {/* Items Navegación en Vertical */}
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-6 py-3.5 text-sm transition-all duration-150 active:scale-[0.98] rounded-xl ${
                  isActive 
                    ? 'text-foreground font-extrabold bg-muted' 
                    : 'text-muted-foreground hover:text-foreground font-medium hover:bg-muted/40'
                }`}
              >
                <span className={`mr-3.5 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* SIDEBAR MÓVIL */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          
          <aside className="relative flex flex-col w-64 max-w-xs bg-card border-r border-border">
            {/* Botón cerrar */}
            <div className="absolute top-4 right-4">
              <button 
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-transform duration-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-center items-center py-8">
              <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center bg-[#0c0a14] border border-purple-950/10 shadow-sm">
                <img src={logoImg} alt="Roomly Logo" className="w-full h-full object-cover" />
              </div>
            </div>

            <nav className="flex-1 px-3 space-y-2 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center px-6 py-3.5 text-sm rounded-xl transition-all duration-150 active:scale-[0.98] ${
                      isActive 
                        ? 'text-foreground font-extrabold bg-muted' 
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    <span className={`mr-3.5 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* SECCIÓN PRINCIPAL */}
      <div className="flex flex-col flex-1 overflow-hidden bg-background">
        
        {/* TOPBAR / HEADER DE LA PÁGINA (ESTILO FIGMA) */}
        <header className="flex items-center justify-between px-8 py-5 bg-background border-b border-border shrink-0">
          <div className="flex items-center">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-1.5 -ml-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground md:hidden transition-colors mr-2 active:scale-95 duration-100"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-black text-foreground tracking-tight">
              {currentLabel}
            </h1>
          </div>
          <div className="flex items-center space-x-6 text-muted-foreground">
            <button 
              onClick={toggleTheme}
              className="p-1.5 rounded-lg hover:bg-muted hover:text-foreground active:scale-95 transition-all duration-100" 
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button className="p-1.5 rounded-lg hover:bg-muted hover:text-foreground active:scale-95 transition-all duration-100 relative" title="Notificaciones">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-purple-650 rounded-full" />
            </button>
            <button className="p-1.5 rounded-lg hover:bg-muted hover:text-foreground active:scale-95 transition-all duration-100" title="Configuración">
              <Settings className="w-5 h-5" />
            </button>
            <button 
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-600 active:scale-95 transition-all duration-100"
              title="Cerrar Sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL SCROLLABLE */}
        <main className="flex-1 overflow-y-auto p-8 bg-background">
          <Outlet />
        </main>
      </div>

    </div>
  );
};
