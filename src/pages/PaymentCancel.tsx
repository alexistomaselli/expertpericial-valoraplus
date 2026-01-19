import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function PaymentCancel() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessionId] = useState(searchParams.get('session_id'));

  useEffect(() => {
    const updateCancelledPayment = async () => {
      if (!sessionId || !user) {
        setLoading(false);
        return;
      }

      try {
        // Update payment status to cancelled if it exists
        const { error } = await supabase
          .from('payments')
          .update({ 
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_session_id', sessionId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error updating payment status:', error);
        }
      } catch (error) {
        console.error('Error in updateCancelledPayment:', error);
      } finally {
        setLoading(false);
      }
    };

    updateCancelledPayment();
  }, [sessionId, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-orange-600" />
          </div>
          <CardTitle className="text-xl font-semibold text-gray-900">
            Pago Cancelado
          </CardTitle>
          <CardDescription className="text-gray-600">
            Tu proceso de pago ha sido cancelado
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600">
              No se ha realizado ningún cargo a tu tarjeta. Puedes intentar el pago nuevamente cuando estés listo.
            </p>
          </div>

          <div className="space-y-3">
            <Button asChild className="w-full">
              <Link to="/app/nuevo" className="flex items-center justify-center gap-2">
                <CreditCard className="w-4 h-4" />
                Intentar Pago Nuevamente
              </Link>
            </Button>
            
            <Button variant="outline" asChild className="w-full">
              <Link to="/app" className="flex items-center justify-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Volver al Inicio
              </Link>
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              Si tienes problemas con el pago, contacta con nuestro soporte técnico.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}