import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Plus, Trash2, FileText, Check, Clock, DollarSign } from 'lucide-react';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

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
  status: string; // PENDIENTE, PAGADO, PAGADO_PARCIAL, VENCIDO, CANCELADO
  paymentType: string; // ALQUILER, SERVICIO
  description?: string;
  receiptReference?: string;
}

interface Inquilino {
  id: number;
  name: string;
  roomId?: number;
  roomNumber?: string;
}

export const Pagos: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [inquilinos, setInquilinos] = useState<Inquilino[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados Modal Registrar Pago (Cobro)
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [amountToAdd, setAmountToAdd] = useState('');
  const [receiptReference, setReceiptReference] = useState('');

  // Estados Modal Generar Factura/Cobro
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInquilinoId, setSelectedInquilinoId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paymentType, setPaymentType] = useState('ALQUILER');
  const [description, setDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<number | null>(null);

  const fetchPaymentsAndInquilinos = async () => {
    setLoading(true);
    setError(null);
    try {
      const [payRes, inqRes] = await Promise.all([
        api.get('/payments'),
        api.get('/inquilinos')
      ]);
      setPayments(payRes.data);
      setInquilinos(inqRes.data);
    } catch (err: any) {
      console.error('Error fetching payments data:', err);
      setError('No se pudo cargar la información de pagos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentsAndInquilinos();
  }, []);

  // Pre-llenar monto de la renta sugerido cuando se selecciona el inquilino en paso 1
  const handleInquilinoSelect = (idStr: string) => {
    setSelectedInquilinoId(idStr);
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquilinoId || !amount || !dueDate) return;
    setSubmitting(true);
    setError(null);

    const inq = inquilinos.find(i => i.id === parseInt(selectedInquilinoId));

    const payload = {
      inquilinoId: parseInt(selectedInquilinoId),
      roomId: inq?.roomId || null,
      amount: parseFloat(amount),
      dueDate,
      paymentType,
      description
    };

    try {
      await api.post('/payments', payload);
      setShowCreateModal(false);
      // Limpiar campos
      setSelectedInquilinoId('');
      setAmount('');
      setDueDate('');
      setPaymentType('ALQUILER');
      setDescription('');
      fetchPaymentsAndInquilinos();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear la orden de cobro.');
    } finally {
      setSubmitting(false);
    }
  };

  const openCollectModal = (pay: Payment) => {
    setSelectedPayment(pay);
    // Sugerir monto pendiente total (amount - amountPaid + delayPenalty)
    const pending = (pay.amount - pay.amountPaid) + pay.delayPenalty;
    setAmountToAdd(String(pending));
    setReceiptReference(pay.receiptReference || '');
    setShowCollectModal(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment || !amountToAdd) return;
    setSubmitting(true);
    setError(null);

    try {
      await api.put(`/payments/${selectedPayment.id}/record`, {
        amountToAdd: parseFloat(amountToAdd),
        receiptReference
      });
      setShowCollectModal(false);
      fetchPaymentsAndInquilinos();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al registrar el cobro.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletePaymentId(id);
  };

  const confirmDeletePayment = async () => {
    if (deletePaymentId === null) return;
    try {
      await api.delete(`/payments/${deletePaymentId}`);
      setDeletePaymentId(null);
      fetchPaymentsAndInquilinos();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al eliminar el cobro.');
    }
  };

  const formatDate = (dateStr: string | Date | undefined) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getFechaPago = (pay: Payment) => {
    if (pay.status !== 'PAGADO') return '';
    if (pay.lastPaymentDate) return formatDate(pay.lastPaymentDate);
    // Fallback: 4 días antes del vencimiento
    const d = new Date(pay.dueDate);
    d.setDate(d.getDate() - 4);
    return formatDate(d);
  };

  const paymentsPaid = payments.filter(p => p.status === 'PAGADO');
  const totalCobrado = paymentsPaid.reduce((sum, p) => sum + p.amountPaid, 0);
  const pagosCobradosCount = paymentsPaid.length;

  const paymentsPending = payments.filter(p => p.status === 'PENDIENTE' || p.status === 'VENCIDO' || p.status === 'PAGADO_PARCIAL');
  const totalPendiente = paymentsPending.reduce((sum, p) => sum + (p.amount - p.amountPaid), 0);
  const pagosPendientesCount = paymentsPending.length;

  const totalSum = totalCobrado + totalPendiente;
  const tasaCobranza = totalSum > 0 ? Math.round((totalCobrado / totalSum) * 100) : 0;

  if (loading && payments.length === 0) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mr-3" />
        Cargando cuentas...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subheader */}
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-slate-500 font-medium">Registra cobros periódicos de alquileres o servicios y controla el registro de moras.</p>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center py-2.5 px-6 bg-[#A855F7] hover:bg-purple-650 text-white text-sm font-bold rounded-xl transition-all shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Generar Cobro
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          {error}
        </div>
      )}

      {/* 3 TARJETAS DE MÉTRICAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total cobrado */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total cobrado</p>
            <h3 className="text-3xl font-extrabold text-slate-900">S/. {totalCobrado}</h3>
            <p className="text-[11px] text-slate-400 font-semibold">De {pagosCobradosCount} pagos realizados</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100 shadow-sm">
            <Check className="w-6 h-6" />
          </div>
        </div>

        {/* Pendiente */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pendiente</p>
            <h3 className="text-3xl font-extrabold text-slate-900">S/. {totalPendiente}</h3>
            <p className="text-[11px] text-slate-400 font-semibold">De {pagosPendientesCount} cobros pendientes</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100 shadow-sm">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Tasa de Cobranza */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tasa de Cobranza</p>
            <h3 className="text-3xl font-extrabold text-slate-900">{tasaCobranza}%</h3>
            <p className="text-[11px] text-slate-400 font-semibold">Éxito en pagos</p>
          </div>
          <div className="w-12 h-12 bg-purple-50 text-[#A855F7] rounded-2xl flex items-center justify-center border border-purple-100 shadow-sm">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* TABLA DE COBROS */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse border border-slate-200">
            <thead>
              <tr className="bg-[#DFCEFC] text-sm text-slate-800 font-bold border-b border-slate-200">
                <th className="px-6 py-4 border-r border-slate-200">Inquilino</th>
                <th className="px-6 py-4 border-r border-slate-200">Monto</th>
                <th className="px-6 py-4 border-r border-slate-200">Fecha de Vencimiento</th>
                <th className="px-6 py-4 border-r border-slate-200">Fecha de Pago</th>
                <th className="px-6 py-4 border-r border-slate-200">Estado</th>
                <th className="px-6 py-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm text-slate-700 bg-white">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 border border-slate-200">
                    No hay recibos de pagos generados aún.
                  </td>
                </tr>
              ) : (
                payments.map((pay) => {
                  let statusLabel = 'Pendiente';
                  if (pay.status === 'PAGADO') {
                    statusLabel = 'Pagado';
                  } else if (pay.status === 'PAGADO_PARCIAL') {
                    statusLabel = 'Pago Parcial';
                  } else if (pay.status === 'VENCIDO') {
                    statusLabel = 'Vencido';
                  }

                  return (
                    <tr key={pay.id} className="hover:bg-slate-50/30 transition-colors">
                      {/* Inquilino */}
                      <td className="px-6 py-4 font-bold text-slate-800 border-r border-slate-200">
                        {pay.inquilinoName}
                      </td>

                      {/* Monto */}
                      <td className="px-6 py-4 font-bold text-slate-800 border-r border-slate-200">
                        S/. {pay.amount}
                      </td>

                      {/* Fecha de Vencimiento */}
                      <td className="px-6 py-4 text-slate-500 font-mono text-xs border-r border-slate-200">
                        {formatDate(pay.dueDate)}
                      </td>

                      {/* Fecha de Pago */}
                      <td className="px-6 py-4 text-slate-500 font-mono text-xs border-r border-slate-200">
                        {getFechaPago(pay)}
                      </td>

                      {/* Estado */}
                      <td className="px-6 py-4 text-slate-800 font-bold border-r border-slate-200">
                        {statusLabel}
                      </td>

                      {/* Acciones */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          {pay.status !== 'PAGADO' && pay.status !== 'CANCELADO' && (
                            <button
                              onClick={() => openCollectModal(pay)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-100 rounded-lg text-[10px] font-bold transition-all shadow-sm"
                            >
                              Cobrar
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(pay.id)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL REGISTRAR COBRO (DE PAGO EXISTENTE) */}
      {showCollectModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCollectModal(false)} />
          
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl z-10 p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-md font-bold text-slate-900">Registrar Cobro</h3>
              <button onClick={() => setShowCollectModal(false)} className="text-slate-400 hover:text-slate-900">✕</button>
            </div>

            <div className="text-xs space-y-1.5 p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-600">
              <p><span className="font-semibold text-slate-800">Inquilino:</span> {selectedPayment.inquilinoName}</p>
              <p><span className="font-semibold text-slate-800">Concepto:</span> {selectedPayment.paymentType}</p>
              <p><span className="font-semibold text-slate-800">Importe Original:</span> ${selectedPayment.amount.toFixed(2)}</p>
              <p><span className="font-semibold text-slate-800">Ya Abonado:</span> ${selectedPayment.amountPaid.toFixed(2)}</p>
              {selectedPayment.delayPenalty > 0 && (
                <p className="text-red-500 font-semibold">
                  Mora acumulada: +${selectedPayment.delayPenalty.toFixed(2)}
                </p>
              )}
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Monto a Cobrar ($)</label>
                <input
                  type="number"
                  placeholder="ej: 120.00"
                  value={amountToAdd}
                  onChange={(e) => setAmountToAdd(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-600"
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Referencia / Comprobante (Opcional)</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-450" />
                  <input
                    type="text"
                    placeholder="ej: Depósito #45622 o Efectivo"
                    value={receiptReference}
                    onChange={(e) => setReceiptReference(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCollectModal(false)}
                  className="py-2 px-4 bg-transparent border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-100 disabled:opacity-50"
                >
                  {submitting ? 'Registrando...' : 'Registrar Cobro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL GENERAR NUEVO COBRO */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl z-10 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-md font-bold text-slate-900">Generar Orden de Cobro</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-900">✕</button>
            </div>

            <form onSubmit={handleCreatePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Seleccionar Inquilino</label>
                <select
                  value={selectedInquilinoId}
                  onChange={(e) => handleInquilinoSelect(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-600"
                  required
                >
                  <option value="">-- Elige un inquilino --</option>
                  {inquilinos.map(i => (
                    <option key={i.id} value={i.id}>{i.name} (Cuarto: {i.roomNumber || 'Propiedad completa'})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Monto Cobro ($)</label>
                  <input
                    type="number"
                    placeholder="ej: 150.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-600"
                    step="0.01"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Tipo de Cobro</label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-600"
                  >
                    <option value="ALQUILER">ALQUILER</option>
                    <option value="SERVICIO">SERVICIO</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Fecha de Vencimiento</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-600 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Concepto / Descripción</label>
                <input
                  type="text"
                  placeholder="ej: Renta correspondiente a Junio 2026"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="py-2 px-4 bg-transparent border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-purple-100 disabled:opacity-50"
                >
                  {submitting ? 'Generando...' : 'Generar Cobro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deletePaymentId !== null}
        title="Eliminar Cobro"
        message="¿Está seguro de que desea eliminar este registro de cobro? Esta acción es irreversible."
        isDestructive
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={confirmDeletePayment}
        onCancel={() => setDeletePaymentId(null)}
      />
    </div>
  );
};
