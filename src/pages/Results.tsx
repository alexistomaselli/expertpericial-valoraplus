import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ArrowLeft, TrendingUp, TrendingDown, Minus, FileText, Share2, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Error types for better error handling
enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PDF_GENERATION_ERROR = 'PDF_GENERATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

interface AppError {
  type: ErrorType;
  message: string;
  originalError?: any;
}

// Helper function to create standardized errors
const createError = (type: ErrorType, message: string, originalError?: any): AppError => ({
  type,
  message,
  originalError
});

// Helper function to handle errors consistently
const handleError = (error: any, toast: any): void => {
  console.error('Error details:', error);
  
  let errorMessage = 'Ha ocurrido un error inesperado';
  
  if (error?.type) {
    // It's our custom AppError
    errorMessage = error.message;
  } else if (error?.message?.includes('fetch')) {
    errorMessage = 'Error de conexión. Verifica tu conexión a internet.';
  } else if (error?.code?.startsWith('PGRST')) {
    errorMessage = 'Error en la base de datos. Inténtalo de nuevo.';
  } else if (error?.message) {
    errorMessage = error.message;
  }
  
  toast({
    title: "Error",
    description: errorMessage,
    variant: "destructive",
  });
};

interface MargenDetallado {
  ingresos: number;
  costes: number;
  margen: number;
  // Información específica para repuestos
  cantidad_materiales?: number;
  beneficio_medio_por_material?: number;
}

interface ResultsData {
  case_id: string;
  metadata: {
    matricula: string;
    referencia: string;
    fecha: string;
    taller: string;
  };
  ingresos_totales: number;
  costes_totales: number;
  margen_eur: number;
  margen_pct: number;
  margen_detallado: {
    repuestos: MargenDetallado;
    mo_chapa: MargenDetallado;
    mo_pintura: MargenDetallado;
    mat_pintura: MargenDetallado;
    subcontratistas: MargenDetallado;
    otros_costos: MargenDetallado;
  };
}

const Results = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const [isDownloading, setIsDownloading] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultsData | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadAnalysisData = async () => {
      if (!caseId) {
        setError("No se encontró el ID del análisis");
        setIsLoading(false);
        return;
      }

      try {
        // Load analysis data
        const { data: analysis, error: analysisError } = await supabase
          .from('analysis')
          .select('*')
          .eq('id', caseId)
          .single();

        if (analysisError) throw analysisError;

        // Store the PDF URL if available
        if (analysis?.pdf_url) {
          setPdfUrl(analysis.pdf_url);
        }

        // Load vehicle data
        const { data: vehicleData, error: vehicleError } = await supabase
          .from('vehicle_data')
          .select('*')
          .eq('analysis_id', caseId)
          .single();

        if (vehicleError) throw vehicleError;

        // Load insurance amounts
        const { data: insuranceAmounts, error: insuranceError } = await supabase
          .from('insurance_amounts')
          .select('*')
          .eq('analysis_id', caseId)
          .single();

        if (insuranceError) throw insuranceError;

        // Load workshop costs
        const { data: workshopCosts, error: workshopError } = await supabase
          .from('workshop_costs')
          .select('*')
          .eq('analysis_id', caseId)
          .single();

        if (workshopError) throw workshopError;

        // Calculate results
        try {
          const calculatedResults = calculateProfitability(
            analysis,
            vehicleData,
            insuranceAmounts,
            workshopCosts
          );
          setResults(calculatedResults);
        } catch (calculationError: any) {
          // Handle validation errors from calculateProfitability
          if (calculationError.type === ErrorType.VALIDATION_ERROR) {
            handleError(calculationError, toast);
            setError(calculationError.message);
            return;
          }
          // Re-throw other errors to be handled by outer catch
          throw calculationError;
        }
      } catch (error) {
        const appError = createError(
          ErrorType.DATABASE_ERROR,
          'Error al cargar los datos del análisis. Verifica que el análisis existe y está completo.',
          error
        );
        handleError(appError, toast);
        setError(appError.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalysisData();
  }, [caseId]);



  const calculateProfitability = (analysis: any, vehicleData: any, insuranceAmounts: any, workshopCosts: any): ResultsData => {
    // Validate required data
    if (!analysis || !vehicleData || !insuranceAmounts || !workshopCosts) {
      throw createError(
        ErrorType.VALIDATION_ERROR,
        'Faltan datos necesarios para calcular la rentabilidad'
      );
    }

    // Helper function to safely parse numeric values
    const safeParseFloat = (value: any): number => {
      if (value === null || value === undefined || value === '') return 0;
      const parsed = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : parseFloat(value);
      return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100; // Round to 2 decimals
    };

    // Calculate total income (from insurance) with validation
    // IMPORTANTE: Usar net_subtotal (base imponible) para cálculos de rentabilidad
    // Los cálculos de rentabilidad deben basarse en el subtotal SIN IVA
    const ingresos_totales = safeParseFloat(insuranceAmounts.net_subtotal);
    
    if (ingresos_totales <= 0) {
      throw createError(
        ErrorType.VALIDATION_ERROR,
        'El importe total de la aseguradora debe ser mayor que 0'
      );
    }

    // Calculate total costs (from workshop) with improved precision
    const costes_repuestos = safeParseFloat(workshopCosts.spare_parts_purchase_cost);
    const horas_chapa = safeParseFloat(workshopCosts.bodywork_actual_hours);
    const precio_hora_chapa = safeParseFloat(workshopCosts.bodywork_hourly_cost);
    const costes_mo_chapa = Math.round((horas_chapa * precio_hora_chapa) * 100) / 100;
    
    const horas_pintura = safeParseFloat(workshopCosts.painting_actual_hours);
    const precio_hora_pintura = safeParseFloat(workshopCosts.painting_hourly_cost);
    const costes_mo_pintura = Math.round((horas_pintura * precio_hora_pintura) * 100) / 100;
    
    const costes_mat_pintura = safeParseFloat(workshopCosts.painting_consumables_cost);
    const costes_subcontratas = safeParseFloat(workshopCosts.subcontractor_costs);
    const costes_otros = safeParseFloat(workshopCosts.other_costs);

    // Calculate total costs with precision
    const costes_totales = Math.round((
      costes_repuestos + 
      costes_mo_chapa + 
      costes_mo_pintura + 
      costes_mat_pintura + 
      costes_subcontratas + 
      costes_otros
    ) * 100) / 100;

    // Validate total costs
    if (costes_totales < 0) {
      throw createError(
        ErrorType.VALIDATION_ERROR,
        'Los costos totales no pueden ser negativos'
      );
    }

    if (costes_totales === 0) {
      console.warn('Warning: Total costs are zero. This may indicate missing cost data.');
    }

    // Calculate margins with improved precision
    const margen_eur = Math.round((ingresos_totales - costes_totales) * 100) / 100;
    const margen_pct = ingresos_totales > 0 ? 
      Math.round((margen_eur / ingresos_totales) * 10000) / 100 : 0; // Round to 2 decimals

    // Calculate detailed margins with validation
    const ingresos_repuestos = safeParseFloat(insuranceAmounts.total_spare_parts_eur);
    const ingresos_mo_chapa = safeParseFloat(insuranceAmounts.bodywork_labor_eur);
    const ingresos_mo_pintura = safeParseFloat(insuranceAmounts.painting_labor_eur);
    const ingresos_mat_pintura = safeParseFloat(insuranceAmounts.paint_material_eur);

    // Validation: Check if detailed income adds up to total (with tolerance for rounding)
    const suma_ingresos_detallados = ingresos_repuestos + ingresos_mo_chapa + ingresos_mo_pintura + ingresos_mat_pintura;
    const diferencia_ingresos = Math.abs(suma_ingresos_detallados - ingresos_totales);
    
    if (diferencia_ingresos > 1) { // Tolerance of 1 euro for rounding differences
      console.warn('Warning: Detailed income does not match total income:', {
        detailed: suma_ingresos_detallados,
        total: ingresos_totales,
        difference: diferencia_ingresos
      });
    }

    // Helper function to calculate detailed margin
    const calculateDetailedMargin = (ingresos: number, costes: number) => ({
      ingresos: Math.round(ingresos * 100) / 100,
      costes: Math.round(costes * 100) / 100,
      margen: Math.round((ingresos - costes) * 100) / 100
    });

    // Helper function to calculate detailed margin for spare parts with additional info
    const calculateSparePartsMargin = (ingresos: number, costes: number, cantidadMateriales: number) => {
      const margen = Math.round((ingresos - costes) * 100) / 100;
      const beneficioMedioPorMaterial = cantidadMateriales > 0 ? 
        Math.round((margen / cantidadMateriales) * 100) / 100 : 0;
      
      return {
        ingresos: Math.round(ingresos * 100) / 100,
        costes: Math.round(costes * 100) / 100,
        margen,
        cantidad_materiales: cantidadMateriales,
        beneficio_medio_por_material: beneficioMedioPorMaterial
      };
    };

    // Get spare parts quantity from insurance amounts
    const cantidadMaterialesRepuestos = safeParseFloat(insuranceAmounts.spare_parts_quantity) || 0;

    // Get workshop name from profile or use default
    const getWorkshopName = () => {
      // TODO: Implement workshop name retrieval from user profile or workshop table
      return 'Taller'; // Placeholder
    };

    return {
      case_id: caseId || 'N/A',
      metadata: {
        matricula: vehicleData?.license_plate || 'N/A',
        referencia: analysis?.reference_number || vehicleData?.internal_reference || 'N/A',
        fecha: analysis?.created_at ? new Date(analysis.created_at).toLocaleDateString('es-ES') : 'N/A',
        taller: getWorkshopName()
      },
      ingresos_totales,
      costes_totales,
      margen_eur,
      margen_pct,
      margen_detallado: {
        repuestos: calculateSparePartsMargin(ingresos_repuestos, costes_repuestos, cantidadMaterialesRepuestos),
        mo_chapa: calculateDetailedMargin(ingresos_mo_chapa, costes_mo_chapa),
        mo_pintura: calculateDetailedMargin(ingresos_mo_pintura, costes_mo_pintura),
        mat_pintura: calculateDetailedMargin(ingresos_mat_pintura, costes_mat_pintura),
        subcontratistas: calculateDetailedMargin(0, costes_subcontratas),
        otros_costos: calculateDetailedMargin(0, costes_otros)
      }
    };
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('es-ES', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }) + ' €';
  };

  const formatPercentage = (value: number) => {
    return value.toFixed(2) + '%';
  };

  const getMarginColor = (margin: number) => {
    if (margin > 30) return "text-success";
    if (margin > 15) return "text-warning";
    return "text-destructive";
  };

  const getMarginIcon = (margin: number) => {
    if (margin > 30) return <TrendingUp className="h-4 w-4" />;
    if (margin > 15) return <Minus className="h-4 w-4" />;
    return <TrendingDown className="h-4 w-4" />;
  };

  const handleDownloadPDF = async () => {
    if (!results) {
      toast({
        title: "Error",
        description: "No se puede generar el PDF en este momento",
        variant: "destructive",
      });
      return;
    }

    setIsDownloading(true);
    
    try {
      // Generar nombre del archivo
      const fileName = `analisis_${results.metadata.matricula}_${results.metadata.referencia}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      // Configurar el título del documento para la impresión
      const originalTitle = document.title;
      document.title = fileName;
      
      // Aplicar clase para estilos de impresión
      document.body.classList.add('print-mode');
      
      // Esperar un momento para que los estilos se apliquen
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Usar la API de impresión del navegador pero interceptar para guardar como PDF
      if (window.navigator.userAgent.includes('Chrome') || window.navigator.userAgent.includes('Edge')) {
        // Para navegadores basados en Chromium, usar window.print() directamente
        // El usuario podrá elegir "Guardar como PDF" en el diálogo de impresión
        window.print();
      } else {
        // Fallback para otros navegadores
        window.print();
      }
      
      // Restaurar el título original después de un momento
      setTimeout(() => {
        document.title = originalTitle;
        document.body.classList.remove('print-mode');
      }, 1000);
      
      toast({
        title: "Diálogo de impresión abierto",
        description: "Selecciona 'Guardar como PDF' en el diálogo de impresión",
      });
    } catch (error) {
      const appError = createError(
        ErrorType.PDF_GENERATION_ERROR,
        'Error al abrir el diálogo de impresión. Inténtalo de nuevo.',
        error
      );
      handleError(appError, toast);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenOriginalPDF = () => {
    if (!pdfUrl) {
      toast({
        title: "PDF no disponible",
        description: "No hay un PDF original asociado a este análisis",
        variant: "destructive",
      });
      return;
    }

    // Abrir el PDF en una nueva pestaña
    window.open(pdfUrl, '_blank', 'noopener,noreferrer');
  };



  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-lg font-medium text-foreground">Cargando análisis de rentabilidad...</p>
            <p className="text-sm text-muted-foreground mt-2">Calculando márgenes y generando informe</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <div>
                <h3 className="font-semibold text-destructive">Error al cargar el análisis</h3>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
            <div className="mt-4">
              <Link to="/app/nuevo">
                <Button variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver al inicio
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No results state
  if (!results) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">No se encontraron datos para este análisis.</p>
            <Link to="/app/nuevo" className="mt-4 inline-block">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al inicio
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div ref={contentRef} className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 noprint">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Análisis de Rentabilidad
          </h1>
          <p className="text-lg text-muted-foreground">
            Expediente {results.metadata.referencia} • {results.metadata.matricula}
          </p>
        </div>
        <div className="flex items-center space-x-4 no-pdf">
          <Link to="/app/costes/demo-case-id">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Atrás
            </Button>
          </Link>

          {pdfUrl && (
            <Button 
              onClick={handleOpenOriginalPDF}
              variant="outline"
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <FileText className="mr-2 h-4 w-4" />
              Ver Valoración
            </Button>
          )}

          <Button 
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Download className="mr-2 h-4 w-4" />
            {isDownloading ? 'Generando...' : 'Descargar PDF'}
          </Button>
        </div>
      </div>

      {/* Título solo para impresión */}
      <div className="hidden print:block mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Análisis de Rentabilidad
        </h1>
        <p className="text-base text-muted-foreground">
          Expediente {results.metadata.referencia} • {results.metadata.matricula}
        </p>
      </div>

      {/* Key metrics */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Ingresos Totales</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(results.ingresos_totales)}</p>
                <p className="text-xs text-muted-foreground mt-1">Importe aseguradora (Base Imponible)</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Costes Totales</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(results.costes_totales)}</p>
                <p className="text-xs text-muted-foreground mt-1">Costes reales del taller</p>
              </div>
              <div className="p-3 bg-destructive/10 rounded-full">
                <TrendingDown className="h-6 w-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-success border-success/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-success-foreground/80 mb-1">Margen Neto</p>
                <p className="text-2xl font-bold text-success-foreground">
                  {formatCurrency(results.margen_eur)}
                </p>
                <div className="flex items-center space-x-1 mt-1">
                  <Badge className={`${getMarginColor(results.margen_pct)} bg-success-soft border-success/20`}>
                    {getMarginIcon(results.margen_pct)}
                    <span className="ml-1">{formatPercentage(results.margen_pct)}</span>
                  </Badge>
                </div>
              </div>
              <div className="p-3 bg-success-foreground/10 rounded-full">
                <TrendingUp className="h-6 w-6 text-success-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed breakdown */}
      <div className="space-y-6 mb-8">
        {/* Breakdown table - Full width */}
        <Card>
          <CardHeader>
            <CardTitle>Desglose por Concepto</CardTitle>
            <CardDescription>
              Comparativa detallada de ingresos vs costes por bloque de trabajo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(results.margen_detallado).map(([key, data]) => {
                const titles = {
                  repuestos: 'Repuestos',
                  mo_chapa: 'M.O. Chapa',
                  mo_pintura: 'M.O. Pintura',
                  mat_pintura: 'Mat. Pintura',
                  subcontratistas: 'Subcontratistas',
                  otros_costos: 'Otros Costos'
                };
                
                const marginPct = data.ingresos > 0 ? (data.margen / data.ingresos) * 100 : 0;
                
                return (
                  <div key={key} className="border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-foreground">
                        {titles[key as keyof typeof titles]}
                      </h4>
                      <Badge variant={marginPct > 30 ? "default" : marginPct > 15 ? "secondary" : "destructive"}>
                        {data.ingresos > 0 ? formatPercentage(marginPct) : 'Solo costos'}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ingresos</span>
                        <span className="font-medium">{formatCurrency(data.ingresos)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Costes</span>
                        <span className="font-medium">{formatCurrency(data.costes)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Margen</span>
                        <span className={`font-medium ${data.margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(data.margen)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Información adicional para repuestos */}
                    {key === 'repuestos' && data.cantidad_materiales !== undefined && data.beneficio_medio_por_material !== undefined && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Cantidad de materiales</span>
                            <span className="font-medium">{data.cantidad_materiales} piezas</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Beneficio medio por material</span>
                            <span className={`font-medium ${data.beneficio_medio_por_material >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(data.beneficio_medio_por_material)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Visual representation - Full width below */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución de Márgenes</CardTitle>
            <CardDescription>
              Visualización de la rentabilidad por concepto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(results.margen_detallado).map(([key, data]) => {
                const titles = {
                  repuestos: 'Repuestos',
                  mo_chapa: 'M.O. Chapa',
                  mo_pintura: 'M.O. Pintura',
                  mat_pintura: 'Mat. Pintura',
                  subcontratistas: 'Subcontratistas',
                  otros_costos: 'Otros Costos'
                };
                
                const marginPct = data.ingresos > 0 ? (data.margen / data.ingresos) * 100 : 0;
                const barWidth = Math.max(Math.abs(marginPct), 5); // Minimum 5% for visibility
                
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{titles[key as keyof typeof titles]}</span>
                      <span className={`text-muted-foreground ${data.margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(data.margen)}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full transition-all duration-500 ${
                          marginPct > 30 ? 'bg-gradient-success' : 
                          marginPct > 15 ? 'bg-gradient-primary' : 
                          marginPct >= 0 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(barWidth, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {data.ingresos > 0 ? formatPercentage(marginPct) + ' de rentabilidad' : 'Solo costos'}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary and recommendations */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-primary" />
            <span>Resumen Ejecutivo</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <p className="text-foreground mb-4">
              <strong>Análisis del expediente {results.metadata.referencia}:</strong> El análisis muestra 
              una rentabilidad global del <strong className={getMarginColor(results.margen_pct)}>
              {formatPercentage(results.margen_pct)}</strong>, generando un margen neto de <strong className="text-success">
              {formatCurrency(results.margen_eur)}</strong>.
            </p>
            
            <div className="grid md:grid-cols-2 gap-6 mt-6">
              <div>
                <h4 className="font-semibold text-foreground mb-2">Puntos Fuertes:</h4>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  {(() => {
                    // Calcular rentabilidades para cada concepto
                    const conceptos = [
                      {
                        nombre: "M.O. Chapa",
                        descripcion: "excelente margen del",
                        rentabilidad: results.margen_detallado.mo_chapa.ingresos > 0 
                          ? (results.margen_detallado.mo_chapa.margen / results.margen_detallado.mo_chapa.ingresos) * 100 
                          : 0
                      },
                      {
                        nombre: "Materiales pintura",
                        descripcion: "rentabilidad del",
                        rentabilidad: results.margen_detallado.mat_pintura.ingresos > 0 
                          ? (results.margen_detallado.mat_pintura.margen / results.margen_detallado.mat_pintura.ingresos) * 100 
                          : 0
                      },
                      {
                        nombre: "M.O. Pintura",
                        descripcion: "margen del",
                        rentabilidad: results.margen_detallado.mo_pintura.ingresos > 0 
                          ? (results.margen_detallado.mo_pintura.margen / results.margen_detallado.mo_pintura.ingresos) * 100 
                          : 0
                      }
                    ];

                    // Ordenar por rentabilidad de mayor a menor
                    const conceptosOrdenados = conceptos.sort((a, b) => b.rentabilidad - a.rentabilidad);

                    return conceptosOrdenados.map((concepto, index) => (
                      <li key={index}>
                        • {concepto.nombre}: {concepto.descripcion} {formatPercentage(concepto.rentabilidad)}
                      </li>
                    ));
                  })()}
                  <li>• Gestión eficiente de costes laborales</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-2">Oportunidades de Mejora:</h4>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>• Revisar proveedores de repuestos para mejor margen</li>
                  <li>• Optimizar tiempos de mano de obra de pintura</li>
                  <li>• Negociar mejores tarifas con aseguradoras</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <Card className="bg-primary-soft border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 sm:space-x-4">
            <div>
              <h3 className="font-semibold text-primary mb-1">¿Te ha sido útil este análisis?</h3>
              <p className="text-sm text-primary/80">
                Comparte tu informe o inicia un nuevo análisis para optimizar más expedientes
              </p>
            </div>
            <div className="flex space-x-3">
              <Button variant="outline" className="border-primary/20">
                <Share2 className="mr-2 h-4 w-4" />
                Compartir
              </Button>
              <Link to="/app/nuevo">
                <Button className="bg-gradient-primary text-primary-foreground shadow-glow">
                  Nuevo Análisis
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Results;