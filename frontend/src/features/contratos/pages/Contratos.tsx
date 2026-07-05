import React, { useEffect, useState } from 'react';
import api from '../../../core/services/api';
import { useAuthStore } from '../../../features/auth/store/useAuthStore';
import { User, Shield, Building, Printer, CheckCircle, AlertTriangle, Search, Filter, RefreshCw, Edit2 } from 'lucide-react';
import { Pagination } from '../../../core/components/ui/Pagination';

interface Contrato {
  id: number;
  tenantId: number;
  inquilinoId: number;
  inquilinoName: string;
  inquilinoDocument: string;
  roomId: number;
  roomNumber: string;
  propertyId: number;
  propertyName: string;
  propertyServices?: string;
  startDate: string;
  endDate: string;
  amount: number;
  status: string;
  landlordName?: string;
  landlordRuc?: string;
  landlordAddress?: string;
  specialTerms?: string;
  signatureUrl?: string;
  acceptedTerms: boolean;
  createdAt: string;
}

interface Property {
  id: number;
  name: string;
}

const PAGE_SIZE = 6;
const SERVICE_LABELS: Record<string, string> = {
  wifi: 'WiFi',
  WiFi: 'WiFi',
  Estacionamiento: 'Estacionamiento',
  Gimnasio: 'Gimnasio',
  Piscina: 'Piscina'
};

interface SignaturePadProps {
  onSave: (base64: string) => void;
  onClear: () => void;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onClear }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = React.useState(false);

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e293b'; // Slate 800 for ink
    const coords = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    if (e.pointerType === 'touch') {
      canvas.style.touchAction = 'none';
    }
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const coords = getCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.touchAction = 'auto';
      const base64 = canvas.toDataURL('image/png');
      onSave(base64);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onClear();
  };

  return (
    <div className="space-y-2">
      <div className="relative border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-900 shadow-inner">
        <canvas
          ref={canvasRef}
          width={450}
          height={180}
          className="w-full h-[180px] cursor-crosshair touch-none bg-slate-50 dark:bg-slate-900"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
        />
        <div className="absolute bottom-2 right-2">
          <button
            type="button"
            onClick={clearCanvas}
            className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 border border-slate-200 dark:border-slate-750 rounded-lg text-[9px] font-bold shadow-sm transition-all"
          >
            Limpiar Lienzo
          </button>
        </div>
      </div>
      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
        Usa tu mouse o pantalla táctil en el recuadro de arriba para dibujar tu firma.
      </p>
    </div>
  );
};

export const Contratos: React.FC = () => {
  const { user } = useAuthStore();
  const isTenant = user?.role === 'INQUILINO';

  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros Propietario
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProperty, setFilterProperty] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Estados de firma (Inquilino)
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [signing, setSigning] = useState(false);

  // Modal de detalles (Propietario / Inquilino)
  const [selectedContract, setSelectedContract] = useState<Contrato | null>(null);
  const [showDocModal, setShowDocModal] = useState(false);
  const [selectedContractIndex, setSelectedContractIndex] = useState(0);

  // Estados Modal de Renovación
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [contractToRenew, setContractToRenew] = useState<Contrato | null>(null);
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [renewing, setRenewing] = useState(false);

  // Estados Modal de Edicion
  const [showEditModal, setShowEditModal] = useState(false);
  const [contractToEdit, setContractToEdit] = useState<Contrato | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editLandlordRuc, setEditLandlordRuc] = useState('');
  const [editLandlordName, setEditLandlordName] = useState('');
  const [editLandlordAddress, setEditLandlordAddress] = useState('');
  const [editSpecialTerms, setEditSpecialTerms] = useState('');
  const [consultingSunat, setConsultingSunat] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Reglas de cobro configuradas por el propietario (con defaults razonables mientras carga)
  const [expirationWarningDays, setExpirationWarningDays] = useState(30);
  const [lateFeePerDay, setLateFeePerDay] = useState(5.0);
  const [graceDays, setGraceDays] = useState(5);

  const getApiUrl = () => {
    return import.meta.env.VITE_API_URL || 'http://localhost:3001';
  };

  const fetchContratosAndProperties = async () => {
    setLoading(true);
    setError(null);
    try {
      const [conRes, propRes, configRes] = await Promise.all([
        api.get('/contratos'),
        isTenant ? Promise.resolve({ data: [] }) : api.get('/properties'),
        api.get('/configuracion').catch(() => ({ data: null }))
      ]);
      setContratos(conRes.data);
      if (!isTenant) {
        setProperties(propRes.data);
      }
      if (configRes.data) {
        setExpirationWarningDays(configRes.data.contractExpirationWarningDays ?? 30);
        setLateFeePerDay(configRes.data.lateFeePerDay ?? 5.0);
        setGraceDays(configRes.data.graceDays ?? 5);
      }
    } catch (err: any) {
      console.error('Error cargando contratos:', err);
      setError('No se pudieron cargar los contratos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContratosAndProperties();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterProperty, filterStatus, filterDateStart, filterDateEnd]);

  const handleSignContract = async (contractId: number) => {
    if (!signatureBase64 || !acceptedTerms) return;

    setSigning(true);
    setError(null);
    try {
      await api.put(`/contratos/${contractId}/sign`, {
        signatureImage: signatureBase64,
        acceptedTerms
      });
      fetchContratosAndProperties();
      setSignatureBase64(null);
      setAcceptedTerms(false);
    } catch (err: any) {
      console.error('Error al firmar contrato:', err);
      setError(err.response?.data?.error || 'No se pudo registrar la firma.');
    } finally {
      setSigning(false);
    }
  };

  const openContractModal = (contract: Contrato) => {
    setSelectedContract(contract);
    setShowDocModal(true);
  };

  // Helper para verificar si está por vencer, según los días de anticipación configurados
  const isNearExpiration = (endDateStr: string) => {
    const end = new Date(endDateStr);
    const today = new Date();
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= expirationWarningDays;
  };

  const openRenewModal = (contract: Contrato) => {
    setContractToRenew(contract);
    
    // Sugerir fecha de inicio: un día después de la fecha final anterior
    const prevEnd = new Date(contract.endDate);
    prevEnd.setDate(prevEnd.getDate() + 1);
    const startStr = prevEnd.toISOString().split('T')[0];
    setNewStartDate(startStr);

    // Sugerir fecha de fin: un año después
    const nextEnd = new Date(prevEnd);
    nextEnd.setFullYear(nextEnd.getFullYear() + 1);
    const endStr = nextEnd.toISOString().split('T')[0];
    setNewEndDate(endStr);

    setNewAmount(String(contract.amount));
    setShowRenewModal(true);
  };

  const openEditModal = (contract: Contrato) => {
    setContractToEdit(contract);
    setEditStartDate(contract.startDate);
    setEditEndDate(contract.endDate);
    setEditAmount(String(contract.amount));
    setEditLandlordRuc(contract.landlordRuc || '');
    setEditLandlordName(contract.landlordName || '');
    setEditLandlordAddress(contract.landlordAddress || '');
    setEditSpecialTerms(contract.specialTerms || '');
    setShowEditModal(true);
  };

  const handleConsultSunat = async () => {
    const cleanRuc = editLandlordRuc.replace(/\D/g, '');
    if (cleanRuc.length !== 11) {
      setError('El RUC debe tener 11 digitos.');
      return;
    }

    setConsultingSunat(true);
    setError(null);
    try {
      const res = await api.get(`/contratos/consultar-ruc/${cleanRuc}`);
      setEditLandlordRuc(res.data.ruc || cleanRuc);
      setEditLandlordName(res.data.razonSocial || '');
      setEditLandlordAddress(res.data.direccion || '');
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo consultar SUNAT.');
    } finally {
      setConsultingSunat(false);
    }
  };

  const handleUpdateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractToEdit) return;
    setSavingEdit(true);
    setError(null);

    try {
      await api.put(`/contratos/${contractToEdit.id}`, {
        startDate: editStartDate,
        endDate: editEndDate,
        amount: parseFloat(editAmount),
        landlordName: editLandlordName,
        landlordRuc: editLandlordRuc,
        landlordAddress: editLandlordAddress,
        specialTerms: editSpecialTerms
      });
      setShowEditModal(false);
      fetchContratosAndProperties();
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo editar el contrato.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRenewContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractToRenew || !newStartDate || !newEndDate || !newAmount) return;
    setRenewing(true);
    setError(null);

    try {
      await api.post(`/contratos/${contractToRenew.id}/renew`, {
        startDate: newStartDate,
        endDate: newEndDate,
        amount: parseFloat(newAmount)
      });
      setShowRenewModal(false);
      fetchContratosAndProperties();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al renovar el contrato.');
    } finally {
      setRenewing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  };

  const getContractServices = (contract: Contrato) => {
    return (contract.propertyServices || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => SERVICE_LABELS[item] || item);
  };

  const getLandlordName = (contract: Contrato) => contract.landlordName || 'Roomly Group S.A.C.';

  // Filtrado de Contratos para Propietario
  const filteredContratos = contratos.filter(c => {
    const matchesSearch = c.inquilinoName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.inquilinoDocument.includes(searchTerm) || 
                          c.roomNumber.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesProperty = filterProperty === '' || c.propertyId === parseInt(filterProperty);

    // Filtrar por estado de contrato
    let matchesStatus = true;
    if (filterStatus !== '') {
      if (filterStatus === 'POR_VENCER') {
        matchesStatus = c.status === 'VIGENTE' && isNearExpiration(c.endDate);
      } else {
        matchesStatus = c.status === filterStatus;
      }
    }

    // Rango de fechas
    let matchesDate = true;
    if (filterDateStart !== '') {
      matchesDate = matchesDate && new Date(c.startDate) >= new Date(filterDateStart);
    }
    if (filterDateEnd !== '') {
      matchesDate = matchesDate && new Date(c.endDate) <= new Date(filterDateEnd);
    }

    return matchesSearch && matchesProperty && matchesStatus && matchesDate;
  });

  const totalPages = Math.max(1, Math.ceil(filteredContratos.length / PAGE_SIZE));
  const paginatedContratos = filteredContratos.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-650 mr-3" />
        Cargando documentos de arriendo...
      </div>
    );
  }

  // ==========================================
  // RENDER PORTAL INQUILINO (VER / FIRMAR CONTRATO)
  // ==========================================
  if (isTenant) {
    const myContract = contratos[selectedContractIndex] || contratos[0];

    if (!myContract) {
      return (
        <div className="text-center py-12 bg-white border border-slate-200 rounded-3xl text-slate-400">
          No tienes ningún contrato de alquiler asignado en tu espacio.
        </div>
      );
    }

    const isDraft = myContract.status === 'PENDIENTE_FIRMA';

    return (
      <div className="space-y-6 max-w-3xl">
        {/* Selector de Contratos (si hay más de uno) */}
        {contratos.length > 1 && (
          <div className="bg-white border border-slate-200 p-4.5 rounded-3xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
            <span className="text-xs font-bold text-slate-700">Ver documento de arriendo para:</span>
            <select
              value={selectedContractIndex}
              onChange={(e) => setSelectedContractIndex(parseInt(e.target.value))}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-650"
            >
              {contratos.map((c, idx) => (
                <option key={c.id} value={idx}>
                  Habitación {c.roomNumber} - {c.status} ({formatDate(c.startDate)} a {formatDate(c.endDate)})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Banner de alerta de firma */}
        {isDraft ? (
          <div className="bg-rose-50 border border-rose-200 p-6 rounded-3xl space-y-2">
            <h3 className="text-sm font-bold text-rose-800 flex items-center">
              <AlertTriangle className="w-4.5 h-4.5 mr-2 shrink-0 text-rose-600" />
              Contrato pendiente de firma
            </h3>
            <p className="text-xs text-rose-600">
              Por favor, revisa detalladamente las cláusulas del acuerdo de arriendo. Si estás de acuerdo, sube una foto de tu firma manuscrita al final del documento para activarlo.
            </p>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-250 p-6 rounded-3xl flex justify-between items-center">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-emerald-800 flex items-center">
                <CheckCircle className="w-4.5 h-4.5 mr-2 shrink-0 text-emerald-650" />
                Contrato firmado y activo
              </h3>
              <p className="text-xs text-emerald-650">
                Tu arriendo se encuentra vigente e inscrito de manera legal en el sistema.
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center py-2 px-4 bg-emerald-650 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-50"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Imprimir / PDF
            </button>
          </div>
        )}

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-650">
            {error}
          </div>
        )}

        {/* DOCUMENTO LEGAL DEL CONTRATO CON MARCA DE AGUA */}
        <div id="printable-contract-document" className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6 text-slate-700 leading-relaxed text-xs relative overflow-hidden">
          
          {/* Overlay Watermark de copia digital */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center select-none overflow-hidden opacity-5 rotate-[-25deg] z-0">
            <span className="text-4xl md:text-5xl font-black text-slate-900 tracking-widest whitespace-nowrap">
              Copia digital - Roomly SaaS
            </span>
          </div>

          <div className="flex justify-between items-center pb-4 border-b border-slate-100 z-10 relative">
            <span className="font-mono text-slate-400 font-bold">CONTRATO DE ARRENDAMIENTO N° {1000 + myContract.id}</span>
            <span className={`px-2.5 py-0.5 text-[9px] font-extrabold border rounded-full uppercase tracking-wider ${
              isDraft ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {isDraft ? 'Borrador' : 'Vigente'}
            </span>
          </div>

          <h2 className="text-center text-sm font-extrabold text-slate-900 uppercase tracking-tight z-10 relative">
            CONTRATO DE ARRENDAMIENTO DE HABITACIÓN PRIVADA
          </h2>

          <div className="space-y-4 z-10 relative">
            <p>
              Conste por el presente documento el contrato de arrendamiento que celebran, de una parte <strong>{getLandlordName(myContract)}</strong>{myContract.landlordRuc ? <> con RUC N° <strong>{myContract.landlordRuc}</strong></> : null} (en adelante <strong>El Arrendador</strong>), y de la otra parte don/doña <strong>{myContract.inquilinoName}</strong> con Documento Nacional de Identidad N° <strong>{myContract.inquilinoDocument}</strong> (en adelante <strong>El Arrendatario</strong>), bajo los términos y condiciones siguientes:
            </p>

            {myContract.landlordAddress && (
              <p>
                <strong>DOMICILIO DEL ARRENDADOR:</strong> {myContract.landlordAddress}.
              </p>
            )}
            
            <p>
              <strong>PRIMERA (Objeto):</strong> El Arrendador cede en arrendamiento al Arrendatario la <strong>Habitación N° {myContract.roomNumber}</strong> ubicada en la propiedad <strong>{myContract.propertyName}</strong>. La habitación se entrega amoblada y en óptimo estado de funcionamiento.
            </p>

            {getContractServices(myContract).length > 0 && (
              <p>
                <strong>SERVICIOS INCLUIDOS:</strong> {getContractServices(myContract).join(', ')}.
              </p>
            )}
            
            <p>
              <strong>SEGUNDA (Plazo):</strong> El plazo de arriendo es de duración forzosa, el cual inicia el <strong>{formatDate(myContract.startDate)}</strong> y concluye el <strong>{formatDate(myContract.endDate)}</strong>.
            </p>

            <p>
              <strong>TERCERA (Renta):</strong> El Arrendatario pagará al Arrendador una renta mensual pactada en <strong>S/. {myContract.amount.toFixed(2)}</strong>. Este monto deberá abonarse por adelantado los primeros cinco (5) días de cada mes calendario.
            </p>

            <p>
              <strong>CUARTA (Mora y Penalización):</strong> Se establece expresamente que a partir del {graceDays}to día de retraso del mes corriente, se aplicará de forma automática una penalización de <strong>S/. {lateFeePerDay.toFixed(2)} diarios por cada día de mora acumulado</strong> hasta la liquidación del saldo.
            </p>

            <p>
              <strong>QUINTA (Términos Generales):</strong> El Arrendatario se compromete a cuidar las áreas comunes, respetar los reglamentos del inmueble, y no realizar modificaciones estructurales a la habitación sin consentimiento del Arrendador.
            </p>

            {myContract.specialTerms && (
              <p>
                <strong>CONDICIONES ADICIONALES:</strong> {myContract.specialTerms}
              </p>
            )}
          </div>

          {/* Firmas */}
          <div className="grid grid-cols-2 gap-8 border-t border-slate-150 pt-8 mt-6 z-10 relative">
            <div className="text-center space-y-4">
              <div className="h-16 flex items-center justify-center font-mono text-slate-350 italic text-[10px] border-b border-dashed border-slate-300">
                [ Firma Digitalizada / Representante ]
              </div>
              <p className="font-bold text-slate-800">El Arrendador</p>
              <p className="text-[10px] text-slate-400">{getLandlordName(myContract)}</p>
            </div>

            <div className="text-center space-y-4">
              <div className="h-16 flex items-center justify-center border-b border-dashed border-slate-300">
                {!isDraft && myContract.signatureUrl ? (
                  <img 
                    src={`${getApiUrl()}${myContract.signatureUrl}`} 
                    alt="Firma Inquilino" 
                    className="h-full object-contain max-w-[150px]"
                  />
                ) : (
                  <span className="font-mono text-rose-500 italic text-[9px]">[ Pendiente de Firma ]</span>
                )}
              </div>
              <p className="font-bold text-slate-800">El Arrendatario (Tú)</p>
              <p className="text-[10px] text-slate-400">{myContract.inquilinoName}</p>
            </div>
          </div>

          {/* Banner de validación si está firmado */}
          {!isDraft && (
            <div className="mt-6 p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-[10px] text-emerald-800 font-mono font-semibold text-center z-10 relative">
              DOCUMENTO FIRMADO DIGITALMENTE POR EL ARRENDATARIO CON FECHA DE INICIO {formatDate(myContract.startDate)}
            </div>
          )}
        </div>

        {/* CONTROLES DE FIRMA (SOLO SI ES BORRADOR) */}
        {isDraft && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Formalizar Firma</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-650">1. Dibuja tu firma digital</label>
                <SignaturePad 
                  onSave={(base64) => setSignatureBase64(base64)}
                  onClear={() => setSignatureBase64(null)}
                />
              </div>

              {signatureBase64 && (
                <div className="border border-slate-150 p-4 rounded-2xl bg-slate-50 text-center flex flex-col justify-center items-center h-[210px]">
                  <span className="text-[10px] font-bold text-slate-500 block mb-2">Vista previa de tu firma</span>
                  <div className="border border-slate-200 p-2 rounded-xl bg-white max-w-[250px] shadow-sm">
                    <img src={signatureBase64} alt="Firma digitalizada" className="max-h-24 object-contain" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-start text-xs pt-2">
              <input
                id="accept-terms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500 mt-0.5"
              />
              <label htmlFor="accept-terms" className="ml-2.5 font-semibold text-slate-650 select-none">
                Acepto todos los términos, condiciones y cláusulas estipuladas en el presente contrato de arrendamiento.
              </label>
            </div>

            <button
              onClick={() => handleSignContract(myContract.id)}
              disabled={!signatureBase64 || !acceptedTerms || signing}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-100"
            >
              {signing ? 'Firmando y procesando...' : 'Firmar y Activar Contrato'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER PANEL DE PROPIETARIO (LISTADO Y FILTROS)
  // ==========================================
  return (
    <div className="space-y-6">
      {/* Subheader */}
      <div className="flex justify-between items-center mb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Gestión de Contratos</h2>
          <p className="text-sm text-slate-500 font-medium">Supervisa la firma de contratos de alquiler vigentes, plazos y cobros pactados en tu portafolio.</p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          {error}
        </div>
      )}

      {/* FILTROS AVANZADOS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">Búsqueda General</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar Inquilino, DNI, Habitación..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">Por Propiedad</label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <select
                value={filterProperty}
                onChange={(e) => setFilterProperty(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-600 appearance-none"
              >
                <option value="">Todas las propiedades</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">Estado Contrato</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-600"
            >
              <option value="">Todos los estados</option>
              <option value="PENDIENTE_FIRMA">PENDIENTE_FIRMA (Borrador)</option>
              <option value="VIGENTE">VIGENTE (Firmados)</option>
              <option value="POR_VENCER">POR VENCER (Menos de 30 días)</option>
              <option value="FINALIZADO">FINALIZADO (Histórico)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">Inicio Rango</label>
              <input
                type="date"
                value={filterDateStart}
                onChange={(e) => setFilterDateStart(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-600 font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">Fin Rango</label>
              <input
                type="date"
                value={filterDateEnd}
                onChange={(e) => setFilterDateEnd(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-600 font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* GRID DE CONTRATOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredContratos.length === 0 ? (
          <div className="lg:col-span-2 text-center py-12 bg-white border border-slate-200 rounded-3xl text-slate-450">
            No se han registrado contratos que coincidan con los filtros (asigna una habitación a un inquilino para generarlos).
          </div>
        ) : (
          paginatedContratos.map((contract) => {
            const isDraft = contract.status === 'PENDIENTE_FIRMA';
            const nearExpiration = contract.status === 'VIGENTE' && isNearExpiration(contract.endDate);
            const services = getContractServices(contract);
            return (
              <div key={contract.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all space-y-4 relative overflow-hidden">
                
                {/* Indicador de firma y estado visual */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDraft ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {isDraft ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-slate-900 leading-tight">Contrato N° {1000 + contract.id}</h3>
                        {!isDraft ? (
                          <span className="text-[10px] text-emerald-650 bg-emerald-50 border border-emerald-100 rounded px-1 py-0.2 w-max font-bold flex items-center gap-0.5">
                            ✅ Firmado
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-650 bg-amber-50 border border-amber-100 rounded px-1 py-0.2 w-max font-bold flex items-center gap-0.5">
                            ⚠️ Pendiente
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-slate-450 font-semibold font-mono mt-0.5 uppercase">
                        {contract.status}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-0.5 text-[9px] font-extrabold border rounded-full uppercase tracking-wider ${
                    isDraft ? 'bg-amber-50 text-amber-700 border-amber-250/20' : 
                    nearExpiration ? 'bg-red-50 text-red-650 border-red-150 animate-pulse' :
                    contract.status === 'FINALIZADO' ? 'bg-slate-100 text-slate-650 border-slate-200' :
                    'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {nearExpiration ? 'Por vencer' : isDraft ? 'Borrador' : contract.status}
                  </span>
                </div>

                {/* Información Inquilino y Edificio */}
                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs">
                  <div className="space-y-2">
                    <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Inquilino</p>
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-800 flex items-center">
                        <User className="w-3.5 h-3.5 mr-1.5 text-slate-450" />
                        {contract.inquilinoName}
                      </p>
                      <p className="text-slate-500 font-mono pl-5">DNI: {contract.inquilinoDocument}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Ubicación</p>
                    <div className="space-y-0.5">
                      <p className="font-bold text-purple-600 flex items-center font-sans">
                        <Building className="w-3.5 h-3.5 mr-1.5 text-purple-500" />
                        {contract.propertyName}
                      </p>
                      <p className="text-slate-500 pl-5 font-mono">Habitación {contract.roomNumber}</p>
                    </div>
                  </div>
                </div>

                {/* Resumen Financiero */}
                <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-2xl text-center border border-slate-100">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Renta</span>
                    <p className="text-xs font-extrabold text-slate-850 mt-1 font-mono">S/. {contract.amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Inicio</span>
                    <p className="text-[10px] font-semibold text-slate-700 mt-1 font-mono">{formatDate(contract.startDate)}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Fin</span>
                    <p className={`text-[10px] font-bold mt-1 font-mono ${nearExpiration ? 'text-red-600' : 'text-slate-750'}`}>{formatDate(contract.endDate)}</p>
                  </div>
                </div>

                {services.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {services.map((service) => (
                      <span key={service} className="px-2.5 py-0.5 bg-purple-50 text-purple-600 border border-purple-100 text-[10px] font-bold rounded-full">
                        {service}
                      </span>
                    ))}
                  </div>
                )}

                {/* Botón de Visualización de Documento y Renovación */}
                <div className="pt-2 border-t border-slate-100 flex gap-2">
                  {isDraft && (
                    <button
                      onClick={() => openEditModal(contract)}
                      className="flex items-center justify-center py-2 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-all shadow-sm gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Editar
                    </button>
                  )}
                  {nearExpiration ? (
                    <button
                      onClick={() => openRenewModal(contract)}
                      className="w-full flex items-center justify-center py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex-1 gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Renovar Ahora
                    </button>
                  ) : (
                    <button
                      onClick={() => openContractModal(contract)}
                      className="w-full flex items-center justify-center py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex-1 gap-1.5"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      {isDraft ? 'Ver Borrador' : 'Ver Contrato Legal'}
                    </button>
                  )}
                </div>

              </div>
            );
          })
        )}
      </div>
      <Pagination
        currentPage={currentPage}
        totalItems={filteredContratos.length}
        pageSize={PAGE_SIZE}
        onPageChange={setCurrentPage}
        itemLabel="contratos"
      />

      {/* MODAL DETALLES DEL CONTRATO (PROPIETARIO / DETALLE COMPLETO CON WATERMARK Y BANNER) */}
      {showDocModal && selectedContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDocModal(false)} />
          
          <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl z-10 flex flex-col max-h-[90vh] relative">
            
            {/* Overlay Watermark de copia digital */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center select-none overflow-hidden opacity-5 rotate-[-25deg] z-0">
              <span className="text-4xl md:text-5xl font-black text-slate-900 tracking-widest whitespace-nowrap">
                Copia digital - Roomly SaaS
              </span>
            </div>

            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50 z-10">
              <div>
                <h3 className="text-md font-bold text-slate-900">Documento de Arrendamiento</h3>
                <p className="text-[10px] text-slate-400">Contrato legal y validaciones de firmas</p>
              </div>
              <button onClick={() => setShowDocModal(false)} className="text-slate-400 hover:text-slate-900 text-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700 leading-relaxed font-sans z-10">
              
              {/* Banner de firma digitalizada */}
              {selectedContract.signatureUrl ? (
                <div className="p-3 bg-emerald-50 border border-emerald-150 rounded-xl text-emerald-800 font-semibold flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Firmado digitalmente por {selectedContract.inquilinoName} el {formatDate(selectedContract.startDate)}.</span>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-150 rounded-xl text-amber-850 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Contrato en estado borrador, pendiente de firma por el inquilino.</span>
                </div>
              )}

              <div className="border border-slate-200 rounded-2xl p-6 bg-amber-50/15 shadow-inner space-y-4">
                <div className="text-center font-bold text-slate-900 text-sm uppercase tracking-tight">
                  CONTRATO DE ARRENDAMIENTO DE HABITACIÓN PRIVADA
                </div>

                <div className="space-y-3.5 text-xs text-slate-650">
                  <p>
                    Conste por el presente documento el contrato de arrendamiento que celebran, de una parte **{getLandlordName(selectedContract)}**{selectedContract.landlordRuc ? ` con RUC N° ${selectedContract.landlordRuc}` : ''} (en adelante **El Arrendador**), y de la otra parte don/doña **{selectedContract.inquilinoName}** con Documento Nacional de Identidad N° **{selectedContract.inquilinoDocument}** (en adelante **El Arrendatario**), bajo los términos y condiciones siguientes:
                  </p>

                  {selectedContract.landlordAddress && (
                    <p>
                      **DOMICILIO DEL ARRENDADOR:** {selectedContract.landlordAddress}.
                    </p>
                  )}
                  
                  <p>
                    **PRIMERA (Objeto):** El Arrendador cede en arrendamiento al Arrendatario la **Habitación N° {selectedContract.roomNumber}** ubicada en la propiedad **{selectedContract.propertyName}**.
                  </p>

                  {getContractServices(selectedContract).length > 0 && (
                    <p>
                      **SERVICIOS INCLUIDOS:** {getContractServices(selectedContract).join(', ')}.
                    </p>
                  )}
                  
                  <p>
                    **SEGUNDA (Plazo):** El plazo del contrato inicia el **{formatDate(selectedContract.startDate)}** y concluye el **{formatDate(selectedContract.endDate)}**.
                  </p>
                  
                  <p>
                    **TERCERA (Renta):** El Arrendatario pagará al Arrendador una renta mensual pactada en **S/. {selectedContract.amount.toFixed(2)}**.
                  </p>

                  <p>
                    **CUARTA (Mora):** Aplica recargo automático de S/. {lateFeePerDay.toFixed(2)} diarios después de {graceDays} días de retraso.
                  </p>

                  {selectedContract.specialTerms && (
                    <p>
                      **CONDICIONES ADICIONALES:** {selectedContract.specialTerms}
                    </p>
                  )}
                </div>

                {/* Firmas */}
                <div className="grid grid-cols-2 gap-8 border-t border-slate-200/65 pt-6 mt-6">
                  <div className="text-center space-y-3">
                    <div className="h-12 flex items-center justify-center font-mono text-slate-350 italic text-[10px] border-b border-dashed border-slate-300">
                      [ Firma Digitalizada ]
                    </div>
                    <p className="font-bold text-slate-800">El Arrendador</p>
                  </div>

                  <div className="text-center space-y-3">
                    <div className="h-12 flex items-center justify-center border-b border-dashed border-slate-300">
                      {selectedContract.signatureUrl ? (
                        <img 
                          src={`${getApiUrl()}${selectedContract.signatureUrl}`} 
                          alt="Firma Inquilino" 
                          className="h-full object-contain max-w-[120px]"
                        />
                      ) : (
                        <span className="font-mono text-rose-500 italic text-[9px]">[ Pendiente de Firma ]</span>
                      )}
                    </div>
                    <p className="font-bold text-slate-800">El Arrendatario</p>
                  </div>
                </div>
              </div>

            </div>

            <div className="flex justify-end p-4 border-t border-slate-100 bg-slate-50/50 z-10">
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

      {/* MODAL DE EDICION DE CONTRATO BORRADOR */}
      {showEditModal && contractToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />

          <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl z-10 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-md font-bold text-slate-950 flex items-center gap-1.5">
                  <Edit2 className="w-4 h-4 text-purple-650" />
                  Editar contrato borrador
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Los contratos vigentes o finalizados no se editan; se renuevan o se crea un nuevo borrador.
                </p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-900 font-bold">x</button>
            </div>

            <div className="text-xs space-y-1.5 p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-650">
              <p><span className="font-semibold text-slate-800">Inquilino:</span> {contractToEdit.inquilinoName}</p>
              <p><span className="font-semibold text-slate-800">Habitacion:</span> Cuarto {contractToEdit.roomNumber} ({contractToEdit.propertyName})</p>
            </div>

            <form onSubmit={handleUpdateContract} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Inicio</label>
                  <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-600 font-mono" required />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Fin</label>
                  <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-600 font-mono" required />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Renta (S/.)</label>
                  <input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-600 font-mono font-bold" required />
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl p-4 space-y-4">
                <div className="flex flex-col md:flex-row gap-3 md:items-end">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">RUC arrendador</label>
                    <input
                      type="text"
                      value={editLandlordRuc}
                      maxLength={11}
                      onChange={(e) => setEditLandlordRuc(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder="11 digitos"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-600 font-mono"
                    />
                  </div>
                  <button type="button" onClick={handleConsultSunat} disabled={consultingSunat || editLandlordRuc.replace(/\D/g, '').length !== 11} className="py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl">
                    {consultingSunat ? 'Consultando...' : 'Consultar SUNAT'}
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Razon social</label>
                  <input type="text" value={editLandlordName} onChange={(e) => setEditLandlordName(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-600" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Direccion fiscal</label>
                  <input type="text" value={editLandlordAddress} onChange={(e) => setEditLandlordAddress(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-600" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Condiciones adicionales</label>
                <textarea rows={3} value={editSpecialTerms} onChange={(e) => setEditSpecialTerms(e.target.value)} placeholder="Ej. uso de areas comunes, reglas internas, depositos, garantias..." className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-600 resize-none" />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="py-2 px-4 bg-transparent border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-semibold rounded-xl">
                  Cancelar
                </button>
                <button type="submit" disabled={savingEdit} className="py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-purple-100 disabled:opacity-50">
                  {savingEdit ? 'Guardando...' : 'Guardar borrador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE RENOVACIÓN DE CONTRATO (PROPIETARIO) */}
      {showRenewModal && contractToRenew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowRenewModal(false)} />
          
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl z-10 p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-md font-bold text-slate-950 flex items-center gap-1">
                <RefreshCw className="w-4 h-4 text-purple-650" />
                Renovar Contrato
              </h3>
              <button onClick={() => setShowRenewModal(false)} className="text-slate-400 hover:text-slate-900 font-bold">✕</button>
            </div>

            <div className="text-xs space-y-1.5 p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-650">
              <p><span className="font-semibold text-slate-800">Inquilino:</span> {contractToRenew.inquilinoName}</p>
              <p><span className="font-semibold text-slate-800">Habitación:</span> Cuarto {contractToRenew.roomNumber} ({contractToRenew.propertyName})</p>
              <p><span className="font-semibold text-slate-800">Vencimiento anterior:</span> {formatDate(contractToRenew.endDate)}</p>
            </div>

            <form onSubmit={handleRenewContract} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Inicio Nuevo Contrato</label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-600 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Fin Nuevo Contrato</label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-600 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Monto de Renta Nuevo (S/.)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-600 font-mono font-bold"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRenewModal(false)}
                  className="py-2 px-4 bg-transparent border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={renewing}
                  className="py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-purple-100 disabled:opacity-50"
                >
                  {renewing ? 'Renovando...' : 'Crear Renovación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
