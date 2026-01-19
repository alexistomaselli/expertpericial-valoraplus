import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Users, 
  Building2, 
  FileText, 
  TrendingUp, 
  Activity,
  AlertCircle,
  Clock,
  Settings,
  Save,
  Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { useToast } from "@/hooks/use-toast";
import { DebugOpenAI } from "@/components/DebugOpenAI";

// Función para formatear fechas sin problemas de zona horaria
const formatDateWithoutTimezone = (dateString: string): string => {
  if (!dateString) return 'Sin fecha';
  
  // Parsear la fecha directamente sin crear un objeto Date que pueda cambiar la zona horaria
  const [year, month, day] = dateString.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  
  return date.toLocaleDateString('es-ES');
};

interface DashboardStats {
  totalWorkshops: number;
  totalAnalysis: number;
  recentAnalysis: number;
}

interface Profile {
  id: string;
  full_name: string;
}

interface AnalysisData {
  id: string;
  created_at: string;
  user_id: string;
}

interface RecentAnalysis {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  pdf_filename: string;
  workshop_name: string;
  analysis_date: string;
  valuation_date: string;
  total_amount: number | null;
  net_amount: number | null;
}

interface SupabaseCountResponse {
  count: number | null;
  error: unknown;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalWorkshops: 0,
    totalAnalysis: 0,
    recentAnalysis: 0
  });
  const [recentAnalysisList, setRecentAnalysisList] = useState<RecentAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Sistema de configuraciones
  const { 
    settings, 
    loading: settingsLoading, 
    updateMonthlyLimit,
    updateAnalysisPrice,
    updateBillingEnabled,
    updateStripeEnabled
  } = useSystemSettings();
  const { toast } = useToast();
  const [savingSettings, setSavingSettings] = useState(false);
  const [localSettings, setLocalSettings] = useState({
    monthlyFreeAnalysesLimit: 3,
    additionalAnalysisPrice: 25.00,
    billingEnabled: true,
    stripeEnabled: false
  });

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  // Sincronizar configuraciones locales con las del servidor
  useEffect(() => {
    if (settings) {
      setLocalSettings({
        monthlyFreeAnalysesLimit: settings.monthlyFreeAnalysesLimit || 3,
        additionalAnalysisPrice: settings.additionalAnalysisPrice || 25.00,
        billingEnabled: settings.billingEnabled || false,
        stripeEnabled: settings.stripeEnabled || false
      });
    }
  }, [settings]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);

      // Verificar autenticación primero
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('🔐 Error de autenticación:', authError);
        setLoading(false);
        return;
      }
      
      if (!user) {
        console.error('🔐 Usuario no autenticado');
        setLoading(false);
        return;
      }

      //console.log('🔐 Usuario autenticado:', user.email);

      // Crear timeout promise
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 15 seconds')), 15000)
      );



      // Obtener total de talleres con timeout
      //console.log('📊 Obteniendo total de talleres...');
      let workshopsCount = 0, workshopsError = null;
      try {
        const result = await Promise.race([
          supabase.from('workshops').select('id', { count: 'exact' }).range(0, 0),
          timeoutPromise
        ]);
        workshopsCount = (result as SupabaseCountResponse).count || 0;
        workshopsError = (result as SupabaseCountResponse).error;
      } catch (error) {
        console.error('❌ Timeout o error obteniendo talleres:', error);
        workshopsError = error;
      }

      if (workshopsError) {
        console.error('❌ Error obteniendo talleres:', workshopsError);
      } else {
        //console.log('✅ Talleres obtenidos:', workshopsCount);
      }

      // Obtener total de análisis con timeout
      //console.log('📊 Obteniendo total de análisis...');
      let analysisCount = 0, analysisError = null;
      try {
        const result = await Promise.race([
          supabase.from('analysis').select('id', { count: 'exact' }).range(0, 0),
          timeoutPromise
        ]);
        analysisCount = (result as SupabaseCountResponse).count || 0;
        analysisError = (result as SupabaseCountResponse).error;
      } catch (error) {
        console.error('❌ Timeout o error obteniendo análisis:', error);
        analysisError = error;
      }

      if (analysisError) {
        console.error('❌ Error obteniendo análisis:', analysisError);
      } else {
        console.log('✅ Análisis obtenidos:', analysisCount);
      }

      // Obtener análisis recientes (últimos 7 días) - Filtrar por analysis_date
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoString = sevenDaysAgo.toISOString().split('T')[0]; // Solo la fecha YYYY-MM-DD
      
      console.log('📊 Obteniendo análisis recientes...');
      console.log('📅 Filtro de fecha (últimos 7 días):', sevenDaysAgoString);
      let recentAnalysisCount = 0, recentAnalysisData: RecentAnalysis[] = [], recentError = null;
      
      try {
        // Primero obtener el conteo simple filtrando por analysis_date
        const countResult = await Promise.race([
          supabase
            .from('analysis')
            .select('id', { count: 'exact' })
            .gte('analysis_date', sevenDaysAgoString)
            .not('analysis_date', 'is', null),
          timeoutPromise
        ]);
        
        recentAnalysisCount = (countResult as any).count || 0;
        console.log('✅ Conteo de análisis recientes (por analysis_date):', recentAnalysisCount);
        
        // Si hay análisis, obtener los datos con información del taller y montos
        if (recentAnalysisCount > 0) {
          const dataResult = await Promise.race([
            supabase
              .from('analysis')
              .select(`
                id,
                created_at,
                updated_at,
                status,
                pdf_filename,
                analysis_date,
                valuation_date,
                workshop_id,
                workshops(name),
                insurance_amounts(total_with_iva, net_subtotal)
              `)
              .gte('analysis_date', sevenDaysAgoString)
              .not('analysis_date', 'is', null)
              .order('analysis_date', { ascending: false })
              .limit(10),
            timeoutPromise
          ]);
          
          const rawData = (dataResult as any).data || [];
          recentError = (dataResult as any).error;
          
          // Transformar los datos con información relevante
          recentAnalysisData = rawData.map((item: any) => ({
            id: item.id,
            created_at: item.created_at,
            updated_at: item.updated_at,
            status: item.status || 'processing',
            pdf_filename: item.pdf_filename || 'Análisis.pdf',
            workshop_name: item.workshops?.name || 'Taller no asignado',
            analysis_date: item.analysis_date,
            valuation_date: item.valuation_date,
            total_amount: item.insurance_amounts?.[0]?.total_with_iva || null,
            net_amount: item.insurance_amounts?.[0]?.net_subtotal || null
          }));
        }
        
      } catch (error) {
        console.error('❌ Timeout o error obteniendo análisis recientes:', error);
        recentError = error;
      }

      if (recentError) {
        console.error('❌ Error obteniendo análisis recientes:', recentError);
      } else {
        console.log('✅ Análisis recientes obtenidos:', recentAnalysisCount);
        console.log('📋 Datos de análisis recientes:', recentAnalysisData);
        setRecentAnalysisList(recentAnalysisData);
      }





      setStats({
        totalWorkshops: workshopsCount || 0,
        totalAnalysis: analysisCount || 0,
        recentAnalysis: recentAnalysisCount || 0
      });

      console.log('📊 Estadísticas finales:', {
        totalWorkshops: workshopsCount || 0,
        totalAnalysis: analysisCount || 0,
        recentAnalysis: recentAnalysisCount || 0
      });

    } catch (error) {
      console.error('💥 Error general fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Funciones para manejar configuraciones
  const handleSettingChange = (key: keyof typeof localSettings, value: any) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const promises = [];
      
      if (localSettings.monthlyFreeAnalysesLimit !== settings?.monthlyFreeAnalysesLimit) {
        promises.push(updateMonthlyLimit(localSettings.monthlyFreeAnalysesLimit));
      }
      
      if (localSettings.additionalAnalysisPrice !== settings?.additionalAnalysisPrice) {
        promises.push(updateAnalysisPrice(localSettings.additionalAnalysisPrice));
      }
      
      if (localSettings.billingEnabled !== settings?.billingEnabled) {
        promises.push(updateBillingEnabled(localSettings.billingEnabled));
      }
      
      if (localSettings.stripeEnabled !== settings?.stripeEnabled) {
        promises.push(updateStripeEnabled(localSettings.stripeEnabled));
      }

      const results = await Promise.all(promises);
      
      if (results.every(result => result)) {
        toast({
          title: "Configuraciones guardadas",
          description: "Las configuraciones del sistema se han actualizado correctamente.",
        });
      } else {
        throw new Error("Algunos cambios no se pudieron guardar");
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error al guardar",
        description: "No se pudieron guardar las configuraciones. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const statCards = [
    {
      title: "Talleres Activos",
      value: stats.totalWorkshops,
      description: "Talleres registrados en el sistema",
      icon: Building2,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "Análisis Totales",
      value: stats.totalAnalysis,
      description: "Análisis de rentabilidad realizados",
      icon: FileText,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      title: "Análisis Recientes",
      value: stats.recentAnalysis,
      description: recentAnalysisList.length > 0 
        ? `${recentAnalysisList.length} análisis detallados abajo`
        : "Últimos 7 días",
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Resumen general de la plataforma Valora Plus</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Resumen general de la plataforma Valora Plus</p>
      </div>



      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Configuración del Sistema */}
      <Card className="hover:shadow-lg transition-shadow" data-config-section>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuración del Sistema
            </CardTitle>
            <CardDescription>
              Gestiona las configuraciones globales de la plataforma
            </CardDescription>
          </div>
          <Button 
            onClick={saveSettings} 
            disabled={savingSettings || settingsLoading}
            className="flex items-center gap-2"
          >
            {savingSettings ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {savingSettings ? 'Guardando...' : 'Guardar'}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Configuraciones de Análisis */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Análisis y Facturación</h3>
              
              <div className="space-y-2">
                <Label htmlFor="monthlyLimit">Análisis gratuitos por mes</Label>
                <Input
                  id="monthlyLimit"
                  type="number"
                  min="0"
                  max="100"
                  value={localSettings.monthlyFreeAnalysesLimit}
                  onChange={(e) => handleSettingChange('monthlyFreeAnalysesLimit', parseInt(e.target.value) || 0)}
                  disabled={settingsLoading}
                />
                <p className="text-xs text-gray-500">
                  Número de análisis gratuitos que cada usuario puede realizar por mes
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="analysisPrice">Precio por análisis adicional (€)</Label>
                <Input
                  id="analysisPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={localSettings.additionalAnalysisPrice}
                  onChange={(e) => handleSettingChange('additionalAnalysisPrice', parseFloat(e.target.value) || 0)}
                  disabled={settingsLoading}
                />
                <p className="text-xs text-gray-500">
                  Precio que se cobrará por cada análisis que exceda el límite gratuito
                </p>
              </div>
            </div>

            {/* Configuraciones de Sistema */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Sistema de Pagos</h3>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="billingEnabled">Facturación habilitada</Label>
                  <p className="text-xs text-gray-500">
                    Activar el sistema de facturación y cobros
                  </p>
                </div>
                <Switch
                  id="billingEnabled"
                  checked={localSettings.billingEnabled}
                  onCheckedChange={(checked) => handleSettingChange('billingEnabled', checked)}
                  disabled={settingsLoading}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="stripeEnabled">Stripe habilitado</Label>
                  <p className="text-xs text-gray-500">
                    Activar la integración con Stripe para pagos
                  </p>
                </div>
                <Switch
                  id="stripeEnabled"
                  checked={localSettings.stripeEnabled}
                  onCheckedChange={(checked) => handleSettingChange('stripeEnabled', checked)}
                  disabled={settingsLoading}
                />
              </div>

              {localSettings.stripeEnabled && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-800">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Configuración de Stripe</span>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">
                    Asegúrate de configurar las claves de API de Stripe en las variables de entorno
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Análisis Recientes y Acciones Rápidas - En dos columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Análisis Recientes */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">
                Análisis Recientes
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                {stats.recentAnalysis} análisis en los últimos 7 días
              </p>
            </div>
            <div className="p-2 rounded-lg bg-orange-50">
              <TrendingUp className="h-5 w-5 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            {recentAnalysisList.length > 0 ? (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {recentAnalysisList.map((analysis) => (
                  <div key={analysis.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-purple-600" />
                            <span className="font-medium text-gray-900 text-sm">
                              {analysis.pdf_filename}
                            </span>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            analysis.status === 'completed' 
                              ? 'bg-green-100 text-green-800' 
                              : analysis.status === 'processing'
                              ? 'bg-blue-100 text-blue-800'
                              : analysis.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {analysis.status === 'completed' ? 'Completado' : 
                             analysis.status === 'processing' ? 'Procesando' :
                             analysis.status === 'failed' ? 'Error' : 'Pendiente'}
                          </span>
                        </div>
                        
                        <div className="space-y-1 text-sm mb-2">
                          <div>
                            <span className="text-gray-500">Taller:</span>
                            <span className="font-medium text-gray-900 ml-1">{analysis.workshop_name}</span>
                          </div>
                          {analysis.total_amount && (
                            <div>
                              <span className="text-gray-500">Total:</span>
                              <span className="font-medium text-gray-900 ml-1">€{analysis.total_amount.toLocaleString('es-ES', {minimumFractionDigits: 2})}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{analysis.analysis_date ? formatDateWithoutTimezone(analysis.analysis_date) : 'Sin fecha'}</span>
                          </div>
                          {analysis.valuation_date && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>Val: {formatDateWithoutTimezone(analysis.valuation_date)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No hay análisis recientes en los últimos 7 días</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Acciones Rápidas */}
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
            <CardDescription>
              Herramientas de administración más utilizadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <button className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <div className="flex items-center gap-3">
                  <Users className="h-6 w-6 text-blue-600" />
                  <div>
                    <h3 className="font-medium text-gray-900">Gestionar Usuarios</h3>
                    <p className="text-sm text-gray-500">Ver y administrar cuentas de usuario</p>
                  </div>
                </div>
              </button>
              <button className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <div className="flex items-center gap-3">
                  <Building2 className="h-6 w-6 text-green-600" />
                  <div>
                    <h3 className="font-medium text-gray-900">Gestionar Talleres</h3>
                    <p className="text-sm text-gray-500">Administrar talleres registrados</p>
                  </div>
                </div>
              </button>
              <button className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-purple-600" />
                  <div>
                    <h3 className="font-medium text-gray-900">Ver Análisis</h3>
                    <p className="text-sm text-gray-500">Revisar análisis de rentabilidad</p>
                  </div>
                </div>
              </button>
              <button className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <div className="flex items-center gap-3">
                  <Activity className="h-6 w-6 text-indigo-600" />
                  <div>
                    <h3 className="font-medium text-gray-900">Reportes</h3>
                    <p className="text-sm text-gray-500">Generar informes y estadísticas</p>
                  </div>
                </div>
              </button>
              <button 
                onClick={() => {
                  // Scroll to configuration section
                  const configSection = document.querySelector('[data-config-section]');
                  if (configSection) {
                    configSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Settings className="h-6 w-6 text-gray-600" />
                  <div>
                    <h3 className="font-medium text-gray-900">Configuración</h3>
                    <p className="text-sm text-gray-500">Gestionar configuraciones del sistema</p>
                  </div>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Debug OpenAI Component */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>🔧 Debug del Servicio de IA</CardTitle>
            <CardDescription>
              Herramientas de diagnóstico para verificar la configuración del servicio de extracción de PDF con IA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DebugOpenAI />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;