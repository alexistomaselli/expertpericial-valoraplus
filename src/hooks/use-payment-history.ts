import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface Payment {
  id: string;
  user_id: string;
  workshop_id: string;
  stripe_payment_intent_id: string;
  stripe_session_id: string | null;
  stripe_customer_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  analysis_month: string;
  analyses_purchased: number;
  unit_price_cents: number;
  payment_method: string | null;
  stripe_fee_cents: number | null;
  net_amount_cents: number | null;
  description: string | null;
  created_at: string;
  paid_at?: string | null;
  updated_at: string;
}

export const usePaymentHistory = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchPaymentHistory = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (queryError) {
        throw new Error(queryError.message || 'Error fetching payment history');
      }

      setPayments(data || []);
    } catch (err) {
      console.error('Error fetching payment history:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentHistory();
  }, [user?.id]);

  const refreshPaymentHistory = () => {
    fetchPaymentHistory();
  };

  return {
    payments,
    loading,
    error,
    refreshPaymentHistory
  };
};