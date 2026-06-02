import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../../core/services/api';
import { useAuthStore } from '../../../features/auth/store/useAuthStore';
import { 
  Building2, 
  Users, 
  DollarSign, 
  Plus,
  MapPin,
  Settings,
  Trash2,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Upload
} from 'lucide-react';
import { ConfirmModal } from '../../../core/components/ui/ConfirmModal';
import { Pagination } from '../../../core/components/ui/Pagination';

interface Property {
  id: number;
  name: string;
  address: string;
  price: number | null;
  services?: string;
  rooms?: any[];
  inquilinos?: any[];
}

interface InquilinoInfo {
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

interface Payment {
  id: number;
  inquilinoId: number;
  inquilinoName: string;
  roomId?: number;
  roomNumber?: string;
  amount: number;
  amountPaid: number;
  delayPenalty: number;
  dueDate: string;
  lastPaymentDate?: string;
  status: string;
  paymentType: string;
  description?: string;
  receiptReference?: string;
}

const PAGE_SIZE = 8;
const SERVICE_LABELS: Record<string, string> = {
  wifi: 'WiFi',
  WiFi: 'WiFi',
  Estacionamiento: 'Estacionamiento',
  Gimnasio: 'Gimnasio',
  Piscina: 'Piscina'
};

export const Dashboard: React.FC = () => {
  const { tenant } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Estados de Propietario (Admin)
  const [properties, setProperties] = useState<Property[]>([]);
  const [activeTenants, setActiveTenants] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0); // Recaudado
  const [projectedRevenue, setProjectedRevenue] = useState(0); // Proyectado
  const [occupancyRate, setOccupancyRate] = useState(0); // Ocupación Global
  const [allPayments, setAllPayments] = useState<Payment[]>([]); // Pagos para alertas de mora
  const [urgentTickets, setUrgentTickets] = useState<any[]>([]); // Incidencias pendientes urgentes
  const [deletePropertyId, setDeletePropertyId] = useState<number | null>(null);

  // Estados de Inquilino (Resident)
  const [inquilinoInfo, setInquilinoInfo] = useState<InquilinoInfo | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pendingContract, setPendingContract] = useState<any | null>(null);
  const [selectedPaymentForReport, setSelectedPaymentForReport] = useState<Payment | null>(null);
  const [reportAmount, setReportAmount] = useState('');
  const [reportRef, setReportRef] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [paymentsPage, setPaymentsPage] = useState(1);

  // Estados generales
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (user?.role === 'INQUILINO') {
        // Cargar datos del inquilino, sus pagos y contratos
        const [meRes, payRes, contractRes] = await Promise.all([
          api.get('/inquilinos/me'),
          api.get('/payments'),
          api.get('/contratos')
        ]);
        setInquilinoInfo(meRes.data);
        setPayments(payRes.data);
        
        // Buscar si hay algún contrato pendiente de firma
        const pending = contractRes.data.find((c: any) => c.status === 'PENDIENTE_FIRMA');
        setPendingContract(pending || null);
      } else {
        // Cargar datos del propietario (propiedades, inquilinos, pagos, incidencias)
        const [propRes, inqRes, payRes, ticketRes] = await Promise.all([
          api.get('/properties'),
          api.get('/inquilinos'),
          api.get('/payments'),
          api.get('/mantenimiento')
        ]);

        const props = propRes.data;
        const inqs = inqRes.data;
        const pays = payRes.data;
        const ticketsList = ticketRes.data;

        // Calcular inquilinos activos
        const activeCount = inqs.filter((i: any) => i.status === 'ACTIVO').length;

        // Calcular KPIs de Ocupación
        let totalRooms = 0;
        let occupiedRooms = 0;
        let projected = 0;

        props.forEach((p: any) => {
          if (p.rooms) {
            totalRooms += p.rooms.length;
            p.rooms.forEach((r: any) => {
              if (r.status === 'Ocupado') {
                occupiedRooms++;
                projected += r.price; // Ingreso proyectado por cuarto alquilado
              }
            });
          }
        });

        const globalOccupancy = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

        // Calcular lo recaudado
        let collected = 0;
        pays.forEach((p: any) => {
          collected += p.amountPaid;
        });

        setProperties(props);
        setActiveTenants(activeCount);
        setMonthlyRevenue(collected);
        setProjectedRevenue(projected);
        setOccupancyRate(globalOccupancy);
        setAllPayments(pays);
        setUrgentTickets(ticketsList.filter((t: any) => t.status === 'PENDIENTE' && t.priority === 'ALTA'));
      }
    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err);
      setError('No se pudo cargar la información del panel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const handleDeleteProperty = async (id: number) => {
    setDeletePropertyId(id);
  };

  const confirmDeleteProperty = async () => {
    if (deletePropertyId === null) return;
    try {
      await api.delete(`/properties/${deletePropertyId}`);
      setDeletePropertyId(null);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al eliminar la propiedad.');
    }
  };

  const openReportModal = (payment: Payment) => {
    const remaining = payment.amount + payment.delayPenalty - payment.amountPaid;
    setSelectedPaymentForReport(payment);
    setReportAmount(remaining.toString());
    setReportRef('');
    setShowReportModal(true);
  };

  const handleReportPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentForReport || !reportAmount || parseFloat(reportAmount) <= 0) return;

    setReporting(true);
    try {
      await api.put(`/payments/${selectedPaymentForReport.id}/record`, {
        amountToAdd: parseFloat(reportAmount),
        receiptReference: reportRef
      });
      setShowReportModal(false);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al reportar el pago.');
    } finally {
      setReporting(false);
    }
  };

  const totalPaymentPages = Math.max(1, Math.ceil(payments.length / PAGE_SIZE));
  const paginatedPayments = payments.slice((paymentsPage - 1) * PAGE_SIZE, paymentsPage * PAGE_SIZE);

  useEffect(() => {
    if (paymentsPage > totalPaymentPages) {
      setPaymentsPage(totalPaymentPages);
    }
  }, [paymentsPage, totalPaymentPages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mr-3" />
        Cargando estadísticas...
      </div>
    );
  }

  // ==========================================
  // RENDER PORTAL INQUILINO
  // ==========================================
  if (user?.role === 'INQUILINO') {
    const totalPending = payments
      .filter(p => p.status !== 'PAGADO' && p.status !== 'CANCELADO')
      .reduce((sum, p) => sum + (p.amount + p.delayPenalty - p.amountPaid), 0);

    return (
      <div className="space-y-8">
        {/* Bienvenida */}
        <div className="bg-gradient-to-r from-purple-900/10 to-transparent p-6 rounded-3xl border border-purple-100/30 space-y-2">
          <h2 className="text-xl font-extrabold text-slate-900 leading-tight">
            ¡Hola, {user.firstName}!
          </h2>
          <p className="text-xs text-slate-500 max-w-xl">
            Desde este portal puedes consultar tus contratos vigentes, revisar tus recibos y reportar tus comprobantes de pago de forma directa y sencilla.
          </p>
        </div>

        {/* Alerta de Contrato Pendiente */}
        {pendingContract && (
          <div className="bg-rose-50 border border-rose-250 p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-pulse">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-rose-800 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2 shrink-0 text-rose-600" />
                Tienes un contrato de arrendamiento pendiente de firma
              </h4>
              <p className="text-xs text-rose-600">
                Para la Habitación <strong>{pendingContract.roomNumber}</strong> en el edificio <strong>{pendingContract.propertyName}</strong>. Por favor, revísalo y fírmalo para oficializar tu arriendo.
              </p>
            </div>
            <Link
              to={`/${tenant}/contratos`}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl text-center shrink-0 transition-colors shadow-md shadow-rose-100"
            >
              Ver y Firmar Contrato
            </Link>
          </div>
        )}

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
            {error}
          </div>
        )}

        {/* Métrica / Estado de Pagos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tarjeta 1: Alquiler Actual */}
          <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mi Alquiler</span>
              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-bold rounded-full uppercase">
                {inquilinoInfo?.status}
              </span>
            </div>
            
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-slate-900">
                {inquilinoInfo?.propertyName || 'Sin edificio asignado'}
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Habitación: {inquilinoInfo?.roomNumber || 'Por asignar'}
              </p>
            </div>

            <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Mensualidad</span>
                <p className="font-extrabold text-slate-800">S/. 550.00</p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Documento</span>
                <p className="font-mono text-slate-600">{inquilinoInfo?.document}</p>
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Resumen Pendiente */}
          <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex flex-col justify-between space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Saldo Pendiente</span>
              <CreditCard className="w-5 h-5 text-purple-600" />
            </div>

            <div className="space-y-1">
              <h3 className="text-3xl font-black text-slate-900">
                S/. {totalPending.toFixed(2)}
              </h3>
              <p className="text-xs text-slate-400">
                Monto acumulado por cobrar de alquileres o servicios.
              </p>
            </div>

            <div className="pt-2">
              {totalPending > 0 ? (
                <div className="flex items-center text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-100 p-2.5 rounded-xl">
                  <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
                  Tienes comprobantes pendientes por pagar y reportar.
                </div>
              ) : (
                <div className="flex items-center text-xs text-emerald-600 font-semibold bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 mr-2 shrink-0" />
                  Estás al día con tus pagos. ¡Excelente!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sección: Mis Pagos Recientes */}
        <div className="space-y-4">
          <h2 className="text-lg font-extrabold text-slate-950">Mis Recibos y Pagos</h2>

          {payments.length === 0 ? (
            <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl text-slate-450">
              No se han encontrado registros de pagos asociados a tu cuenta.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="px-6 py-4">Concepto</th>
                      <th className="px-6 py-4">Monto Base</th>
                      <th className="px-6 py-4">Mora</th>
                      <th className="px-6 py-4">Pagado</th>
                      <th className="px-6 py-4">F. Vencimiento</th>
                      <th className="px-6 py-4">Estado</th>
                      <th className="px-6 py-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {paginatedPayments.map((pay) => {
                      const pending = pay.amount + pay.delayPenalty - pay.amountPaid;
                      return (
                        <tr key={pay.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 font-bold text-slate-800">
                            {pay.paymentType === 'ALQUILER' ? 'Pago de Alquiler' : `Servicio: ${pay.description || 'General'}`}
                            {pay.receiptReference && (
                              <p className="text-[10px] text-slate-400 font-mono font-normal mt-0.5">Ref: {pay.receiptReference}</p>
                            )}
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-700">S/. {pay.amount.toFixed(2)}</td>
                          <td className="px-6 py-4 text-rose-600 font-semibold">
                            {pay.delayPenalty > 0 ? `S/. ${pay.delayPenalty.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-6 py-4 text-emerald-600 font-semibold">S/. {pay.amountPaid.toFixed(2)}</td>
                          <td className="px-6 py-4 font-mono text-slate-500">{pay.dueDate}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wider ${
                              pay.status === 'PAGADO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' :
                              pay.status === 'PAGADO_PARCIAL' ? 'bg-indigo-50 text-indigo-700 border-indigo-200/50' :
                              pay.status === 'VENCIDO' ? 'bg-rose-50 text-rose-700 border-rose-250/20' :
                              'bg-amber-50 text-amber-700 border-amber-200/50'
                            }`}>
                              {pay.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {pending > 0 ? (
                              <button
                                onClick={() => openReportModal(pay)}
                                className="inline-flex items-center px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold rounded-lg transition-all"
                              >
                                <Upload className="w-3 h-3 mr-1" />
                                Reportar Pago
                              </button>
                            ) : (
                              <span className="text-slate-400 font-semibold text-[10px]">Al día</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={paymentsPage}
                totalItems={payments.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPaymentsPage}
                itemLabel="recibos"
              />
            </div>
          )}
        </div>

        {/* Modal de Reportar Pago */}
        {showReportModal && selectedPaymentForReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setShowReportModal(false)} />
            <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl z-10 p-6 md:p-8 space-y-6 animate-modal-in">
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-slate-900 leading-tight">Reportar Transferencia / Pago</h3>
                <p className="text-xs text-slate-500">
                  Ingresa los detalles del depósito o transferencia bancaria realizada para que el propietario valide tu abono.
                </p>
              </div>

              <form onSubmit={handleReportPayment} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Monto Depositado (S/.)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={reportAmount}
                    onChange={(e) => setReportAmount(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Código / Referencia de Operación</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: BCP Nro 493029"
                    value={reportRef}
                    onChange={(e) => setReportRef(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650"
                  />
                </div>

                <div className="flex space-x-3 pt-2">
                  <button
                     type="submit"
                     disabled={reporting}
                     className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                  >
                    {reporting ? 'Enviando...' : 'Confirmar Reporte'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="flex-1 py-2.5 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER PANEL DE PROPIETARIO
  // ==========================================
  return (
    <div className="space-y-8">
      {/* 4 TARJETAS DE MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Métrica 1: Ocupación Global */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ocupación Global</p>
            <h3 className="text-3xl font-extrabold text-slate-900">{occupancyRate}%</h3>
          </div>
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center border border-purple-100 shadow-sm">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        {/* Métrica 2: Ingresos Recaudados */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ingresos Recaudados</p>
            <h3 className="text-3xl font-extrabold text-slate-900">S/. {monthlyRevenue.toFixed(2)}</h3>
          </div>
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center border border-purple-100 shadow-sm">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Métrica 3: Meta Mensual (Proyectado) */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ingreso Proyectado</p>
            <h3 className="text-3xl font-extrabold text-slate-900">S/. {projectedRevenue.toFixed(2)}</h3>
          </div>
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center border border-purple-100 shadow-sm">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        {/* Métrica 4: Inquilinos activos */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inquilinos activos</p>
            <h3 className="text-3xl font-extrabold text-slate-900">{activeTenants}</h3>
          </div>
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center border border-purple-100 shadow-sm">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Alertas Operativas (Morosidad y Tickets Urgentes) */}
      {(allPayments.filter(p => p.status === 'VENCIDO').length > 0 || urgentTickets.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Alertas de Morosidad */}
          {allPayments.filter(p => p.status === 'VENCIDO').length > 0 && (
            <div className="bg-rose-50/50 border border-rose-200 p-6 rounded-3xl space-y-4">
              <h3 className="text-sm font-bold text-rose-800 flex items-center">
                <AlertCircle className="w-4.5 h-4.5 mr-2 text-rose-600 shrink-0" />
                Alertas de Morosidad ({allPayments.filter(p => p.status === 'VENCIDO').length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {allPayments.filter(p => p.status === 'VENCIDO').map(p => {
                  const daysLate = Math.ceil(Math.abs(new Date().getTime() - new Date(p.dueDate).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={p.id} className="bg-white border border-rose-100 p-3 rounded-xl flex justify-between items-center text-xs shadow-sm">
                      <div>
                        <p className="font-bold text-slate-800">{p.inquilinoName}</p>
                        <p className="text-[10px] text-rose-600 font-medium mt-0.5">
                          Mora acumulada: S/. {p.delayPenalty.toFixed(2)} ({daysLate} días de retraso)
                        </p>
                      </div>
                      <span className="font-extrabold text-slate-700">S/. {(p.amount + p.delayPenalty).toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tickets de Mantenimiento Pendientes Urgentes */}
          {urgentTickets.length > 0 && (
            <div className="bg-amber-50/50 border border-amber-200 p-6 rounded-3xl space-y-4">
              <h3 className="text-sm font-bold text-amber-800 flex items-center">
                <AlertCircle className="w-4.5 h-4.5 mr-2 text-amber-600 shrink-0" />
                Incidencias Pendientes Urgentes ({urgentTickets.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {urgentTickets.map(t => (
                  <div key={t.id} className="bg-white border border-amber-100 p-3 rounded-xl flex justify-between items-center text-xs shadow-sm">
                    <div>
                      <p className="font-bold text-slate-800">{t.title}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{t.propertyName} - Hab {t.roomNumber || 'General'}</p>
                    </div>
                    <Link
                      to={`/${tenant}/mantenimiento`}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded-lg transition-colors shrink-0 shadow-sm shadow-amber-50"
                    >
                      Ver Ticket
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}


      {/* SECCIÓN TUS PROPIEDADES */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-950">Tus propiedades</h2>
          <button
            onClick={() => navigate(`/${tenant}/propiedades`)}
            className="flex items-center py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-100"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Agregar propiedad
          </button>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
            {error}
          </div>
        )}

        {properties.length === 0 ? (
          <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl text-slate-450">
            No tienes propiedades registradas aún. ¡Comienza agregando una!
          </div>
        ) : (
          /* GRID DE PROPIEDADES */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {properties.map((prop) => {
              const roomsCount = prop.rooms?.length || 0;
              const occupiedRoomsCount = prop.rooms?.filter((r: any) => r.status === 'Ocupado').length || 0;
              const occupancyRate = roomsCount > 0 ? Math.round((occupiedRoomsCount / roomsCount) * 100) : 0;
              const inquilinosCount = prop.inquilinos?.length || 0;
              const propMonthlyRevenue = prop.rooms?.filter((r: any) => r.status === 'Ocupado').reduce((sum: number, r: any) => sum + r.price, 0) || 0;

              return (
                <div 
                  key={prop.id}
                  className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-200 space-y-5"
                >
                  {/* Header Card */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 leading-tight">{prop.name}</h3>
                      <div className="flex items-center text-slate-500 text-xs mt-1.5 font-medium">
                        <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                        <span>{prop.address}</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleDeleteProperty(prop.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Métricas */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#FAF7FD] border border-purple-100/30 p-3 rounded-2xl">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Habitaciones</p>
                      <p className="text-xl font-extrabold text-slate-900 mt-1">{roomsCount}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{occupiedRoomsCount} ocupados</p>
                    </div>
                    <div className="bg-[#FAF7FD] border border-purple-100/30 p-3 rounded-2xl">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ocupación</p>
                      <p className="text-xl font-extrabold text-slate-900 mt-1">{occupancyRate}%</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{inquilinosCount} inquilinos</p>
                    </div>
                    <div className="bg-[#FAF7FD] border border-purple-100/30 p-3 rounded-2xl">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ingresos</p>
                      <p className="text-xl font-extrabold text-slate-900 mt-1">S/. {propMonthlyRevenue}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">mensual</p>
                    </div>
                  </div>

                  {/* Servicios */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-700">Servicios</p>
                    <div className="flex flex-wrap gap-1.5">
                      {prop.services && prop.services.trim() !== '' ? (
                        prop.services.split(',').map((service) => service.trim()).filter(Boolean).map((service) => (
                          <span key={service} className="px-2.5 py-0.5 bg-purple-50 text-purple-600 border border-purple-100 text-[10px] font-semibold rounded-full">
                            {SERVICE_LABELS[service] || service}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium italic">Sin servicios asignados</span>
                      )}
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="flex space-x-3 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => navigate(`/${tenant}/propiedades`)}
                      className="flex-1 flex items-center justify-center py-2 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all"
                    >
                      <Settings className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                      Configuración
                    </button>
                    <Link
                      to={`/${tenant}/propiedades/${prop.id}`}
                      className="flex-1 flex items-center justify-center py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-purple-100"
                    >
                      Ver detalles
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deletePropertyId !== null}
        title="Eliminar Propiedad"
        message="¿Está seguro de que desea eliminar esta propiedad? Esto eliminará también todas sus habitaciones y contratos asociados."
        isDestructive
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={confirmDeleteProperty}
        onCancel={() => setDeletePropertyId(null)}
      />
    </div>
  );
};
