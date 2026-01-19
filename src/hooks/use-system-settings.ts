import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SystemSettings {
  monthlyFreeAnalysesLimit: number;
  additionalAnalysisPrice: number;
  billingEnabled: boolean;
  stripeEnabled: boolean;
  companyInfo: {
    name: string;
    tax_id: string;
    address: string;
    email: string;
  };
}

export const useSystemSettings = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener configuraciones usando las funciones RPC
      const settingKeys = [
        'monthly_free_analyses_limit',
        'additional_analysis_price',
        'billing_enabled',
        'stripe_enabled',
        'company_info'
      ];

      const settingsPromises = settingKeys.map(async (key) => {
        const { data, error } = await supabase.rpc('get_system_setting', {
          setting_name: key
        });
        if (error) throw error;
        return { key, value: data };
      });

      const settingsResults = await Promise.all(settingsPromises);
      
      // Convertir a formato más amigable
      const settingsMap = settingsResults.reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {} as Record<string, any>);

      const formattedSettings: SystemSettings = {
        monthlyFreeAnalysesLimit: settingsMap.monthly_free_analyses_limit?.value || 3,
        additionalAnalysisPrice: settingsMap.additional_analysis_price?.value || 25.00,
        billingEnabled: settingsMap.billing_enabled?.value || false,
        stripeEnabled: settingsMap.stripe_enabled?.value || false,
        companyInfo: settingsMap.company_info || {
          name: 'Valora Plus',
          tax_id: '',
          address: '',
          email: ''
        }
      };

      setSettings(formattedSettings);
    } catch (err) {
      console.error('Error fetching system settings:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (settingKey: string, value: any) => {
    try {
      // Llamar a la función de base de datos para actualizar configuración
      const { error } = await supabase.rpc('update_system_setting', {
        setting_name: settingKey,
        new_value: { value }
      });

      if (error) throw error;

      toast({
        title: "Configuración actualizada",
        description: "La configuración se ha actualizado correctamente.",
      });

      // Refrescar configuraciones
      await fetchSettings();
      return true;
    } catch (err) {
      console.error('Error updating setting:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Error al actualizar la configuración",
        variant: "destructive",
      });
      return false;
    }
  };

  const updateMonthlyLimit = (limit: number) => 
    updateSetting('monthly_free_analyses_limit', limit);

  const updateAnalysisPrice = (price: number) => 
    updateSetting('additional_analysis_price', price);

  const updateBillingEnabled = (enabled: boolean) => 
    updateSetting('billing_enabled', enabled);

  const updateStripeEnabled = (enabled: boolean) => 
    updateSetting('stripe_enabled', enabled);

  const updateCompanyInfo = (companyInfo: SystemSettings['companyInfo']) => 
    updateSetting('company_info', companyInfo);

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    loading,
    error,
    refetch: fetchSettings,
    updateMonthlyLimit,
    updateAnalysisPrice,
    updateBillingEnabled,
    updateStripeEnabled,
    updateCompanyInfo
  };
};