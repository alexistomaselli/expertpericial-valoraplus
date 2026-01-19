import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Settings,
    Save,
    Loader2,
    AlertCircle
} from "lucide-react";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { useToast } from "@/hooks/use-toast";

const AdminSettings = () => {
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

    if (settingsLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Configuración del Sistema</h1>
                <p className="text-gray-600">Gestiona los parámetros globales de la plataforma</p>
            </div>

            <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div>
                        <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            Parámetros de la Plataforma
                        </CardTitle>
                        <CardDescription>
                            Configura los límites y precios de los análisis
                        </CardDescription>
                    </div>
                    <Button
                        onClick={saveSettings}
                        disabled={savingSettings}
                        className="flex items-center gap-2"
                    >
                        {savingSettings ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        {savingSettings ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Configuraciones de Análisis */}
                        <div className="space-y-6">
                            <h3 className="font-medium text-gray-900 border-b pb-2">Análisis y Facturación</h3>

                            <div className="space-y-2">
                                <Label htmlFor="monthlyLimit">Análisis gratuitos por mes</Label>
                                <Input
                                    id="monthlyLimit"
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={localSettings.monthlyFreeAnalysesLimit}
                                    onChange={(e) => handleSettingChange('monthlyFreeAnalysesLimit', parseInt(e.target.value) || 0)}
                                />
                                <p className="text-xs text-gray-500">
                                    Número de análisis gratuitos que cada taller puede realizar por mes
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
                                />
                                <p className="text-xs text-gray-500">
                                    Precio base para análisis que superen el límite gratuito
                                </p>
                            </div>
                        </div>

                        {/* Configuraciones de Sistema */}
                        <div className="space-y-6">
                            <h3 className="font-medium text-gray-900 border-b pb-2">Sistema de Pagos y Pasarela</h3>

                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                                <div className="space-y-0.5">
                                    <Label htmlFor="billingEnabled" className="text-base">Facturación habilitada</Label>
                                    <p className="text-xs text-gray-500">
                                        Activar el control de consumos y generación de facturas
                                    </p>
                                </div>
                                <Switch
                                    id="billingEnabled"
                                    checked={localSettings.billingEnabled}
                                    onCheckedChange={(checked) => handleSettingChange('billingEnabled', checked)}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                                <div className="space-y-0.5">
                                    <Label htmlFor="stripeEnabled" className="text-base">Pasarela Stripe</Label>
                                    <p className="text-xs text-gray-500">
                                        Permitir pagos online mediante tarjeta de crédito
                                    </p>
                                </div>
                                <Switch
                                    id="stripeEnabled"
                                    checked={localSettings.stripeEnabled}
                                    onCheckedChange={(checked) => handleSettingChange('stripeEnabled', checked)}
                                />
                            </div>

                            {localSettings.stripeEnabled && (
                                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
                                    <AlertCircle className="h-5 w-5 text-blue-600 shrink-0" />
                                    <div className="space-y-1">
                                        <span className="text-sm font-semibold text-blue-800">Verificación de Integración</span>
                                        <p className="text-xs text-blue-700">
                                            La pasarela Stripe requiere claves secretas configuradas en el servidor. Asegúrate de que las variables VITE_STRIPE_PUBLISHABLE_KEY estén presentes.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default AdminSettings;
