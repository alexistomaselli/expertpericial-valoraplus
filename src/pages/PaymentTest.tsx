import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const PaymentTest: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const testPaymentFlow = async () => {
    if (!user) {
      setResult('Error: Usuario no autenticado');
      return;
    }

    setLoading(true);
    setResult('Iniciando prueba de pago...');

    try {
      // 1. Crear sesión de pago
      setResult(prev => prev + '\n1. Creando sesión de pago...');
      
      const { data, error } = await supabase.functions.invoke('payment-session', {
        body: {
          amount: 10.00, // 10 euros de prueba
          currency: 'eur',
          description: 'Prueba de pago - Análisis adicional'
        }
      });

      if (error) {
        throw new Error(`Error creando sesión: ${error.message}`);
      }

      setResult(prev => prev + '\n✅ Sesión creada exitosamente');
      setResult(prev => prev + `\n   Session ID: ${data.session_id}`);
      setResult(prev => prev + `\n   URL de Stripe: ${data.url}`);

      // 2. Simular redirección a Stripe (en un entorno real, el usuario sería redirigido)
      setResult(prev => prev + '\n\n2. En un flujo real, el usuario sería redirigido a Stripe...');
      setResult(prev => prev + '\n   URL de éxito configurada: ' + data.url.split('success_url=')[1]?.split('&')[0]);

      // 3. Verificar que la URL de éxito incluya el session_id
      const successUrl = decodeURIComponent(data.url.split('success_url=')[1]?.split('&')[0] || '');
      if (successUrl.includes('{CHECKOUT_SESSION_ID}')) {
        setResult(prev => prev + '\n✅ URL de éxito incluye correctamente {CHECKOUT_SESSION_ID}');
      } else {
        setResult(prev => prev + '\n❌ URL de éxito NO incluye {CHECKOUT_SESSION_ID}');
      }

      setResult(prev => prev + '\n\n3. Para completar la prueba:');
      setResult(prev => prev + '\n   - Haz clic en el enlace de Stripe arriba');
      setResult(prev => prev + '\n   - Usa la tarjeta de prueba: 4242 4242 4242 4242');
      setResult(prev => prev + '\n   - Cualquier fecha futura y CVC');
      setResult(prev => prev + '\n   - Completa el pago');
      setResult(prev => prev + '\n   - Serás redirigido a /payment-success con el session_id');

    } catch (error) {
      setResult(prev => prev + `\n❌ Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!user) {
      setResult('Error: Usuario no autenticado');
      return;
    }

    setLoading(true);
    try {
      setResult('Verificando estado de pagos...\n');

      // Obtener historial de pagos
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        throw new Error(`Error obteniendo pagos: ${error.message}`);
      }

      if (!data || data.length === 0) {
        setResult(prev => prev + 'No se encontraron pagos para este usuario.');
        return;
      }

      setResult(prev => prev + `Últimos ${data.length} pagos:\n`);
      data.forEach((payment, index) => {
        setResult(prev => prev + `\n${index + 1}. ID: ${payment.id}`);
        setResult(prev => prev + `\n   Estado: ${payment.status}`);
        setResult(prev => prev + `\n   Cantidad: €${(payment.amount_cents / 100).toFixed(2)}`);
        setResult(prev => prev + `\n   Stripe Payment Intent: ${payment.stripe_payment_intent_id}`);
        setResult(prev => prev + `\n   Stripe Session: ${payment.stripe_session_id}`);
        setResult(prev => prev + `\n   Creado: ${new Date(payment.created_at).toLocaleString()}`);
        setResult(prev => prev + `\n   Actualizado: ${new Date(payment.updated_at).toLocaleString()}`)
        setResult(prev => prev + '\n');
      });

    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Acceso Denegado</h1>
          <p>Debes iniciar sesión para acceder a esta página de prueba.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🧪 Página de Prueba de Pagos
          </h1>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ Página Temporal</h2>
            <p className="text-yellow-700">
              Esta página es solo para pruebas del flujo de pago. 
              Usuario actual: <strong>{user.email}</strong>
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <button
              onClick={testPaymentFlow}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {loading ? 'Procesando...' : '🚀 Probar Flujo de Pago'}
            </button>

            <button
              onClick={checkPaymentStatus}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium py-2 px-4 rounded-lg transition-colors ml-4"
            >
              {loading ? 'Cargando...' : '📊 Verificar Estado de Pagos'}
            </button>
          </div>

          {result && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Resultado:</h3>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                {result}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentTest;