import React from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  Lock, 
  Users, 
  Building, 
  Check, 
  ArrowRight
} from 'lucide-react';

export const Home: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col justify-between overflow-x-hidden">
      
      {/* HEADER / TOPBAR */}
      <header className="bg-white border-b border-slate-200 py-4 px-8 flex justify-between items-center relative z-10">
        <span className="text-xl font-black tracking-tight text-slate-900">Roomly</span>
        <Link 
          to="/login"
          className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-xl transition-all active:scale-[0.97]"
        >
          Iniciar sesión
        </Link>
      </header>

      {/* HERO SECTION */}
      <main className="flex-grow">
        <section className="max-w-6xl mx-auto px-6 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 text-center lg:text-left">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Gestión de propiedades <br />
              <span className="text-purple-650 italic font-semibold">sin límites</span>
            </h1>
            <p className="text-md md:text-lg text-slate-600 max-w-xl mx-auto lg:mx-0">
              Controla todo tu patrimonio inmobiliario desde una plataforma inteligente. Para propietarios que quieren crecer y inquilinos que merecen lo mejor.
            </p>
            
            {/* ACCIONES */}
            <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4 pt-2">
              <Link 
                to="/login"
                className="flex items-center justify-center px-6 py-3 rounded-xl bg-purple-650 hover:bg-purple-700 text-white font-bold shadow-lg shadow-purple-200 transition-all active:scale-[0.98] group text-sm"
              >
                Acceder a Roomly
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link 
                to="/register"
                className="flex items-center justify-center px-6 py-3 rounded-xl bg-white border border-slate-200 hover:border-purple-600 text-slate-800 hover:text-purple-650 font-bold transition-all active:scale-[0.98] text-sm"
              >
                Registrar Propiedad
              </Link>
            </div>

            {/* AVATAR STRIP */}
            <div className="flex items-center justify-center lg:justify-start space-x-3 pt-6">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full border-2 border-white bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white uppercase font-sans">A</div>
                <div className="w-8 h-8 rounded-full border-2 border-white bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-white uppercase font-sans">L</div>
                <div className="w-8 h-8 rounded-full border-2 border-white bg-purple-500 flex items-center justify-center text-[10px] font-bold text-white uppercase font-sans">M</div>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                <span className="text-purple-650 font-bold">+100</span> propiedades activas confían en Roomly
              </p>
            </div>
          </div>

          {/* ILUSTRACIÓN LATERAL */}
          <div className="relative flex justify-center items-center">
            {/* Fondo decorativo con gradiente */}
            <div className="absolute w-72 h-72 md:w-96 md:h-96 rounded-full bg-purple-200/50 blur-3xl -z-10" />
            
            {/* Tarjeta Mockup */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4 transform rotate-1 hover:rotate-0 transition-transform duration-350">
              <div className="flex justify-between items-center">
                <div className="flex space-x-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
                <span className="text-[10px] font-bold text-purple-650 uppercase tracking-widest">Roomly App</span>
              </div>
              <div className="h-40 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-50 flex items-center justify-center relative overflow-hidden">
                <div className="absolute -bottom-6 w-32 h-32 rounded-full bg-purple-500/10 blur-xl" />
                <div className="z-10 flex flex-col items-center text-center space-y-2">
                  <span className="inline-block p-2.5 rounded-xl bg-white shadow-md text-purple-650">
                    <Building className="w-5 h-5" />
                  </span>
                  <p className="text-xs font-bold text-slate-800">Panel de Control Activo</p>
                  <p className="text-[10px] text-slate-500">Métricas en Tiempo Real</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[10px]">
                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                  <p className="text-slate-400">Ocupación</p>
                  <p className="font-bold text-slate-800 text-xs">92%</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                  <p className="text-slate-455">Recaudado</p>
                  <p className="font-bold text-slate-800 text-xs">S/. 12,450.00</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN DISEÑADO PARA EL ÉXITO */}
        <section className="bg-slate-950 text-white py-20 px-6 border-y border-slate-900">
          <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <h2 className="text-3xl font-extrabold tracking-tight">Diseñado para el éxito</h2>
              <p className="text-slate-400 text-sm">
                Todo lo que necesitas para administrar propiedades como un profesional
              </p>
            </div>

            {/* GRID DE CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Card 1: Analítica avanzada */}
              <div className="p-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-4 hover:bg-slate-900 hover:border-slate-700 transition-all duration-200 active:scale-[0.98]">
                <div className="w-10 h-10 rounded-xl bg-purple-950/80 text-purple-450 border border-purple-900/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-md text-white">Analítica avanzada</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  Dashboards con métricas de ocupación, rentabilidad y tendencias en tiempo real.
                </p>
              </div>

              {/* Card 2: Seguridad Premium */}
              <div className="p-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-4 hover:bg-slate-900 hover:border-slate-700 transition-all duration-200 active:scale-[0.98]">
                <div className="w-10 h-10 rounded-xl bg-purple-950/80 text-purple-450 border border-purple-900/20 flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-md text-white">Seguridad Premium</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  Encriptación de datos, acceso controlado y cumplimiento normativo.
                </p>
              </div>

              {/* Card 3: Directorio Inquilinos */}
              <div className="p-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-4 hover:bg-slate-900 hover:border-slate-700 transition-all duration-200 active:scale-[0.98]">
                <div className="w-10 h-10 rounded-xl bg-purple-950/80 text-purple-450 border border-purple-900/20 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-md text-white">Directorio de Inquilinos</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  Base de datos completa con historial, pagos y documentación.
                </p>
              </div>

              {/* Card 4: Gestión Multipropiedad */}
              <div className="p-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-4 hover:bg-slate-900 hover:border-slate-700 transition-all duration-200 active:scale-[0.98]">
                <div className="w-10 h-10 rounded-xl bg-purple-950/80 text-purple-450 border border-purple-900/20 flex items-center justify-center">
                  <Building className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-md text-white">Gestión Multipropiedad</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  Controla ilimitadas propiedades desde un solo panel centralizado.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* DIVIDER ONDAS PÚRPURAS */}
        <div className="scallop-divider" />

        {/* SECCIÓN SOLUCIONES ESPECIALIZADAS */}
        <section className="py-20 px-6 max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-xl mx-auto space-y-3">
            <h2 className="text-3xl font-extrabold text-slate-900">Soluciones especializadas</h2>
            <p className="text-sm text-slate-500">
              Herramientas profesionales diseñadas para maximizar rentabilidad y minimizar esfuerzo
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Tarjeta Propietarios */}
            <div className="bg-white border-2 border-slate-100 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all space-y-6">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center">
                <Building className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">Tus propiedades</h3>
                <p className="text-sm text-slate-500">Gestionar tu cartera completa como un profesional</p>
              </div>
              
              <ul className="space-y-3.5 text-sm text-slate-600">
                <li className="flex items-center">
                  <Check className="w-4 h-4 text-purple-600 mr-3 shrink-0" />
                  Dashboard con métricas principales
                </li>
                <li className="flex items-center">
                  <Check className="w-4 h-4 text-purple-600 mr-3 shrink-0" />
                  Gestión de múltiples propiedades y cuartos
                </li>
                <li className="flex items-center">
                  <Check className="w-4 h-4 text-purple-600 mr-3 shrink-0" />
                  Seguimiento de pagos y control de mora
                </li>
                <li className="flex items-center">
                  <Check className="w-4 h-4 text-purple-600 mr-3 shrink-0" />
                  Reportes y análisis avanzados de rentabilidad
                </li>
              </ul>
            </div>

            {/* Tarjeta Inquilinos */}
            <div className="bg-white border-2 border-slate-100 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all space-y-6">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">Para inquilinos</h3>
                <p className="text-sm text-slate-500">Tu espacio digital para vivir sin preocupaciones</p>
              </div>
              
              <ul className="space-y-3.5 text-sm text-slate-600">
                <li className="flex items-center">
                  <Check className="w-4 h-4 text-purple-600 mr-3 shrink-0" />
                  Mi espacio - Tu hogar digital
                </li>
                <li className="flex items-center">
                  <Check className="w-4 h-4 text-purple-600 mr-3 shrink-0" />
                  Mis pagos e historial de cobros
                </li>
                <li className="flex items-center">
                  <Check className="w-4 h-4 text-purple-600 mr-3 shrink-0" />
                  Notificaciones automáticas de vencimiento
                </li>
                <li className="flex items-center">
                  <Check className="w-4 h-4 text-purple-600 mr-3 shrink-0" />
                  Documentos y almacenamiento de contratos seguro
                </li>
              </ul>
            </div>

          </div>
        </section>
      </main>

      {/* DIVIDER ONDAS PÚRPURAS FOOTER */}
      <div className="scallop-divider-bottom" />

      {/* FOOTER */}
      <footer className="bg-[#0c0a14] border-t border-slate-900 text-slate-400 py-16 px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Logo y descripción */}
          <div className="space-y-4 md:col-span-2">
            <span className="text-xl font-black text-white tracking-tight">Roomly</span>
            <p className="text-slate-400 text-xs leading-relaxed max-w-sm font-medium">
              Gestión de propiedades inteligente. Centraliza alquileres, inquilinos, cobros y servicios de manera eficiente.
            </p>
          </div>

          {/* Menú Legal */}
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-350">Legal</span>
            <ul className="space-y-2 text-xs font-medium">
              <li><a href="#" className="hover:text-white transition-colors">Privacidad</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Términos</a></li>
            </ul>
          </div>

          {/* Menú Contacto */}
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-350">Contacto</span>
            <ul className="space-y-2 text-xs font-medium">
              <li><a href="mailto:roomly@gmail.com" className="hover:text-white transition-colors">roomly@gmail.com</a></li>
              <li><span className="font-mono">+51 951 345 456</span></li>
            </ul>
          </div>

        </div>
        
        <div className="max-w-6xl mx-auto border-t border-slate-900 mt-12 pt-6 text-center text-xs text-slate-500 font-medium">
          &copy; {new Date().getFullYear()} Roomly. Todos los derechos reservados.
        </div>
      </footer>

    </div>
  );
};
