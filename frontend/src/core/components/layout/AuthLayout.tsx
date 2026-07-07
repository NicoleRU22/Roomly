import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import logoImg from '../../../assets/logo.png';

export const AuthLayout: React.FC = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white text-slate-900 font-sans">
      
      {/* SECCIÓN IZQUIERDA: FONDO OSCURO EDITORIAL */}
      <div className="w-full md:w-[45%] bg-[#0c0a14] flex flex-col justify-between p-8 md:p-12 text-white relative min-h-[40vh] md:min-h-screen md:h-screen md:sticky md:top-0 md:self-start md:rounded-r-[40px] shadow-2xl shadow-slate-950/40 overflow-hidden">

        {/* Decoración: glows de color */}
        <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 bg-purple-600/30 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute top-1/3 -right-20 w-80 h-80 bg-fuchsia-500/20 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-10 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl" />

        {/* Patrón de rejilla sutil */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Enlaces de navegación vertical superior derecho */}
        <div className="relative self-end flex flex-col space-y-3 text-sm font-bold text-purple-100 items-end text-right">
          <Link to="/" className="hover:text-white transition-colors">Menu</Link>
          <Link
            to="/login"
            className={`hover:text-white transition-colors ${location.pathname === '/login' ? 'text-white font-black' : ''}`}
          >
            Login
          </Link>
          <Link
            to="/register"
            className={`hover:text-white transition-colors ${location.pathname === '/register' ? 'text-white font-black' : ''}`}
          >
            Register
          </Link>
        </div>

        {/* Textos centrales */}
        <div className="relative my-auto max-w-sm space-y-6 pt-10 md:pt-0 md:overflow-y-auto md:max-h-[calc(100vh-8rem)]">
          <span className="inline-block px-3 py-1 rounded-full bg-purple-500/15 border border-purple-400/30 text-purple-200 text-xs font-bold tracking-wide uppercase">
            Gestión inmobiliaria inteligente
          </span>

          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Bienvenido a <br />
            <span className="font-black bg-gradient-to-r from-purple-300 via-fuchsia-300 to-white bg-clip-text text-transparent">
              Roomly
            </span>
          </h2>
          <p className="text-sm md:text-md text-purple-100 font-medium leading-relaxed">
            Gestiona tus propiedades con la plataforma más avanzada del mercado
          </p>

          {/* Lista de beneficios */}
          <ul className="space-y-3 pt-2">
            {[
              'Control de contratos y pagos en un solo lugar',
              'Alertas automáticas de vencimientos y mantenimiento',
              'Panel administrativo para tu equipo y proveedores',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-purple-100/90">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/20 border border-purple-400/40 flex items-center justify-center">
                  <svg viewBox="0 0 20 20" fill="none" className="w-3 h-3">
                    <path d="M4 10.5L8 14.5L16 5.5" stroke="#e9d5ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          {/* Métricas rápidas */}
          <div className="flex gap-6 pt-4">
            <div>
              <p className="text-2xl font-extrabold text-white">+500</p>
              <p className="text-xs text-purple-200/80">Propiedades gestionadas</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-white">98%</p>
              <p className="text-xs text-purple-200/80">Satisfacción de usuarios</p>
            </div>
          </div>
        </div>

        {/* Footer izquierdo (ilustrativo) */}
        <div className="relative hidden md:block text-xs text-purple-200">
          &copy; {new Date().getFullYear()} Roomly Group. Todos los derechos reservados.
        </div>
      </div>

      {/* SECCIÓN DERECHA: FORMULARIOS */}
      <div className="w-full md:w-[55%] flex flex-col justify-center items-center p-8 bg-white min-h-[60vh] md:min-h-screen">
        <div className="w-full max-w-sm flex flex-col items-center space-y-6">
          
          {/* Logo Oficial de Roomly Group */}
          <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center bg-[#0c0a14] shadow-xl shadow-purple-950/25 border border-purple-900/10">
            <img 
              src={logoImg} 
              alt="Roomly Group Logo" 
              className="w-full h-full object-cover" 
            />
          </div>

          {/* Caja contenedora del formulario (Outlet) */}
          <div className="w-full bg-white border border-slate-100 rounded-2xl p-6 md:p-8 shadow-xl shadow-slate-100">
            <Outlet />
          </div>

        </div>
      </div>

    </div>
  );
};
