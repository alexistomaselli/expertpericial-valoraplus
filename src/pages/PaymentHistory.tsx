import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CreditCard, Calendar, Euro, RefreshCw, AlertCircle } from 'lucide-react';
import { usePaymentHistory, Payment } from '@/hooks/use-payment-history';

const PaymentHistory: React.FC = () => {
  const { payments, loading, error, refreshPaymentHistory } = usePaymentHistory();

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'succeeded':
        return 'text-green-600 bg-green-50';
      case 'pending':
      case 'requires_payment_method':
        return 'text-yellow-600 bg-yellow-50';
      case 'failed':
      case 'canceled':
        return 'text-red-600 bg-red-50';
      case 'processing':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
      case 'succeeded':
        return 'Completado';
      case 'pending':
      case 'requires_payment_method':
        return 'Pendiente de pago';
      case 'failed':
      case 'canceled':
        return 'Cancelado';
      case 'processing':
        return 'Procesando';
      default:
        return status;
    }
  };

  const PaymentCard: React.FC<{ payment: Payment }> = ({ payment }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <CreditCard className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {payment.description || 'Análisis Pericial'}
            </h3>
            <p className="text-sm text-gray-500">ID: {payment.id}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(payment.status)}`}>
          {getStatusText(payment.status)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center space-x-2">
          <Euro className="h-4 w-4 text-gray-400" />
          <span className="text-lg font-semibold text-gray-900">
            {formatAmount(payment.amount_cents, payment.currency)}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            {formatDate(payment.created_at)}
          </span>
        </div>
      </div>

      {payment.analysis_month && (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Mes de análisis:</span> {payment.analysis_month}
          </p>
          {payment.workshop_id && (
            <p className="text-sm text-gray-600 mt-1">
              <span className="font-medium">Taller ID:</span> {payment.workshop_id}
            </p>
          )}
          <p className="text-sm text-gray-600 mt-1">
            <span className="font-medium">Análisis comprados:</span> {payment.analyses_purchased}
          </p>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
            <span className="ml-3 text-lg text-gray-600">Cargando historial de pagos...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-sm p-8">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Error al cargar el historial</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <button
                onClick={refreshPaymentHistory}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/app/mi-cuenta"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Mi Cuenta
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Historial de Pagos</h1>
              <p className="text-gray-600 mt-2">
                Revisa todos tus pagos y transacciones realizadas
              </p>
            </div>
            <button
              onClick={refreshPaymentHistory}
              className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </button>
          </div>
        </div>

        {/* Payment Statistics */}
        {payments && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <CreditCard className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total de Pagos</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {payments.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-50 rounded-lg">
                  <Euro className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pagos Completados</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {payments.filter(p => p.status === 'completed' || p.status === 'succeeded').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-50 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pagos Pendientes</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {payments.filter(p => p.status === 'pending' || p.status === 'requires_payment_method').length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment List */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Transacciones</h2>
          </div>

          {payments.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay pagos registrados
              </h3>
              <p className="text-gray-600 mb-6">
                Aún no has realizado ningún pago en nuestro sistema.
              </p>
              <Link
                to="/app/nuevo-analisis"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Crear Nuevo Análisis
              </Link>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {payments.map((payment) => (
                <PaymentCard key={payment.id} payment={payment} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentHistory;