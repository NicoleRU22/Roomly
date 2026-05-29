import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import logoImg from '../../assets/logo.png';

export const AuthLayout: React.FC = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white text-slate-900 font-sans">
      
      {/* SECCIÓN IZQUIERDA: FONDO OSCURO EDITORIAL */}
      <div className="w-full md:w-[45%] bg-[#0c0a14] flex flex-col justify-between p-8 md:p-12 text-white relative min-h-[40vh] md:min-h-screen md:rounded-r-[40px] shadow-2xl shadow-slate-950/40">
        
        {/* Enlaces de navegación vertical superior derecho */}
        <div className="self-end flex flex-col space-y-3 text-sm font-bold text-purple-100 items-end text-right">
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
        <div className="my-auto max-w-sm space-y-4 pt-10 md:pt-0">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Bienvenido a <br />
            <span className="font-black text-white">Roomly</span>
          </h2>
          <p className="text-sm md:text-md text-purple-100 font-medium leading-relaxed">
            Gestiona tus propiedades con la plataforma más avanzada del mercado
          </p>
        </div>

        {/* Footer izquierdo (ilustrativo) */}
        <div className="hidden md:block text-xs text-purple-200">
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
