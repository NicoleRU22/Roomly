import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { FileText, User, Shield, Building, Award, Printer, DollarSign, Check, MapPin, Dumbbell, Waves, Flame, Laptop } from 'lucide-react';

interface Inquilino {
  id: number;
  name: string;
  document: string;
  email: string;
  phone?: string;
  status: string;
  propertyId?: number;
  propertyName?: string;
  roomId?: number;
  roomNumber?: string;
}

export const Contratos: React.FC = () => {
  const [inquilinos, setInquilinos] = useState<Inquilino[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal de detalles de contrato
  const [selectedContract, setSelectedContract] = useState<Inquilino | null>(null);
  const [showDocModal, setShowDocModal] = useState(false);

  const fetchInquilinos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/inquilinos');
      // Mostrar solo inquilinos con propiedad y habitación asignada (es decir, que tienen contrato activo)
      const activos = res.data.filter((i: Inquilino) => i.propertyName && i.roomNumber);
      setInquilinos(activos);
    } catch (err: any) {
      console.error('Error cargando contratos:', err);
      setError('No se pudieron cargar los contratos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquilinos();
  }, []);

  const openContractModal = (contract: Inquilino) => {
    setSelectedContract(contract);
    setShowDocModal(true);
  };

  if (loading && inquilinos.length === 0) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mr-3" />
        Cargando contratos activos...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subheader */}
      <div className="flex justify-between items-center mb-6">
        <p className="text-xs text-slate-500">Supervisa los contratos firmados, servicios incluidos, cargos extra y áreas comunes.</p>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          {error}
        </div>
      )}

      {/* LISTA DE CONTRATOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {inquilinos.length === 0 ? (
          <div className="lg:col-span-2 text-center py-12 bg-white border border-slate-200 rounded-2xl text-slate-400">
            No hay contratos activos generados (asigna una habitación a un inquilino para iniciar).
          </div>
        ) : (
          inquilinos.map((inq) => (
            <div key={inq.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all space-y-4">
              
              {/* Encabezado Tarjeta */}
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 leading-tight">Contrato N° {1000 + inq.id}</h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">Firmado y Vigente</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-bold rounded-full uppercase tracking-wider">
                  Vigente
                </span>
              </div>

              {/* Información Inquilino y Edificio */}
              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs">
                <div className="space-y-2">
                  <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Inquilino / Arrendatario</p>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-800 flex items-center">
                      <User className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                      {inq.name}
                    </p>
                    <p className="text-slate-500 font-mono pl-5">DNI: {inq.document}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Edificio / Unidad</p>
                  <div className="space-y-1">
                    <p className="font-bold text-purple-600 flex items-center">
                      <Building className="w-3.5 h-3.5 mr-1.5" />
                      {inq.propertyName}
                    </p>
                    <p className="text-slate-500 pl-5 font-mono">Habitación {inq.roomNumber}</p>
                  </div>
                </div>
              </div>

              {/* Resumen del Arriendo */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-2xl text-center border border-slate-100">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Arriendo Base</span>
                  <p className="text-sm font-extrabold text-slate-800 mt-1">S/. 550.00</p>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Inicio</span>
                  <p className="text-xs font-semibold text-slate-700 mt-1 font-mono">01 Ene 2026</p>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Fin</span>
                  <p className="text-xs font-semibold text-slate-700 mt-1 font-mono">31 Dic 2026</p>
                </div>
              </div>

              {/* Botón de Visualización de Documento */}
              <div className="pt-2 border-t border-slate-100 flex space-x-2">
                <button
                  onClick={() => openContractModal(inq)}
                  className="w-full flex items-center justify-center py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-purple-100"
                >
                  <Shield className="w-3.5 h-3.5 mr-1.5" />
                  Ver Contrato Legal
                </button>
              </div>

            </div>
          ))
        )}
      </div>

      {/* MODAL DOCUMENTO CONTRACTUAL (VISTA COMPLETA Y DETALLES DE SERVICIOS) */}
      {showDocModal && selectedContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDocModal(false)} />
          
          <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl z-10 flex flex-col max-h-[90vh]">
            
            {/* Header del Modal */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-md font-bold text-slate-900">Documento de Arrendamiento</h3>
                <p className="text-[10px] text-slate-400">Contrato legal y estructura de servicios en el edificio</p>
              </div>
              <button 
                onClick={() => setShowDocModal(false)} 
                className="text-slate-400 hover:text-slate-900 text-lg"
              >
                ✕
              </button>
            </div>

            {/* Contenido del Contrato (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-700 leading-relaxed font-sans">
              
              {/* 1. DOCUMENTO LEGAL DE CONTRATO (VISTA PREVIA) */}
              <div className="border border-slate-200 rounded-2xl p-6 bg-amber-50/15 shadow-inner space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                  <span className="text-[10px] font-bold text-slate-400 font-mono">CONTRATO DE ARRENDAMIENTO N° {1000 + selectedContract.id}</span>
                  <button 
                    onClick={() => window.print()} 
                    className="flex items-center text-xs font-bold text-purple-600 hover:text-purple-700"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1" />
                    Imprimir Contrato
                  </button>
                </div>

                <div className="text-center font-bold text-slate-900 text-base uppercase tracking-tight">
                  CONTRATO DE ARRENDAMIENTO DE HABITACIÓN PRIVADA
                </div>

                <div className="space-y-3.5 text-xs text-slate-600">
                  <p>
                    Conste por el presente documento el contrato de arrendamiento que celebran, de una parte **Roomly Group S.A.C.** (en adelante **El Arrendador**), y de la otra parte don/doña **{selectedContract.name}** con Documento Nacional de Identidad N° **{selectedContract.document}** (en adelante **El Arrendatario**), bajo los términos y condiciones siguientes:
                  </p>
                  
                  <p>
                    **PRIMERA (Objeto):** El Arrendador cede en arrendamiento al Arrendatario la **Habitación N° {selectedContract.roomNumber}** ubicada en el edificio **{selectedContract.propertyName}**. La habitación se encuentra amoblada y en óptimo estado de habitabilidad.
                  </p>
                  
                  <p>
                    **SEGUNDA (Plazo):** El plazo de vigencia del presente contrato es de **un (1) año forzoso**, el cual inicia el **01 de Enero del 2026** y concluye de forma indefectible el **31 de Diciembre del 2026**.
                  </p>

                  <p>
                    **TERCERA (Renta):** El Arrendatario pagará al Arrendador una renta mensual pactada en **S/. 550.00** (Quinientos cincuenta con 00/100 Soles) que deberá abonarse por adelantado los primeros cinco (5) días de cada mes calendario.
                  </p>
                </div>
              </div>

              {/* 2. CLASIFICACIÓN DE SERVICIOS PACTADA (INCLUIDOS VS EXTRAS) */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-purple-600 uppercase tracking-widest flex items-center">
                  <Award className="w-4 h-4 mr-2" />
                  Estructura y Clasificación de Servicios
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Servicios Incluidos */}
                  <div className="border border-slate-100 rounded-2xl p-4 bg-emerald-50/10 space-y-3">
                    <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">
                        <Check className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-slate-800 text-xs">Servicios Incluidos (Sin costo adicional)</span>
                    </div>
                    <ul className="space-y-2 text-xs text-slate-600">
                      <li className="flex items-start">
                        <span className="font-bold text-emerald-600 mr-2">•</span>
                        **Internet Fibra Óptica**: Conectividad Wifi de alta velocidad compartida en el departamento.
                      </li>
                      <li className="flex items-start">
                        <span className="font-bold text-emerald-600 mr-2">•</span>
                        **Consumos Básicos**: Servicio de agua potable y consumo básico de electricidad.
                      </li>
                      <li className="flex items-start">
                        <span className="font-bold text-emerald-600 mr-2">•</span>
                        **Limpieza y Mantenimiento**: Limpieza semanal de pasadizos comunes y áreas de distribución.
                      </li>
                    </ul>
                  </div>

                  {/* Servicios Extras */}
                  <div className="border border-slate-100 rounded-2xl p-4 bg-purple-50/15 space-y-3">
                    <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
                      <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs">
                        <DollarSign className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold text-slate-800 text-xs">Servicios Adicionales (Costo Extra)</span>
                    </div>
                    <ul className="space-y-2 text-xs text-slate-600">
                      <li className="flex items-start">
                        <span className="font-bold text-purple-600 mr-2">•</span>
                        **Estacionamiento Privado**: Cochera techada y vigilada por **S/. 150.00** mensuales.
                      </li>
                      <li className="flex items-start">
                        <span className="font-bold text-purple-600 mr-2">•</span>
                        **Gimnasio Premium**: Pase libre mensual ilimitado por **S/. 80.00** adicionales.
                      </li>
                      <li className="flex items-start">
                        <span className="font-bold text-purple-600 mr-2">•</span>
                        **Lavandería**: Acceso a lavadoras y secadoras de última generación (con fichas).
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 3. ÁREAS COMUNES DEL EDIFICIO */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-black text-purple-600 uppercase tracking-widest flex items-center">
                  <MapPin className="w-4 h-4 mr-2" />
                  Áreas Comunes del Edificio
                </h4>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                    <Dumbbell className="w-5 h-5 mx-auto mb-1 text-slate-500" />
                    <span className="text-[10px] font-bold text-slate-700">Gym Equipado</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                    <Waves className="w-5 h-5 mx-auto mb-1 text-slate-500" />
                    <span className="text-[10px] font-bold text-slate-700">Piscina</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                    <Flame className="w-5 h-5 mx-auto mb-1 text-slate-500" />
                    <span className="text-[10px] font-bold text-slate-700">Terraza & Parrilla</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                    <Laptop className="w-5 h-5 mx-auto mb-1 text-slate-500" />
                    <span className="text-[10px] font-bold text-slate-700">Co-working</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer Modal */}
            <div className="flex justify-end p-4 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setShowDocModal(false)}
                className="py-2 px-5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl"
              >
                Cerrar Documento
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
