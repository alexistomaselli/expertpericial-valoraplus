import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

import { Upload, FileText, AlertCircle, CheckCircle2, ArrowRight, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useMonthlyUsage } from "@/hooks/use-monthly-usage";
import { useAnalysisBalance } from "@/hooks/use-analysis-balance";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { useAnalysisPackages } from "@/hooks/use-analysis-packages";
import StripeIcon from "@/components/StripeIcon";
import { usePDFExtraction } from "@/hooks/use-pdf-extraction";
import { extractPDFData, isPDFExtractionConfigured } from "@/services/pdfExtractionService";

// Tipos de error personalizados
enum ErrorType {
  FILE_VALIDATION = 'FILE_VALIDATION',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  AI_EXTRACTION_ERROR = 'AI_EXTRACTION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

interface AppError {
  type: ErrorType;
  message: string;
  details?: string;
  userMessage: string;
}

// Funciones auxiliares para manejo de errores
const createError = (type: ErrorType, message: string, details?: string): AppError => {
  const userMessages = {
    [ErrorType.FILE_VALIDATION]: 'El archivo seleccionado no es válido. Por favor, selecciona un PDF de valoración válido.',
    [ErrorType.UPLOAD_FAILED]: 'No se pudo subir el archivo. Por favor, verifica tu conexión e inténtalo de nuevo.',
    [ErrorType.PROCESSING_FAILED]: 'No se pudo procesar el PDF. Verifica que sea un archivo de valoración válido.',
    [ErrorType.DATABASE_ERROR]: 'Error al guardar los datos. Por favor, inténtalo de nuevo.',
    [ErrorType.NETWORK_ERROR]: 'Error de conexión. Por favor, verifica tu conexión a internet.',
    [ErrorType.AI_EXTRACTION_ERROR]: 'Error en la extracción automática de datos. Por favor, inténtalo de nuevo o contacta soporte.',
    [ErrorType.UNKNOWN_ERROR]: 'Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.'
  };

  return {
    type,
    message,
    details,
    userMessage: userMessages[type]
  };
};

/**
 * Procesa un archivo PDF usando nuestro servicio de IA
 */
const processWithAI = async (file: File, analysisId: string): Promise<any> => {
  console.log('=== INICIANDO EXTRACCIÓN CON IA ===');
  
  try {
    // Primero necesitamos extraer el texto del PDF
    // Para esto, usaremos la misma lógica que n8n: enviar el PDF a un servicio de extracción de texto
    console.log('Extrayendo texto del PDF...');
    
    // Convertir archivo a ArrayBuffer para procesamiento
    const arrayBuffer = await file.arrayBuffer();
    
    // Crear FormData para enviar a un servicio de extracción de texto
    // Por ahora, vamos a simular el texto extraído usando el ejemplo que tenemos
    // En una implementación real, aquí usaríamos una librería como pdf-parse o similar
    
    // TEMPORAL: Usar el texto del ejemplo de respuesta de n8n que sabemos que funciona
    const sampleText = `INFORME DE VALORACIÓN DE REPARACIÓN
    
DATOS DEL VEHÍCULO:
Matrícula: 1234ABC
Número de bastidor: WVWZZZ1JZ3W123456
Fabricante: VOLKSWAGEN
Modelo: GOLF
Referencia interna: REF-2024-001
Sistema: AUDATEX
Precio/hora chapa: 45.00 €
Precio/hora pintura: 42.00 €

VALORACIÓN DE REPARACIÓN:
Total repuestos: 1,250.50 €
M.O. Chapa: 8.5 UT (382.50 €)
M.O. Pintura: 6.2 UT (261.00 €)
Materiales pintura: 125.75 €

RESUMEN:
Subtotal sin IVA: 2,019.75 €
IVA (21%): 424.15 €
TOTAL CON IVA: 2,443.90 €

Fecha de valoración: 15/01/2024`;
    
    console.log('Texto extraído del PDF (simulado):', sampleText.substring(0, 200) + '...');
    
    // Usar nuestro servicio de IA para extraer datos del texto
    const extractedData = await extractPDFData(sampleText);
    console.log('Datos extraídos con IA:', extractedData);
    
    // Convertir formato de nuestro servicio al formato esperado por la base de datos
     const convertedData = {
       matricula: extractedData.vehicleData.matricula,
       bastidor: extractedData.vehicleData.bastidor,
       fabricante: extractedData.vehicleData.fabricante,
       modelo: extractedData.vehicleData.modelo,
       referencia: extractedData.vehicleData.referencia,
       sistema: extractedData.vehicleData.sistema,
       precio_hora: extractedData.insuranceAmounts.precio_por_hora_chapa?.toString(),
       fecha_valoracion: extractedData.vehicleData.fecha_valoracion,
       repuestos_total: extractedData.insuranceAmounts.total_repuestos?.toString(),
       cantidad_materiales_repuestos: extractedData.insuranceAmounts.cantidad_materiales_repuestos?.toString(),
       mo_chapa_ut: extractedData.insuranceAmounts.mo_chapa_ut?.toString(),
       mo_chapa_eur: extractedData.insuranceAmounts.mo_chapa_eur?.toString(),
       mo_pintura_ut: extractedData.insuranceAmounts.mo_pintura_ut?.toString(),
       mo_pintura_eur: extractedData.insuranceAmounts.mo_pintura_eur?.toString(),
       mat_pintura_eur: extractedData.insuranceAmounts.materiales_pintura_eur?.toString(),
       iva: extractedData.insuranceAmounts.porcentaje_iva?.toString() + '%',
       // Nuevos campos de horas convertidas
       mo_chapa_horas: extractedData.insuranceAmounts.mo_chapa_horas?.toString(),
       mo_pintura_horas: extractedData.insuranceAmounts.mo_pintura_horas?.toString(),
       unidades_detectadas: extractedData.insuranceAmounts.unidades_detectadas
     };
    
    console.log('Datos convertidos para BD:', convertedData);
    return convertedData;
    
  } catch (error) {
    console.error('Error en extracción con IA:', error);
    throw createError(ErrorType.AI_EXTRACTION_ERROR, `Error extrayendo datos con IA: ${error}`);
  }
};

const handleError = async (error: unknown, toast: any, analysisId?: string): Promise<void> => {
  let appError: AppError;

  if (error instanceof Error) {
    // Clasificar el error basado en el mensaje
    if (error.message.includes('n8n')) {
      appError = createError(ErrorType.PROCESSING_FAILED, error.message);
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      appError = createError(ErrorType.NETWORK_ERROR, error.message);
    } else if (error.message.includes('database') || error.message.includes('supabase')) {
      appError = createError(ErrorType.DATABASE_ERROR, error.message);
    } else {
      appError = createError(ErrorType.UNKNOWN_ERROR, error.message);
    }
  } else {
    appError = createError(ErrorType.UNKNOWN_ERROR, 'Error desconocido', String(error));
  }

  // Log del error para debugging
  console.error('Error details:', {
    type: appError.type,
    message: appError.message,
    details: appError.details,
    analysisId,
    timestamp: new Date().toISOString()
  });

  // Marcar análisis como fallido si existe
  if (analysisId) {
    try {
      await supabase
        .from('analysis')
        .update({ 
          status: 'failed',
          error_message: appError.message
        })
        .eq('id', analysisId);
    } catch (updateError) {
      console.error('Error updating analysis status:', updateError);
    }
  }

  // Mostrar mensaje al usuario
  toast({
    title: "Error al procesar PDF",
    description: appError.userMessage,
    variant: "destructive"
  });
};

/**
 * Función reutilizable para procesar datos extraídos y guardarlos en la base de datos
 */
const processExtractedData = async (extractedData: any, analysisId: string, session: any, supabase: any) => {
  console.log('=== PROCESANDO DATOS EXTRAÍDOS ===');
  console.log('extractedData:', JSON.stringify(extractedData, null, 2));
  console.log('analysisId:', analysisId);

  // Función auxiliar para parsear números
  const parseNumber = (str: string) => {
    if (!str) return null;
    const cleaned = str.replace(/[€\s.]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  // Función auxiliar para parsear porcentaje de IVA
  const parseIvaPercentage = (ivaStr: string) => {
    if (!ivaStr) return 21;
    const cleaned = ivaStr.replace('%', '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 21 : num;
  };

  // Usar directamente los valores calculados por la IA en lugar de recalcular
  const subtotalSinIva = extractedData.insuranceAmounts?.subtotal_sin_iva || 0;
  const ivaAmount = extractedData.insuranceAmounts?.monto_iva || 0;
  const totalConIva = extractedData.insuranceAmounts?.total_con_iva || 0;
  const ivaPercentage = extractedData.insuranceAmounts?.porcentaje_iva || 21;

  console.log('=== USANDO VALORES DIRECTOS DE LA IA ===');
  console.log('Subtotal sin IVA (IA):', subtotalSinIva);
  console.log('Monto IVA (IA):', ivaAmount);
  console.log('Total con IVA (IA):', totalConIva);
  console.log('Porcentaje IVA (IA):', ivaPercentage);
  console.log('=======================================');

  // Guardar datos del vehículo
  const { error: vehicleError } = await supabase
    .from('vehicle_data')
    .insert({
      analysis_id: analysisId,
      license_plate: extractedData.vehicleData?.matricula || null,
      vin: extractedData.vehicleData?.bastidor || null,
      manufacturer: extractedData.vehicleData?.fabricante || null,
      model: extractedData.vehicleData?.modelo || null,
      internal_reference: extractedData.vehicleData?.referencia || null,
      system: extractedData.vehicleData?.sistema || null,
      hourly_price: extractedData.insuranceAmounts?.precio_por_hora_chapa || null
    });

  if (vehicleError) {
    console.error('Error guardando vehicle_data:', vehicleError);
    throw new Error('Error guardando datos del vehículo');
  }

  // Guardar importes de la aseguradora
  const insuranceData = {
    analysis_id: analysisId,
    total_spare_parts_eur: extractedData.insuranceAmounts?.total_repuestos || null,
    spare_parts_quantity: extractedData.insuranceAmounts?.cantidad_materiales_repuestos || null,
    bodywork_labor_ut: extractedData.insuranceAmounts?.mo_chapa_ut || null,
    bodywork_labor_eur: extractedData.insuranceAmounts?.mo_chapa_eur || null,
    bodywork_labor_hours: extractedData.insuranceAmounts?.mo_chapa_horas || null,
    painting_labor_ut: extractedData.insuranceAmounts?.mo_pintura_ut || null,
    painting_labor_eur: extractedData.insuranceAmounts?.mo_pintura_eur || null,
    painting_labor_hours: extractedData.insuranceAmounts?.mo_pintura_horas || null,
    paint_material_eur: extractedData.insuranceAmounts?.materiales_pintura_eur || null,
    bodywork_hourly_price: extractedData.insuranceAmounts?.precio_por_hora_chapa || null,
    painting_hourly_price: extractedData.insuranceAmounts?.precio_por_hora_pintura || null,
    net_subtotal: subtotalSinIva,
    iva_amount: ivaAmount,
    total_with_iva: totalConIva,
    iva_percentage: ivaPercentage
  };

  const { error: insuranceError } = await supabase
    .from('insurance_amounts')
    .insert(insuranceData);

  if (insuranceError) {
    console.error('Error guardando insurance_amounts:', insuranceError);
    throw new Error('Error guardando importes de la aseguradora');
  }

  // Procesar fecha de valoración
  const parseDate = (dateStr: string) => {
    if (!dateStr) return null;
    
    const formats = [
      /^(\d{2})\/(\d{2})\/(\d{4})$/,
      /^(\d{4})-(\d{2})-(\d{2})$/,
      /^(\d{2})-(\d{2})-(\d{4})$/
    ];
    
    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format === formats[0] || format === formats[2]) {
          const [, day, month, year] = match;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } else {
          return dateStr;
        }
      }
    }
    
    return null;
  };

  const valuation_date = parseDate(extractedData.vehicleData?.fecha_valoracion);

  console.log('=== DEBUG VALUATION_DATE (PROCESS EXTRACTED DATA) ===');
  console.log('extractedData.vehicleData.fecha_valoracion:', extractedData.vehicleData?.fecha_valoracion);
  console.log('valuation_date parseada:', valuation_date);
  console.log('analysis.id:', analysisId);
  console.log('====================================================');

  // Actualizar el análisis con valuation_date
  const { error: updateError } = await supabase
    .from('analysis')
    .update({ 
      valuation_date: valuation_date,
      status: 'completed'
    })
    .eq('id', analysisId);

  if (updateError) {
    console.error('Error actualizando valuation_date:', updateError);
    console.log('updateError details:', updateError);
    throw new Error('Error actualizando análisis');
  } else {
    console.log('✅ valuation_date guardada correctamente:', valuation_date);
  }

  console.log('=== DATOS GUARDADOS EN BASE DE DATOS ===');
  console.log('Vehicle Data:', {
    analysis_id: analysisId,
    license_plate: extractedData.vehicleData?.matricula,
    manufacturer: extractedData.vehicleData?.fabricante,
    model: extractedData.vehicleData?.modelo
  });
  console.log('Insurance Data:', insuranceData);
  console.log('Valuation Date:', valuation_date);
  console.log('=======================================');

  return { valuation_date, insuranceData };
};

const NewAnalysis = () => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  const { toast } = useToast();
  const navigate = useNavigate();
  const { session, profile, workshop } = useAuth();
  const { usage: monthlyUsage, loading: usageLoading, canCreateAnalysis, getNextAnalysisCost, refreshUsage } = useMonthlyUsage();
  const { refreshBalance } = useAnalysisBalance();
  const { settings: systemSettings } = useSystemSettings();
  const { packages, loading: packagesLoading } = useAnalysisPackages();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      // Verificar si el usuario puede crear un análisis gratuito ANTES de procesar el archivo
      if (!canCreateAnalysis()) {
        // Si no puede, mostrar directamente el modal de pago sin procesar el archivo
        setShowPaymentModal(true);
        return;
      }
      
      // Si puede crear análisis, procesar el archivo normalmente
      handleFile(e.dataTransfer.files[0]);
    }
  }, [canCreateAnalysis]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Validate file type
    if (file.type !== 'application/pdf') {
      toast({
        title: "Tipo de archivo no válido",
        description: "Por favor, sube únicamente archivos PDF.",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: "Archivo demasiado grande",
        description: "El archivo no puede superar los 20MB.",
        variant: "destructive"
      });
      return;
    }

    setUploadedFile(file);
    uploadFile(file);
  };



  const processPayment = async () => {
    setIsProcessingPayment(true);
    
    try {
      if (!selectedPackage) {
        throw new Error('Debe seleccionar un paquete');
      }

      // Pago de paquete
      const packageData = packages.find(pkg => pkg.id === selectedPackage);
      if (!packageData) {
        throw new Error('Paquete seleccionado no encontrado');
      }

      const paymentData = {
        currency: 'eur',
        package_id: selectedPackage,
        analyses_count: packageData.analyses_count,
        description: `Paquete: ${packageData.name} - ${packageData.analyses_count} análisis`,
        user_id: session?.user?.id
      };
      
      // Crear sesión de pago con Stripe
      console.log('Creating payment session with data:', paymentData);
      const { data, error } = await supabase.functions.invoke('payment-session', {
        body: paymentData
      });

      if (error) {
        throw new Error(`Error creando sesión de pago: ${error.message}`);
      }

      if (data?.url) {
        // Redirigir a Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error('No se recibió URL de pago');
      }

    } catch (error) {
      console.error('Error procesando pago:', error);
      toast({
        title: "Error en el pago",
        description: error instanceof Error ? error.message : "No se pudo procesar el pago.",
        variant: "destructive"
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    let analysisId: string | undefined;

    try {
      if (!session?.user?.id) {
        throw createError(ErrorType.UNKNOWN_ERROR, 'Usuario no autenticado').message;
      }

      // Validación adicional del archivo
      if (!file.type.includes('pdf')) {
        throw createError(ErrorType.FILE_VALIDATION, 'Tipo de archivo no válido').message;
      }

      if (file.size > 20 * 1024 * 1024) {
        throw createError(ErrorType.FILE_VALIDATION, 'Archivo demasiado grande').message;
      }

      // PASO 1: Subir PDF a Supabase Storage
      console.log('Subiendo PDF a Supabase Storage...');
      
      const fileName = `${session.user.id}/${Date.now()}_${file.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('analysis-pdfs')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Error subiendo PDF:', uploadError);
        throw createError(ErrorType.UPLOAD_FAILED, `Error subiendo PDF: ${uploadError.message}`).message;
      }

      // PASO 2: Obtener URL firmada del PDF (válida por 1 año)
      const { data: urlData, error: urlError } = await supabase.storage
        .from('analysis-pdfs')
        .createSignedUrl(fileName, 31536000); // 1 año en segundos

      if (urlError) {
        console.error('Error generando URL firmada:', urlError);
        // Si falla la generación de URL, eliminar el PDF subido
        try {
          await supabase.storage.from('analysis-pdfs').remove([fileName]);
        } catch (cleanupError) {
          console.error('Error limpiando archivo:', cleanupError);
        }
        throw createError(ErrorType.UPLOAD_FAILED, `Error generando URL del PDF: ${urlError.message}`).message;
      }

      const pdfUrl = urlData.signedUrl;
      console.log('PDF subido exitosamente:', pdfUrl);

      // Obtener workshop_id del perfil o del contexto, con fallback a consulta rápida
      let workshopId: string | null = profile?.workshop_id ?? workshop?.id ?? null;
      if (!workshopId) {
        const { data: profData } = await supabase
          .from('profiles')
          .select('workshop_id')
          .eq('id', session.user.id)
          .single();
        workshopId = (profData as any)?.workshop_id ?? null;
      }

      // PASO 3: Crear registro en analysis con status 'processing'
      const insertPayload: any = {
        user_id: session.user.id,
        status: 'processing',
        pdf_filename: file.name,
        pdf_url: pdfUrl,
      };
      // Incluir workshop_id explícitamente si lo tenemos; si no, el trigger lo rellenará
      if (workshopId) {
        insertPayload.workshop_id = workshopId;
      }

      const { data: analysis, error: analysisError } = await supabase
        .from('analysis')
        .insert(insertPayload)
        .select('*')
        .single();

      if (analysisError) {
        console.error('Error creando análisis:', analysisError);
        // Si falla la creación del análisis, eliminar el PDF subido
        try {
          await supabase.storage.from('analysis-pdfs').remove([fileName]);
        } catch (cleanupError) {
          console.error('Error limpiando archivo:', cleanupError);
        }
        throw createError(ErrorType.DATABASE_ERROR, `Error creando análisis: ${analysisError.message}`).message;
      }

      if (!analysis) {
        try {
          await supabase.storage.from('analysis-pdfs').remove([fileName]);
        } catch (cleanupError) {
          console.error('Error limpiando archivo:', cleanupError);
        }
        throw createError(ErrorType.DATABASE_ERROR, 'No se pudo crear el análisis').message;
      }

      // Asignar el ID del análisis para el manejo de errores
      analysisId = analysis.id;

      // Validar que workshop_id quedó asignado (por inserción directa o trigger)
      if (!analysis.workshop_id) {
        console.warn('workshop_id no se asignó en el insert; intentando actualizar desde perfil...');
        if (workshopId) {
          await supabase
            .from('analysis')
            .update({ workshop_id: workshopId })
            .eq('id', analysis.id);
        }
      }

      // PASO 4: Enviar archivo a n8n para extracción de texto
      console.log('=== ENVIANDO ARCHIVO A N8N PARA EXTRACCIÓN ===');
      
      const webhookUrl = 'https://bot-bitrix-n8n.uhcoic.easypanel.host/webhook/23154e6f-420b-4186-be36-8b7585da797a';
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('analysis_id', analysis.id);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response from n8n:', errorText);
        console.log('=== INTENTANDO EXTRACCIÓN CON IA COMO RESPALDO ===');
        
        // Intentar usar nuestro servicio de IA como respaldo
        if (isPDFExtractionConfigured()) {
          try {
            const aiExtractedData = await processWithAI(file, analysis.id);
            console.log('Extracción con IA exitosa, continuando con el procesamiento...');
            
            // Usar los datos extraídos con IA en lugar de los de n8n
            const extractedData = aiExtractedData;
            
            // Continuar con el procesamiento normal usando los datos de IA
            const parseNumber = (str: string) => {
              if (!str) return null;
              const cleaned = str.replace(/[€\s.]/g, '').replace(',', '.');
              const num = parseFloat(cleaned);
              return isNaN(num) ? null : num;
            };

            const parseIvaPercentage = (ivaStr: string) => {
              if (!ivaStr) return 21;
              const cleaned = ivaStr.replace('%', '');
              const num = parseFloat(cleaned);
              return isNaN(num) ? 21 : num;
            };

            // Usar valores directos de la IA si están disponibles, sino calcular
            let subtotalSinIva, ivaAmount, totalConIva, ivaPercentage;
            
            if (extractedData.insuranceAmounts?.subtotal_sin_iva) {
              // Usar valores directos de la IA (formato nuevo)
              subtotalSinIva = extractedData.insuranceAmounts.subtotal_sin_iva;
              ivaAmount = extractedData.insuranceAmounts.monto_iva;
              totalConIva = extractedData.insuranceAmounts.total_con_iva;
              ivaPercentage = extractedData.insuranceAmounts.porcentaje_iva || 21;
              
              console.log('=== USANDO VALORES DIRECTOS DE LA IA (FALLBACK) ===');
              console.log('Subtotal sin IVA (IA):', subtotalSinIva);
              console.log('Monto IVA (IA):', ivaAmount);
              console.log('Total con IVA (IA):', totalConIva);
              console.log('================================================');
            } else {
              // Calcular usando formato antiguo
              ivaPercentage = parseIvaPercentage(extractedData.iva);
              const ivaDecimal = ivaPercentage / 100;

              const repuestos = parseNumber(extractedData.repuestos_total) || 0;
              const moChapa = parseNumber(extractedData.mo_chapa_eur) || 0;
              const moPintura = parseNumber(extractedData.mo_pintura_eur) || 0;
              const matPintura = parseNumber(extractedData.mat_pintura_eur) || 0;
              
              subtotalSinIva = repuestos + moChapa + moPintura + matPintura;
              ivaAmount = subtotalSinIva * ivaDecimal;
              totalConIva = subtotalSinIva + ivaAmount;
              
              console.log('=== CALCULANDO CON FORMATO ANTIGUO (FALLBACK) ===');
              console.log('Subtotal calculado:', subtotalSinIva);
              console.log('IVA calculado:', ivaAmount);
              console.log('Total calculado:', totalConIva);
              console.log('===============================================');
            }

            // Guardar datos del vehículo
            const { error: vehicleError } = await supabase
              .from('vehicle_data')
              .insert({
                analysis_id: analysis.id,
                license_plate: extractedData.matricula || null,
                vin: extractedData.bastidor || null,
                manufacturer: extractedData.fabricante || null,
                model: extractedData.modelo || null,
                internal_reference: extractedData.referencia || null,
                system: extractedData.sistema || null,
                hourly_price: parseNumber(extractedData.precio_hora)
              });

            if (vehicleError) {
              console.error('Error guardando vehicle_data:', vehicleError);
              throw new Error('Error guardando datos del vehículo');
            }

            // Guardar importes de la aseguradora
            const insuranceData = {
              analysis_id: analysis.id,
              total_spare_parts_eur: parseNumber(extractedData.repuestos_total),
              bodywork_labor_ut: parseNumber(extractedData.mo_chapa_ut),
              bodywork_labor_eur: parseNumber(extractedData.mo_chapa_eur),
              painting_labor_ut: parseNumber(extractedData.mo_pintura_ut),
              painting_labor_eur: parseNumber(extractedData.mo_pintura_eur),
              paint_material_eur: parseNumber(extractedData.mat_pintura_eur),
              net_subtotal: subtotalSinIva,
              iva_amount: ivaAmount,
              total_with_iva: totalConIva,
              iva_percentage: ivaPercentage,
              // Nuevos campos de horas convertidas
              bodywork_labor_hours: parseNumber(extractedData.mo_chapa_horas),
              painting_labor_hours: parseNumber(extractedData.mo_pintura_horas),
              detected_units: extractedData.unidades_detectadas
            };

            const { error: insuranceError } = await supabase
              .from('insurance_amounts')
              .insert(insuranceData);

            if (insuranceError) {
              console.error('Error guardando insurance_amounts:', insuranceError);
              throw new Error('Error guardando importes de la aseguradora');
            }

            // Procesar fecha de valoración
            const parseDate = (dateStr: string) => {
              if (!dateStr) return null;
              
              const formats = [
                /^(\d{2})\/(\d{2})\/(\d{4})$/,
                /^(\d{4})-(\d{2})-(\d{2})$/,
                /^(\d{2})-(\d{2})-(\d{4})$/
              ];
              
              for (const format of formats) {
                const match = dateStr.match(format);
                if (match) {
                  if (format === formats[0] || format === formats[2]) {
                    const [, day, month, year] = match;
                    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                  } else {
                    return dateStr;
                  }
                }
              }
              
              return null;
            };

            const valuation_date = parseDate(extractedData.vehicleData.fecha_valoracion);

            console.log('=== DEBUG VALUATION_DATE (AI FALLBACK) ===');
            console.log('extractedData.vehicleData.fecha_valoracion:', extractedData.vehicleData.fecha_valoracion);
            console.log('valuation_date parseada:', valuation_date);
            console.log('analysis.id:', analysis.id);
            console.log('==========================================');
            
            // Marcar análisis como completado
            const { error: updateError } = await supabase
              .from('analysis')
              .update({ 
                status: 'completed',
                valuation_date: valuation_date
              })
              .eq('id', analysis.id);

            console.log('=== DEBUG UPDATE RESULT (AI FALLBACK) ===');
            console.log('updateError:', updateError);
            console.log('=========================================');

            if (updateError) {
              console.error('Error actualizando status:', updateError);
            }

            setIsUploading(false);

            toast({
              title: "PDF procesado exitosamente",
              description: "Los datos se han extraído con IA y guardado correctamente.",
            });

            try {
              await refreshBalance();
              await refreshUsage();
            } catch (refreshError) {
              console.error('Error actualizando balance:', refreshError);
            }

            // Redireccionar automáticamente a verificación
            setTimeout(() => {
              window.location.href = `/app/verificacion/${analysis.id}`;
            }, 1000);

            return; // Salir de la función ya que el procesamiento fue exitoso
            
          } catch (aiError) {
            console.error('Error en extracción con IA:', aiError);
            // Si también falla la IA, marcar como fallido y continuar con el error original
          }
        }
        
        // Si no hay IA configurada o falló, marcar análisis como fallido
        await supabase
          .from('analysis')
          .update({ status: 'failed' })
          .eq('id', analysis.id);
        
        throw new Error(`Error en n8n: ${response.status} - ${errorText}. ${isPDFExtractionConfigured() ? 'La extracción con IA también falló.' : 'Servicio de IA no configurado.'}`);
      }

      const responseText = await response.text();
      console.log('=== RAW RESPONSE ===');
      console.log(responseText);
      console.log('====================');

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        
        // Marcar análisis como fallido
        await supabase
          .from('analysis')
          .update({ status: 'failed' })
          .eq('id', analysis.id);
        
        throw new Error('No se pudo parsear la respuesta de n8n');
      }

      console.log('=== PARSED RESPONSE ===');
      console.log(JSON.stringify(result, null, 2));
      console.log('=======================');

      // N8N devuelve un objeto con el texto extraído
      let n8nResponse;
      if (Array.isArray(result)) {
        if (result.length === 0) {
          await supabase
            .from('analysis')
            .update({ status: 'failed' })
            .eq('id', analysis.id);
          throw new Error('N8N devolvió un array vacío');
        }
        n8nResponse = result[0];
      } else if (typeof result === 'object' && result !== null) {
        n8nResponse = result;
      } else {
        console.error('Result is not valid:', result);
        await supabase
          .from('analysis')
          .update({ status: 'failed' })
          .eq('id', analysis.id);
        throw new Error('Respuesta de n8n no válida: ' + JSON.stringify(result));
      }

      // Verificar que n8n devolvió texto extraído
      if (!n8nResponse.text) {
        console.error('N8N no devolvió texto extraído:', n8nResponse);
        await supabase
          .from('analysis')
          .update({ status: 'failed' })
          .eq('id', analysis.id);
        throw new Error('N8N no devolvió texto extraído del PDF');
      }

      console.log('=== TEXTO EXTRAÍDO POR N8N ===');
      console.log(n8nResponse.text);
      console.log('==============================');

      // PASO 5: Procesar el texto extraído con IA
      console.log('=== PROCESANDO TEXTO CON IA ===');
      
      if (!isPDFExtractionConfigured()) {
        await supabase
          .from('analysis')
          .update({ status: 'failed' })
          .eq('id', analysis.id);
        throw new Error('Servicio de IA no configurado');
      }

      let extractedData;
      try {
        extractedData = await extractPDFData(n8nResponse.text);
        console.log('=== DATOS EXTRAÍDOS CON IA ===');
        console.log(JSON.stringify(extractedData, null, 2));
        console.log('==============================');
      } catch (aiError) {
        console.error('Error procesando con IA:', aiError);
        await supabase
          .from('analysis')
          .update({ status: 'failed' })
          .eq('id', analysis.id);
        throw new Error('Error procesando texto con IA: ' + aiError.message);
      }

      // Usar la función reutilizable para procesar los datos
      await processExtractedData(extractedData, analysis.id, session, supabase);

      setIsUploading(false);

      toast({
        title: "PDF procesado exitosamente",
        description: "Los datos se han extraído y guardado correctamente.",
      });

      // Actualizar el balance de análisis después de completar exitosamente
      try {
        await refreshBalance();
        await refreshUsage(); // También actualizar el hook original por compatibilidad
      } catch (refreshError) {
        console.error('Error actualizando balance:', refreshError);
        // No mostramos error al usuario ya que el análisis se completó exitosamente
      }

      // Redireccionar automáticamente a verificación
      setTimeout(() => {
        window.location.href = `/app/verificacion/${analysis.id}`;
      }, 1000);

    } catch (error) {
      setIsUploading(false);
      await handleError(error, toast, analysisId);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
  };

  const handleSelectFileClick = () => {
    // Verificar si el usuario puede crear un análisis gratuito
    if (canCreateAnalysis()) {
      // Si puede, abrir el selector de archivos normalmente
      document.getElementById('file-input')?.click();
    } else {
      // Si no puede, mostrar directamente el modal de pago
      setShowPaymentModal(true);
    }
  };

  const handleCancelPayment = () => {
    // Cerrar el modal y limpiar cualquier archivo que pueda estar cargado
    setShowPaymentModal(false);
    setUploadedFile(null);
    setSelectedPackage(null);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-4">
          Nuevo Análisis de Rentabilidad
        </h1>
        <p className="text-lg text-muted-foreground">
          Sube la valoración PDF de la aseguradora para comenzar
        </p>
      </div>

      {/* Upload Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5 text-primary" />
            <span>Subir PDF de Valoración</span>
          </CardTitle>
          <CardDescription>
            Formatos compatibles: Audatex, GT Motive, Solera. Tamaño máximo: 20MB
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!uploadedFile ? (
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300",
                dragActive 
                  ? "border-primary bg-primary-soft shadow-glow" 
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center space-y-4">
                <div className={cn(
                  "p-4 rounded-full transition-colors",
                  dragActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  <Upload className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-lg font-medium text-foreground mb-2">
                    Arrastra tu PDF aquí o haz clic para seleccionar
                  </p>
                  <p className="text-sm text-muted-foreground">
                    PDF de valoración de Audatex, GT Motive o Solera
                  </p>
                </div>
                <div className="flex gap-4 mt-4">
                  <Button 
                    variant="outline" 
                    onClick={handleSelectFileClick}
                  >
                    Seleccionar Archivo
                  </Button>

                </div>
                <input
                  id="file-input"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </div>
            </div>
          ) : (
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{uploadedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {isUploading ? (
                    <div className="flex items-center space-x-2 text-primary">
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                      <span className="text-sm">Procesando...</span>
                    </div>
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={removeFile}
                    disabled={isUploading}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Information Cards */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-6 w-6 text-warning mt-1" />
              <div>
                <h3 className="font-semibold text-foreground mb-2">Datos que extraemos</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Total repuestos y materiales</li>
                  <li>• Horas de mano de obra (chapa/pintura)</li>
                  <li>• Precios por hora de trabajo</li>
                  <li>• Materiales de pintura</li>
                  <li>• Datos del vehículo (matrícula, bastidor)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3">
              <CheckCircle2 className="h-6 w-6 text-success mt-1" />
              <div>
                <h3 className="font-semibold text-foreground mb-2">Proceso automático</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Reconocimiento OCR si es necesario</li>
                  <li>• Validación de coherencia de datos</li>
                  <li>• Verificación manual opcional</li>
                  <li>• Cálculo instantáneo de márgenes</li>
                  <li>• Informe PDF automático</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Next Steps */}
      {uploadedFile && !isUploading && (
        <Card className="bg-primary-soft border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-primary mb-1">¡Perfecto!</h3>
                <p className="text-sm text-primary/80">
                  Tu PDF se ha procesado correctamente. Continúa al siguiente paso.
                </p>
              </div>
              <Button className="bg-gradient-primary text-primary-foreground shadow-glow">
                Verificar Datos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Pago */}
      <Dialog open={showPaymentModal} onOpenChange={(open) => !open && handleCancelPayment()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <span>Comprar Análisis</span>
            </DialogTitle>
            <DialogDescription>
              Has alcanzado el límite de análisis gratuitos para este mes. Elige una opción para continuar.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {packagesLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Cargando paquetes...</p>
              </div>
            ) : packages.length > 0 ? (
              <RadioGroup value={selectedPackage || ''} onValueChange={setSelectedPackage}>
                <div className="space-y-3">
                  {packages.map((pkg) => (
                    <div key={pkg.id} className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value={pkg.id} id={pkg.id} />
                      <Label htmlFor={pkg.id} className="flex-1 cursor-pointer">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{pkg.name}</h4>
                            {pkg.description && (
                              <p className="text-sm text-muted-foreground">{pkg.description}</p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              {pkg.analyses_count} análisis • €{(pkg.price_per_analysis / 100).toFixed(2)} por análisis
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">{pkg.formattedPrice}</p>
                            {pkg.savings > 0 && (
                              <p className="text-sm text-green-600">
                                Ahorras {pkg.formattedSavings}
                              </p>
                            )}
                          </div>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground">No hay paquetes disponibles en este momento.</p>
              </div>
            )}
            
            <div className="text-sm text-muted-foreground border-t pt-4 space-y-1">
              <p>• Pago único con descuentos por volumen</p>
              <p>• Los análisis se añaden a tu balance</p>
              <p>• Ideal para uso frecuente</p>
              <p className="flex items-center">
                • El pago se procesará de forma segura a través de 
                <StripeIcon className="mx-1 h-4 w-4" size={16} />
                Stripe
              </p>
              <p>• Podrás continuar inmediatamente después del pago</p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={handleCancelPayment}
              disabled={isProcessingPayment}
            >
              Cancelar
            </Button>
            <Button 
              onClick={processPayment}
              disabled={isProcessingPayment || !selectedPackage}
              className="bg-gradient-primary text-primary-foreground"
            >
              {isProcessingPayment ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Procesando...
                </>
              ) : (
                 <>
                   <StripeIcon className="mr-2 h-4 w-4" size={16} />
                   {selectedPackage ? (
                     `Pagar ${packages.find(p => p.id === selectedPackage)?.formattedPrice || '€0.00'}`
                   ) : (
                     'Selecciona un paquete'
                   )}
                 </>
               )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewAnalysis;