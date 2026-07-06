import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../../features/auth/store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';
import { useNotifications } from '../../../features/notificaciones/useNotifications';
import { useUnreadMensajesCount } from '../../../features/mensajes/useMensajes';
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
  Settings,
  Wrench,
  Layers,
  MessageCircle
} from 'lucide-react';
import logoImg from '../../../assets/logo.png';

const NOTIF_BADGE: Record<string, { label: string; className: string }> = {
  PAGO_GENERADO: { label: 'Pagos', className: 'bg-purple-50 text-purple-650 border-purple-100' },
  PAGO_APROBADO: { label: 'Pagos', className: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  PAGO_RECHAZADO: { label: 'Pagos', className: 'bg-rose-50 text-rose-600 border-rose-100' },
  COMPROBANTE_PENDIENTE: { label: 'Validar', className: 'bg-indigo-50 text-indigo-650 border-indigo-100' },
  CONTRATO_PENDIENTE: { label: 'Contratos', className: 'bg-rose-50 text-rose-600 border-rose-100' },
  CONTRATO_FIRMADO: { label: 'Contratos', className: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  TICKET_CREADO: { label: 'Avería', className: 'bg-amber-50 text-amber-600 border-amber-100' },
  TICKET_ACTUALIZADO: { label: 'Tickets', className: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
};

const formatRelativeTime = (dateStr: string) => {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `Hace ${diffD}d`;
};

export const DashboardLayout: React.FC = () => {
  const { tenant, logout, user } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead } = useNotifications();
  const { unreadCount: unreadMensajesCount } = useUnreadMensajesCount();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleToggleNotifications = () => {
    if (!showNotifications) fetchNotifications();
    setShowNotifications(!showNotifications);
  };

  const handleNotificationClick = (notif: { id: number; isRead: boolean; link?: string }) => {
    if (!notif.isRead) markAsRead(notif.id);
    if (notif.link) {
      navigate(`/${tenant?.slug}${notif.link}`);
      setShowNotifications(false);
    }
  };

  const navItems = [
    { label: 'Panel de control', path: `/${tenant?.slug}/dashboard`, icon: <LayoutGrid className="w-5 h-5" /> },
    ...(user?.role !== 'INQUILINO' ? [
      { label: 'Propiedades', path: `/${tenant?.slug}/propiedades`, icon: <Home className="w-5 h-5" /> },
      { label: 'Inquilinos', path: `/${tenant?.slug}/inquilinos`, icon: <Users className="w-5 h-5" /> },
      { label: 'Servicios', path: `/${tenant?.slug}/servicios`, icon: <Layers className="w-5 h-5" /> }
    ] : []),
    { label: 'Pagos', path: `/${tenant?.slug}/pagos`, icon: <DollarSign className="w-5 h-5" /> },
    { label: 'Contratos', path: `/${tenant?.slug}/contratos`, icon: <FileText className="w-5 h-5" /> },
    { label: 'Mantenimiento', path: `/${tenant?.slug}/mantenimiento`, icon: <Wrench className="w-5 h-5" /> },
    { label: 'Mensajes', path: `/${tenant?.slug}/mensajes`, icon: <MessageCircle className="w-5 h-5" />, badge: unreadMensajesCount },
  ];

  const currentLabel = navItems.find(item => location.pathname.startsWith(item.path))?.label || 'Panel de control';

  // Guardar acceso a rutas administrativas si es inquilino
  const isLandlordRoute =
    location.pathname.endsWith('/propiedades') ||
    location.pathname.includes('/propiedades/') ||
    location.pathname.endsWith('/inquilinos') ||
    location.pathname.endsWith('/servicios') ||
    location.pathname.endsWith('/configuracion');

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
                <span className="flex-1">{item.label}</span>
                {!!item.badge && (
                  <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-purple-650 rounded-full text-[9px] font-black text-white leading-none">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
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
                    <span className="flex-1">{item.label}</span>
                    {!!item.badge && (
                      <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-purple-650 rounded-full text-[9px] font-black text-white leading-none">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
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
            <div className="relative">
              <button
                onClick={handleToggleNotifications}
                className={`p-1.5 rounded-lg hover:bg-muted hover:text-foreground active:scale-95 transition-all duration-100 relative ${showNotifications ? 'bg-muted text-foreground' : ''}`}
                title="Notificaciones"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-0.5 flex items-center justify-center bg-purple-650 border-2 border-background rounded-full text-[8px] font-black text-white leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 mt-3 w-80 bg-card border border-border rounded-2xl shadow-xl z-45 p-4 space-y-3 animate-modal-in">
                    <div className="flex justify-between items-center pb-2 border-b border-border">
                      <span className="text-xs font-black text-foreground uppercase tracking-wider">Notificaciones</span>
                      <div className="flex items-center gap-3">
                        {notifications.some(n => !n.isRead) && (
                          <button
                            onClick={markAllAsRead}
                            className="text-[10px] font-bold text-purple-650 hover:underline"
                          >
                            Marcar todas
                          </button>
                        )}
                        <button
                          onClick={() => setShowNotifications(false)}
                          className="text-[10px] font-bold text-muted-foreground hover:underline"
                        >
                          Cerrar
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {notifications.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground text-center py-6">No tienes notificaciones.</p>
                      ) : (
                        notifications.map(notif => {
                          const badge = NOTIF_BADGE[notif.type] || { label: 'General', className: 'bg-slate-50 text-slate-600 border-slate-100' };
                          return (
                            <div
                              key={notif.id}
                              onClick={() => handleNotificationClick(notif)}
                              className={`p-2.5 hover:bg-muted/50 rounded-xl transition-colors border border-border space-y-1 cursor-pointer ${!notif.isRead ? 'bg-purple-50/40 dark:bg-purple-500/5' : ''}`}
                            >
                              <div className="flex justify-between items-center">
                                <span className={`px-2 py-0.5 border text-[8px] font-bold rounded-full uppercase ${badge.className}`}>{badge.label}</span>
                                <span className="text-[9px] text-slate-400 font-medium">{formatRelativeTime(notif.createdAt)}</span>
                              </div>
                              <p className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                                {!notif.isRead && <span className="w-1.5 h-1.5 rounded-full bg-purple-650 shrink-0" />}
                                {notif.title}
                              </p>
                              <p className="text-[10px] text-muted-foreground leading-normal">{notif.message}</p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            {user?.role !== 'INQUILINO' && (
              <button
                onClick={() => navigate(`/${tenant?.slug}/configuracion`)}
                className="p-1.5 rounded-lg hover:bg-muted hover:text-foreground active:scale-95 transition-all duration-100"
                title="Configuración"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
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
