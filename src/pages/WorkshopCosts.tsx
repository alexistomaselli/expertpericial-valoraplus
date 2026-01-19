import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, ArrowLeft, Calculator, AlertCircle, DollarSign, Loader2, CheckCircle, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

// Error types for better error handling
enum ErrorType {
  VALIDATION_ERROR = 'validation_error',
  DATABASE_ERROR = 'database_error',
  NETWORK_ERROR = 'network_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  UNKNOWN_ERROR = 'unknown_error'
}

interface AppError {
  type: ErrorType;
  message: string;
  originalError?: Error;
}

// Helper function to create standardized errors
const createError = (type: ErrorType, message: string, originalError?: Error): AppError => ({
  type,
  message,
  originalError
});

// Helper function to handle errors consistently
const handleError = (error: unknown, toast: any, context: string = '') => {
  console.error(`Error in ${context}:`, error);
  
  let appError: AppError;
  
  if (error instanceof Error) {
    if (error.message.includes('network') || error.message.includes('fetch')) {
      appError = createError(ErrorType.NETWORK_ERROR, 'Error de conexión. Verifica tu conexión a internet.', error);
    } else if (error.message.includes('database') || error.message.includes('supabase') || error.message.includes('PGRST')) {
      appError = createError(ErrorType.DATABASE_ERROR, 'Error en la base de datos. Inténtalo de nuevo.', error);
    } else if (error.message.includes('auth') || error.message.includes('session')) {
      appError = createError(ErrorType.AUTHENTICATION_ERROR, 'Sesión expirada. Por favor, inicia sesión nuevamente.', error);
    } else {
      appError = createError(ErrorType.UNKNOWN_ERROR, error.message, error);
    }
  } else {
    appError = createError(ErrorType.UNKNOWN_ERROR, 'Error desconocido. Inténtalo de nuevo.');
  }
  
  toast({
    title: "Error",
    description: appError.message,
    variant: "destructive"
  });
  
  return appError;
};

const WorkshopCosts = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasExistingCalculation, setHasExistingCalculation] = useState(false);
  
  const [costs, setCosts] = useState({
    repuestos_compra: "",
    mo_chapa_horas_reales: "",
    mo_chapa_coste_hora: "",
    mo_pintura_horas_reales: "",
    mo_pintura_coste_hora: "",
    consumibles_pintura: "",
    subcontratas: "",
    otros_costes: "",
    notas: ""
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load existing workshop costs data
  useEffect(() => {
    const loadExistingData = async () => {
      if (!caseId) return;
      
      setIsLoading(true);
      try {
        // Ensure user is authenticated
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          const error = createError(ErrorType.AUTHENTICATION_ERROR, "Sesión expirada. Por favor, inicia sesión nuevamente.");
          toast({
            title: "Sesión expirada",
            description: error.message,
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }
        
        const { data, error } = await supabase
          .from('workshop_costs')
          .select('*')
          .eq('analysis_id', caseId)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
          // Handle specific error cases
          if (error.message?.includes('406') || error.message?.includes('Not Acceptable')) {
            const appError = createError(ErrorType.DATABASE_ERROR, "Problema de autenticación con la base de datos. Intenta recargar la página.", error);
            toast({
              title: "Error de configuración",
              description: appError.message,
              variant: "destructive"
            });
            return;
          }
          
          throw createError(ErrorType.DATABASE_ERROR, `Error cargando datos: ${error.message}`, error);
        }

        if (data) {
          // Mark that we have an existing calculation
          setHasExistingCalculation(true);
          
          setCosts({
            repuestos_compra: data.spare_parts_purchase_cost?.toString() || "",
            mo_chapa_horas_reales: data.bodywork_actual_hours?.toString() || "",
            mo_chapa_coste_hora: data.bodywork_hourly_cost?.toString() || "",
            mo_pintura_horas_reales: data.painting_actual_hours?.toString() || "",
            mo_pintura_coste_hora: data.painting_hourly_cost?.toString() || "",
            consumibles_pintura: data.painting_consumables_cost?.toString() || "",
            subcontratas: data.subcontractor_costs?.toString() || "",
            otros_costes: data.other_costs?.toString() || "",
            notas: data.notes || ""
          });
        } else {
          setHasExistingCalculation(false);
        }
      } catch (error) {
        handleError(error, toast, 'loading workshop costs');
      } finally {
        setIsLoading(false);
      }
    };

    loadExistingData();
  }, [caseId, toast]);

  const handleInputChange = (field: string, value: string) => {
    setCosts(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // Helper function to safely parse numeric values
    const safeParseFloat = (value: string): number => {
      if (!value || value.trim() === '') return 0;
      const parsed = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    };

    // Helper function to validate monetary values
    const validateMonetaryValue = (value: string, fieldName: string, fieldKey: string) => {
      if (!value || value.trim() === '') {
        newErrors[fieldKey] = `${fieldName} es obligatorio`;
        return;
      }

      const cleanValue = value.trim().replace(',', '.');
      const num = parseFloat(cleanValue);
      
      if (isNaN(num)) {
        newErrors[fieldKey] = `${fieldName} debe ser un número válido`;
        return;
      }

      if (num < 0) {
        newErrors[fieldKey] = `${fieldName} no puede ser negativo`;
        return;
      }

      if (num > 999999.99) {
        newErrors[fieldKey] = `${fieldName} excede el límite máximo permitido`;
        return;
      }

      // Check decimal places
      const decimalPart = cleanValue.split('.')[1];
      if (decimalPart && decimalPart.length > 2) {
        newErrors[fieldKey] = `${fieldName} no puede tener más de 2 decimales`;
        return;
      }
    };

    // Helper function to validate hour values
    const validateHourValue = (value: string, fieldName: string, fieldKey: string) => {
      if (!value || value.trim() === '') {
        newErrors[fieldKey] = `${fieldName} es obligatorio`;
        return;
      }

      const cleanValue = value.trim().replace(',', '.');
      const num = parseFloat(cleanValue);
      
      if (isNaN(num)) {
        newErrors[fieldKey] = `${fieldName} debe ser un número válido`;
        return;
      }

      if (num < 0) {
        newErrors[fieldKey] = `${fieldName} no puede ser negativo`;
        return;
      }

      if (num > 9999.99) {
        newErrors[fieldKey] = `${fieldName} excede el límite máximo de horas permitido`;
        return;
      }

      // Check decimal places
      const decimalPart = cleanValue.split('.')[1];
      if (decimalPart && decimalPart.length > 2) {
        newErrors[fieldKey] = `${fieldName} no puede tener más de 2 decimales`;
        return;
      }
    };

    // Validate monetary fields
    validateMonetaryValue(costs.repuestos_compra, 'Repuestos y Materiales', 'repuestos_compra');
    validateMonetaryValue(costs.mo_chapa_coste_hora, 'Coste por hora M.O. Chapa', 'mo_chapa_coste_hora');
    validateMonetaryValue(costs.mo_pintura_coste_hora, 'Coste por hora M.O. Pintura', 'mo_pintura_coste_hora');
    validateMonetaryValue(costs.consumibles_pintura, 'Consumibles Pintura', 'consumibles_pintura');
    validateMonetaryValue(costs.subcontratas, 'Subcontratas', 'subcontratas');
    validateMonetaryValue(costs.otros_costes, 'Otros Costes', 'otros_costes');

    // Validate hour fields
    validateHourValue(costs.mo_chapa_horas_reales, 'Horas reales M.O. Chapa', 'mo_chapa_horas_reales');
    validateHourValue(costs.mo_pintura_horas_reales, 'Horas reales M.O. Pintura', 'mo_pintura_horas_reales');

    // Business logic validations
    const repuestosValue = safeParseFloat(costs.repuestos_compra);
    const chapaHours = safeParseFloat(costs.mo_chapa_horas_reales);
    const chapaCost = safeParseFloat(costs.mo_chapa_coste_hora);
    const pinturaHours = safeParseFloat(costs.mo_pintura_horas_reales);
    const pinturaCost = safeParseFloat(costs.mo_pintura_coste_hora);
    const consumibles = safeParseFloat(costs.consumibles_pintura);

    // Check if at least one cost category has a value
    const totalCosts = repuestosValue + (chapaHours * chapaCost) + (pinturaHours * pinturaCost) + consumibles + 
                      safeParseFloat(costs.subcontratas) + safeParseFloat(costs.otros_costes);

    if (totalCosts <= 0) {
      newErrors.general = 'Debe introducir al menos un coste mayor que 0';
    }

    // Validate reasonable hour rates
    if (chapaCost > 0 && (chapaCost < 10 || chapaCost > 200)) {
      newErrors.mo_chapa_coste_hora = 'El coste por hora de chapa parece fuera del rango normal (10-200€/h)';
    }

    if (pinturaCost > 0 && (pinturaCost < 10 || pinturaCost > 200)) {
      newErrors.mo_pintura_coste_hora = 'El coste por hora de pintura parece fuera del rango normal (10-200€/h)';
    }

    // Validate reasonable hours
    if (chapaHours > 500) {
      newErrors.mo_chapa_horas_reales = 'Las horas de chapa parecen excesivamente altas';
    }

    if (pinturaHours > 500) {
      newErrors.mo_pintura_horas_reales = 'Las horas de pintura parecen excesivamente altas';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCalculate = async () => {
    // Check if calculation already exists
    if (hasExistingCalculation) {
      toast({
        title: "Cálculo ya realizado",
        description: "Ya existe un cálculo de rentabilidad para este análisis. Ve a los resultados para verlo.",
        variant: "destructive"
      });
      return;
    }

    if (!validateForm()) {
      const error = createError(ErrorType.VALIDATION_ERROR, "Por favor, corrige los errores marcados en rojo.");
      toast({
        title: "Errores en el formulario",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    if (!caseId) {
      const error = createError(ErrorType.VALIDATION_ERROR, "No se encontró el ID del análisis.");
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);

    try {
      // Save workshop costs to database using insert instead of upsert
      const { error } = await supabase
        .from('workshop_costs')
        .insert({
          analysis_id: caseId,
          spare_parts_purchase_cost: parseFloat(costs.repuestos_compra) || 0,
          bodywork_actual_hours: parseFloat(costs.mo_chapa_horas_reales) || 0,
          bodywork_hourly_cost: parseFloat(costs.mo_chapa_coste_hora) || 0,
          painting_actual_hours: parseFloat(costs.mo_pintura_horas_reales) || 0,
          painting_hourly_cost: parseFloat(costs.mo_pintura_coste_hora) || 0,
          painting_consumables_cost: parseFloat(costs.consumibles_pintura) || 0,
          subcontractor_costs: parseFloat(costs.subcontratas) || 0,
          other_costs: parseFloat(costs.otros_costes) || 0,
          notes: costs.notas
        });

      if (error) {
        throw createError(ErrorType.DATABASE_ERROR, `Error guardando datos: ${error.message}`, error);
      }

      // Mark that we now have a calculation
      setHasExistingCalculation(true);

      toast({
        title: "Datos guardados",
        description: "Calculando rentabilidad...",
      });

      // Redirect to results page
      setTimeout(() => {
        window.location.href = `/app/resultados/${caseId}`;
      }, 1500);

    } catch (error) {
      handleError(error, toast, 'saving workshop costs');
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    return isNaN(num) ? "0,00 €" : num.toLocaleString('es-ES', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }) + ' €';
  };

  // Calculate total costs for preview
  const calculateTotal = () => {
    const repuestos = parseFloat(costs.repuestos_compra) || 0;
    const mo_chapa = (parseFloat(costs.mo_chapa_horas_reales) || 0) * (parseFloat(costs.mo_chapa_coste_hora) || 0);
    const mo_pintura = (parseFloat(costs.mo_pintura_horas_reales) || 0) * (parseFloat(costs.mo_pintura_coste_hora) || 0);
    const consumibles = parseFloat(costs.consumibles_pintura) || 0;
    const subcontratas = parseFloat(costs.subcontratas) || 0;
    const otros = parseFloat(costs.otros_costes) || 0;
    
    return repuestos + mo_chapa + mo_pintura + consumibles + subcontratas + otros;
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-lg text-muted-foreground">Cargando datos existentes...</span>
          </div>
        </div>
      )}

      {/* Main content - hidden while loading */}
      {!isLoading && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-3xl font-bold text-foreground">
                  Costes Reales del Taller
                </h1>
                {hasExistingCalculation && (
                  <div className="flex items-center space-x-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                    <CheckCircle className="h-4 w-4" />
                    <span>Calculado</span>
                  </div>
                )}
              </div>
              <p className="text-lg text-muted-foreground">
                {hasExistingCalculation 
                  ? "Revisa los costes reales que se utilizaron para el cálculo de rentabilidad"
                  : "Introduce los costes reales que has tenido para este expediente"
                }
              </p>
            </div>
            <Link to="/app/verificacion/demo-case-id">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Atrás
              </Button>
            </Link>
          </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Cost input forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Parts/Materials */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span>Repuestos y Materiales</span>
              </CardTitle>
              <CardDescription>
                Coste real de compra de repuestos y materiales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="repuestos_compra">Coste de compra de repuestos (€) *</Label>
                <Input
                  id="repuestos_compra"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="750.00"
                  value={costs.repuestos_compra}
                  onChange={(e) => handleInputChange('repuestos_compra', e.target.value)}
                  className={errors.repuestos_compra ? "border-destructive" : ""}
                  disabled={hasExistingCalculation}
                />
                {errors.repuestos_compra && (
                  <p className="text-sm text-destructive mt-1">{errors.repuestos_compra}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Labor - Bodywork */}
          <Card>
            <CardHeader>
              <CardTitle>Mano de Obra - Chapa</CardTitle>
              <CardDescription>
                Horas y coste real de mano de obra de chapa/mecánica
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="mo_chapa_horas_reales">Horas reales trabajadas *</Label>
                  <Input
                    id="mo_chapa_horas_reales"
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="32.0"
                    value={costs.mo_chapa_horas_reales}
                    onChange={(e) => handleInputChange('mo_chapa_horas_reales', e.target.value)}
                    className={errors.mo_chapa_horas_reales ? "border-destructive" : ""}
                    disabled={hasExistingCalculation}
                  />
                  {errors.mo_chapa_horas_reales && (
                    <p className="text-sm text-destructive mt-1">{errors.mo_chapa_horas_reales}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="mo_chapa_coste_hora">Coste por hora (€) *</Label>
                  <Input
                    id="mo_chapa_coste_hora"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="22.00"
                    value={costs.mo_chapa_coste_hora}
                    onChange={(e) => handleInputChange('mo_chapa_coste_hora', e.target.value)}
                    className={errors.mo_chapa_coste_hora ? "border-destructive" : ""}
                    disabled={hasExistingCalculation}
                  />
                  {errors.mo_chapa_coste_hora && (
                    <p className="text-sm text-destructive mt-1">{errors.mo_chapa_coste_hora}</p>
                  )}
                </div>
              </div>
              <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded">
                <strong>Coste total M.O. Chapa:</strong> {formatCurrency(
                  ((parseFloat(costs.mo_chapa_horas_reales) || 0) * (parseFloat(costs.mo_chapa_coste_hora) || 0)).toString()
                )}
              </div>
            </CardContent>
          </Card>

          {/* Labor - Paint */}
          <Card>
            <CardHeader>
              <CardTitle>Mano de Obra - Pintura</CardTitle>
              <CardDescription>
                Horas y coste real de mano de obra de pintura
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="mo_pintura_horas_reales">Horas reales trabajadas *</Label>
                  <Input
                    id="mo_pintura_horas_reales"
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="14.0"
                    value={costs.mo_pintura_horas_reales}
                    onChange={(e) => handleInputChange('mo_pintura_horas_reales', e.target.value)}
                    className={errors.mo_pintura_horas_reales ? "border-destructive" : ""}
                    disabled={hasExistingCalculation}
                  />
                  {errors.mo_pintura_horas_reales && (
                    <p className="text-sm text-destructive mt-1">{errors.mo_pintura_horas_reales}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="mo_pintura_coste_hora">Coste por hora (€) *</Label>
                  <Input
                    id="mo_pintura_coste_hora"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="20.00"
                    value={costs.mo_pintura_coste_hora}
                    onChange={(e) => handleInputChange('mo_pintura_coste_hora', e.target.value)}
                    className={errors.mo_pintura_coste_hora ? "border-destructive" : ""}
                    disabled={hasExistingCalculation}
                  />
                  {errors.mo_pintura_coste_hora && (
                    <p className="text-sm text-destructive mt-1">{errors.mo_pintura_coste_hora}</p>
                  )}
                </div>
              </div>
              <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded">
                <strong>Coste total M.O. Pintura:</strong> {formatCurrency(
                  ((parseFloat(costs.mo_pintura_horas_reales) || 0) * (parseFloat(costs.mo_pintura_coste_hora) || 0)).toString()
                )}
              </div>
            </CardContent>
          </Card>

          {/* Paint materials and other costs */}
          <Card>
            <CardHeader>
              <CardTitle>Otros Costes</CardTitle>
              <CardDescription>
                Materiales de pintura y costes adicionales
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="consumibles_pintura">Consumibles de pintura (€) *</Label>
                <Input
                  id="consumibles_pintura"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="400.00"
                  value={costs.consumibles_pintura}
                  onChange={(e) => handleInputChange('consumibles_pintura', e.target.value)}
                  className={errors.consumibles_pintura ? "border-destructive" : ""}
                  disabled={hasExistingCalculation}
                />
                {errors.consumibles_pintura && (
                  <p className="text-sm text-destructive mt-1">{errors.consumibles_pintura}</p>
                )}
              </div>

              <div>
                <Label htmlFor="subcontratas">Subcontratas (€)</Label>
                <Input
                  id="subcontratas"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="120.00"
                  value={costs.subcontratas}
                  onChange={(e) => handleInputChange('subcontratas', e.target.value)}
                  disabled={hasExistingCalculation}
                />
              </div>

              <div>
                <Label htmlFor="otros_costes">Otros costes (€)</Label>
                <Input
                  id="otros_costes"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="80.00"
                  value={costs.otros_costes}
                  onChange={(e) => handleInputChange('otros_costes', e.target.value)}
                  disabled={hasExistingCalculation}
                />
              </div>

              <div>
                <Label htmlFor="notas">Notas adicionales (opcional)</Label>
                <Textarea
                  id="notas"
                  placeholder="Cualquier observación adicional sobre los costes..."
                  value={costs.notas}
                  onChange={(e) => handleInputChange('notas', e.target.value)}
                  rows={3}
                  disabled={hasExistingCalculation}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary sidebar */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calculator className="h-5 w-5 text-primary" />
                <span>Resumen de Costes</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Repuestos:</span>
                  <span className="font-medium">{formatCurrency(costs.repuestos_compra)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">M.O. Chapa:</span>
                  <span className="font-medium">
                    {formatCurrency(((parseFloat(costs.mo_chapa_horas_reales) || 0) * (parseFloat(costs.mo_chapa_coste_hora) || 0)).toString())}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">M.O. Pintura:</span>
                  <span className="font-medium">
                    {formatCurrency(((parseFloat(costs.mo_pintura_horas_reales) || 0) * (parseFloat(costs.mo_pintura_coste_hora) || 0)).toString())}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Consumibles:</span>
                  <span className="font-medium">{formatCurrency(costs.consumibles_pintura)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subcontratas:</span>
                  <span className="font-medium">{formatCurrency(costs.subcontratas)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Otros:</span>
                  <span className="font-medium">{formatCurrency(costs.otros_costes)}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between font-semibold text-base">
                    <span>Total Costes:</span>
                    <span className="text-primary">{formatCurrency(calculateTotal().toString())}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                {hasExistingCalculation ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center space-x-2 text-green-600 bg-green-50 p-3 rounded-lg">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Rentabilidad ya calculada</span>
                    </div>
                    <Link to={`/app/resultados/${caseId}`}>
                      <Button 
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Ver Resultados
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <Button 
                    onClick={handleCalculate}
                    className="w-full bg-gradient-primary text-primary-foreground shadow-glow"
                    disabled={calculateTotal() === 0 || isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando datos...
                      </>
                    ) : (
                      <>
                        Calcular Rentabilidad
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Help card */}
          <Card className="bg-accent border-accent-foreground/20">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground mb-1">Consejos</p>
                  <ul className="text-muted-foreground space-y-1">
                    <li>• Incluye todos los costes directos</li>
                    <li>• No incluyas costes fijos del taller</li>
                    <li>• Usa horas reales trabajadas, no teóricas</li>
                    <li>• Los campos con * son obligatorios</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      </>
      )}
    </div>
  );
};

export default WorkshopCosts;