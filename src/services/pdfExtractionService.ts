// Servicio de extracción de datos de PDFs usando IA
// Reemplaza la funcionalidad de n8n para procesar PDFs de valoración pericial
import { supabase } from '../lib/supabase';

export interface VehicleData {
  matricula: string;
  bastidor: string;
  fabricante: string;
  modelo: string;
  referencia: string;
  sistema: string;
  precio_por_hora: number; // Unificado en un solo campo
  fecha_valoracion: string;
}

export interface InsuranceAmounts {
  total_repuestos: number;
  cantidad_materiales_repuestos: number; // Cantidad de items/elementos de repuestos
  mo_chapa_ut: number; // Unidades originales del PDF (UT o horas)
  mo_chapa_horas: number; // Siempre convertido a horas
  mo_chapa_eur: number;
  mo_pintura_ut: number; // Unidades originales del PDF (UT o horas)
  mo_pintura_horas: number; // Siempre convertido a horas
  mo_pintura_eur: number;
  materiales_pintura_eur: number;
  precio_por_hora_chapa: number; // Precio por hora de mano de obra de chapa
  precio_por_hora_pintura: number; // Precio por hora de mano de obra de pintura
  subtotal_sin_iva: number;
  porcentaje_iva: number;
  monto_iva: number;
  total_con_iva: number;
  // Metadatos sobre las unidades detectadas
  unidades_detectadas: 'UT' | 'HORAS' | 'MIXTO'; // Tipo de unidades encontradas en el PDF
}

export interface ExtractedData {
  vehicleData: VehicleData;
  insuranceAmounts: InsuranceAmounts;
  confidence: number; // Nivel de confianza de la extracción (0-1)
  warnings: string[]; // Advertencias sobre datos que podrían ser incorrectos
}

export interface ExtractionError {
  type: 'PARSING_ERROR' | 'API_ERROR' | 'VALIDATION_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN_ERROR';
  message: string;
  details?: any;
}

class PDFExtractionService {
  constructor() {}

  /**
   * Extrae datos estructurados de texto de un PDF de valoración pericial
   * @param pdfText - Texto extraído del PDF
   */
  async extractDataFromPDF(pdfText: string): Promise<ExtractedData> {
    console.log('🔍 PDFExtractionService: Iniciando extracción de datos');
    console.log('📄 Longitud del texto recibido:', pdfText?.length || 0);
    console.log('📄 Primeros 500 caracteres del texto:', pdfText?.substring(0, 500));
    
    // Usamos exclusivamente la función Edge segura de Supabase.

    if (!pdfText || pdfText.trim().length === 0) {
      console.error('❌ Texto del PDF vacío o no válido');
      throw this.createError('VALIDATION_ERROR', 'El texto del PDF está vacío');
    }

    try {
      console.log('🤖 Construyendo prompt para la IA...');
      const prompt = this.buildExtractionPrompt(pdfText);
      
      console.log('📡 Enviando solicitud a OpenAI...');
      const response = await this.callOpenAI(prompt);
      
      console.log('✅ Respuesta recibida de OpenAI');
      console.log('📋 Respuesta de la IA:', response);
      
      console.log('🔧 Parseando respuesta de la IA...');
      const result = this.parseAIResponse(response);
      
      console.log('✅ Datos extraídos exitosamente');
      console.log('📊 Nivel de confianza:', result.confidence);
      console.log('⚠️ Advertencias:', result.warnings);
      
      return result;
    } catch (error) {
      console.error('❌ Error durante la extracción:', error);
      if (error instanceof Error) {
        throw this.createError('API_ERROR', `Error al procesar PDF: ${error.message}`, error);
      }
      throw this.createError('UNKNOWN_ERROR', 'Error desconocido al procesar PDF');
    }
  }

  /**
   * Construye el prompt para la extracción de datos
   */
  private buildExtractionPrompt(pdfText: string): string {
    return `
Eres un experto en análisis de documentos de valoración pericial de vehículos. Tu tarea es extraer información específica de un PDF de valoración (Audatex, GT Motive, SilverDAT, etc.) y devolver los datos en formato JSON estructurado.

TEXTO DEL PDF:
${pdfText}

INSTRUCCIONES:
1. Extrae ÚNICAMENTE los datos solicitados
2. Si un dato no está disponible, usa null
3. Para importes monetarios, extrae solo el número (sin símbolos de moneda)
4. Para fechas, usa formato DD/MM/YYYY
5. Calcula el nivel de confianza basado en la claridad de los datos encontrados

DATOS A EXTRAER:

**DATOS DEL VEHÍCULO:**
- matricula: Matrícula del vehículo
- bastidor: Número de bastidor/chasis (puede aparecer como "NR CHASIS", "NÚMERO CHASIS", etc.)
- fabricante: Marca del vehículo (FORD, KIA, etc.)
- modelo: Modelo del vehículo (PUMA, PICANTO, etc.)
- referencia: Referencia del documento/valoración
- sistema: Sistema de valoración (AUDATEX, GT MOTIVE, SILVERDAT, etc.)
- precio_por_hora: Precio por hora unificado (usa el precio de chapa/mecánica como referencia)
- fecha_valoracion: Fecha de la valoración

**IMPORTES DE LA ASEGURADORA:**
- total_repuestos: Total de repuestos/piezas
- cantidad_materiales_repuestos: CUENTA la cantidad total de items/elementos de repuestos listados en el documento. Busca secciones como "REPUESTOS", "PIEZAS", "PIEZAS SUSTITUIDAS", "RECAMBIOS" y cuenta cada línea/item individual que aparezca listado. NO uses el valor monetario, sino el NÚMERO DE ELEMENTOS/ITEMS diferentes.
- mo_chapa_ut: Unidades de tiempo de mano de obra chapa (valor numérico exacto del PDF)
- mo_chapa_eur: Importe en euros de mano de obra chapa
- mo_pintura_ut: Unidades de tiempo de mano de obra pintura (valor numérico exacto del PDF)
- mo_pintura_eur: Importe en euros de mano de obra pintura
- materiales_pintura_eur: Importe de materiales de pintura
- precio_por_hora_chapa: Precio por hora de mano de obra de chapa/mecánica (busca en sección "Mano de obra")
- precio_por_hora_pintura: Precio por hora de mano de obra de pintura (busca en sección "Pintura")

🚨 **CRÍTICO - SUBTOTAL SIN IVA:** 🚨
- subtotal_sin_iva: ¡EXTREMADAMENTE IMPORTANTE! Busca específicamente el subtotal SIN IVA (base imponible).
  
  BUSCA ESTOS TÉRMINOS EXACTOS (en orden de prioridad):
  1. "SUMA TOTAL SIN IVA" / "TOTAL SIN IVA" / "SIN IVA"
  2. "BASE IMPONIBLE" / "BASE IMP."
  3. "SUBTOTAL" / "SUBTOTAL ANTES DE IMPUESTOS"
  4. "NETO" / "IMPORTE NETO"
  5. "SUMA TOTAL" (cuando aparece ANTES del IVA en el documento)
  
  VARIACIONES COMUNES:
  - "suma total con IVA y suma TOTAL" → usa "suma TOTAL"
  - "base imponible y total" → usa "base imponible"
  - "subtotal antes de impuestos y Importe Total Factura" → usa "subtotal antes de impuestos"
  
  REGLAS ESTRICTAS:
  - NUNCA calcules restando IVA del total
  - Debe ser el valor que aparece ANTES de sumar el IVA
  - Si hay múltiples subtotales, usa el que está más cerca del cálculo final de IVA
  Este valor es FUNDAMENTAL para los cálculos de rentabilidad.

- porcentaje_iva: Porcentaje de IVA aplicado. BUSCA:
  * "% IVA" / "IVA %" / "PORCENTAJE IVA"
  * Números seguidos de "%" cerca de la palabra IVA
  * Normalmente 21% en España, pero puede variar
  
- monto_iva: Cantidad de IVA en euros. BUSCA:
  * "IVA" seguido de un importe en euros
  * "IMPUESTO" / "IMPUESTOS"
  * El importe que se suma al subtotal para llegar al total
  
- total_con_iva: Total final incluyendo IVA. BUSCA:
  * "SUMA TOTAL CON IVA" / "TOTAL CON IVA"
  * "TOTAL" / "IMPORTE TOTAL FACTURA"
  * "TOTAL BRUTO" / "IMPORTE FINAL"
  * El valor más alto que aparece al final del documento
- unidades_detectadas: Tipo de unidades encontradas ("UT" si aparece "UT" o "Unidades de Tiempo", "HORAS" si aparece "horas", "hr", "h.", "MIXTO" si aparecen ambos)

RESPONDE ÚNICAMENTE CON UN JSON VÁLIDO EN ESTE FORMATO:
{
  "vehicleData": {
    "matricula": "string",
    "bastidor": "string",
    "fabricante": "string",
    "modelo": "string",
    "referencia": "string",
    "sistema": "string",
    "precio_por_hora": number,
    "fecha_valoracion": "string"
  },
  "insuranceAmounts": {
    "total_repuestos": number,
    "cantidad_materiales_repuestos": number,
    "mo_chapa_ut": number,
    "mo_chapa_eur": number,
    "mo_pintura_ut": number,
    "mo_pintura_eur": number,
    "materiales_pintura_eur": number,
    "precio_por_hora_chapa": number,
    "precio_por_hora_pintura": number,
    "subtotal_sin_iva": number,
    "porcentaje_iva": number,
    "monto_iva": number,
    "total_con_iva": number,
    "unidades_detectadas": "UT" | "HORAS" | "MIXTO"
  },
  "confidence": number,
  "warnings": ["string"]
}

IMPORTANTE: 
- confidence debe ser un número entre 0 y 1 (ej: 0.95 para alta confianza)
- warnings debe incluir cualquier incertidumbre sobre los datos extraídos
- NO incluyas texto adicional, solo el JSON

**ESTRATEGIA DE BÚSQUEDA EN EL TEXTO:**
    1. Busca la sección final del documento donde aparecen los totales
    2. Identifica líneas que contengan "SUMA TOTAL", "TOTAL", "SUBTOTAL", "BASE IMPONIBLE"
    3. Busca números con formato europeo (ej: 2.710,23 o 2710,23)
    4. Identifica la secuencia: Subtotal → IVA → Total final
    
    **EJEMPLO DE EXTRACCIÓN CORRECTA (basado en documento AUDATEX):**
    En el documento encontrarás algo como:
    "SUMA TOTAL SIN IVA Euros 2.710,23"
    "21 % IVA Euros 569,15" 
    "SUMA TOTAL CON IVA Euros 3.279,38"
    
    Debes extraer:
    - subtotal_sin_iva: 2710.23
    - porcentaje_iva: 21
    - monto_iva: 569.15
    - total_con_iva: 3279.38
    
    **PATRONES DE TEXTO A BUSCAR:**
    - Para subtotal: "SIN IVA.*([0-9.,]+)" o "BASE IMPONIBLE.*([0-9.,]+)"
    - Para IVA%: "([0-9]+).*%.*IVA" o "IVA.*([0-9]+).*%"
    - Para monto IVA: "IVA.*([0-9.,]+)" (el número que NO es porcentaje)
    - Para total: "CON IVA.*([0-9.,]+)" o "TOTAL.*([0-9.,]+)" (el más alto)

🚨 VALIDACIÓN MATEMÁTICA CRÍTICA: 🚨
Antes de responder, VERIFICA que:
1. subtotal_sin_iva + monto_iva = total_con_iva (con tolerancia de ±0.01€)
2. monto_iva = subtotal_sin_iva × (porcentaje_iva / 100) (con tolerancia de ±0.01€)
3. Si estos cálculos no cuadran, revisa los valores extraídos y añade una advertencia en "warnings"
4. NUNCA calcules subtotal_sin_iva restando IVA del total - esto es matemáticamente incorrecto
5. El subtotal_sin_iva debe ser SIEMPRE el valor explícito que aparece en el documento como "SIN IVA" o "BASE IMPONIBLE"
6. Si encuentras múltiples totales, usa los que aparecen en la sección final de resumen
`;
  }

  /**
   * Llama a la API de OpenAI
   */
  private async callOpenAI(prompt: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('openai-chat', {
      body: {
        model: 'gpt-4o',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }
    });

    if (error) {
      throw error;
    }

    if (!data?.choices || !data.choices[0]?.message?.content) {
      throw new Error('Respuesta inválida de OpenAI (Edge Function)');
    }

    return data.choices[0].message.content as string;
  }

  /**
   * Parsea la respuesta de la IA y valida los datos
   */
  private parseAIResponse(aiResponse: string): ExtractedData {
    try {
      // Limpiar la respuesta para extraer solo el JSON
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se encontró JSON válido en la respuesta de la IA');
      }

      const parsedData = JSON.parse(jsonMatch[0]);
      
      // Validar estructura básica
      if (!parsedData.vehicleData || !parsedData.insuranceAmounts) {
        throw new Error('Estructura de datos inválida en la respuesta');
      }

      // Validar y limpiar datos
      const extractedData: ExtractedData = {
        vehicleData: this.validateVehicleData(parsedData.vehicleData),
        insuranceAmounts: this.validateInsuranceAmounts(parsedData.insuranceAmounts),
        confidence: Math.max(0, Math.min(1, parsedData.confidence || 0.5)),
        warnings: Array.isArray(parsedData.warnings) ? parsedData.warnings : []
      };

      return extractedData;
    } catch (error) {
      throw this.createError('PARSING_ERROR', `Error al parsear respuesta de IA: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Valida y limpia los datos del vehículo
   */
  private validateVehicleData(data: any): VehicleData {
    return {
      matricula: this.cleanString(data.matricula),
      bastidor: this.cleanString(data.bastidor),
      fabricante: this.cleanString(data.fabricante),
      modelo: this.cleanString(data.modelo),
      referencia: this.cleanString(data.referencia),
      sistema: this.cleanString(data.sistema),
      precio_por_hora: this.cleanNumber(data.precio_por_hora),
      fecha_valoracion: this.cleanString(data.fecha_valoracion)
    };
  }

  /**
   * Valida y limpia los importes de la aseguradora
   */
  private validateInsuranceAmounts(data: any): InsuranceAmounts {
    const mo_chapa_ut = this.cleanNumber(data.mo_chapa_ut);
    const mo_pintura_ut = this.cleanNumber(data.mo_pintura_ut);
    
    // Detectar tipo de unidades basado en los datos del PDF
    const unidades_detectadas = this.detectUnidadesTiempo(data);
    
    // Convertir a horas según el tipo detectado
    const mo_chapa_horas = this.convertirAHoras(mo_chapa_ut, unidades_detectadas);
    const mo_pintura_horas = this.convertirAHoras(mo_pintura_ut, unidades_detectadas);
    
    return {
      total_repuestos: this.cleanNumber(data.total_repuestos),
      cantidad_materiales_repuestos: this.cleanNumber(data.cantidad_materiales_repuestos),
      mo_chapa_ut,
      mo_chapa_horas,
      mo_chapa_eur: this.cleanNumber(data.mo_chapa_eur),
      mo_pintura_ut,
      mo_pintura_horas,
      mo_pintura_eur: this.cleanNumber(data.mo_pintura_eur),
      materiales_pintura_eur: this.cleanNumber(data.materiales_pintura_eur),
      precio_por_hora_chapa: this.cleanNumber(data.precio_por_hora_chapa),
      precio_por_hora_pintura: this.cleanNumber(data.precio_por_hora_pintura),
      subtotal_sin_iva: this.cleanNumber(data.subtotal_sin_iva),
      porcentaje_iva: this.cleanNumber(data.porcentaje_iva),
      monto_iva: this.cleanNumber(data.monto_iva),
      total_con_iva: this.cleanNumber(data.total_con_iva),
      unidades_detectadas
    };
  }

  /**
   * Detecta el tipo de unidades de tiempo en los datos extraídos
   */
  private detectUnidadesTiempo(data: any): 'UT' | 'HORAS' | 'MIXTO' {
    // Buscar indicadores en los datos originales
    const textoCompleto = JSON.stringify(data).toLowerCase();
    
    const tieneUT = textoCompleto.includes('ut') || textoCompleto.includes('unidades de tiempo');
    const tieneHoras = textoCompleto.includes('hora') || textoCompleto.includes('hr') || textoCompleto.includes('h.');
    
    // Si hay información específica sobre unidades en los metadatos
    if (data.unidades_detectadas) {
      return data.unidades_detectadas;
    }
    
    // Detectar basado en patrones comunes
    if (tieneUT && tieneHoras) {
      return 'MIXTO';
    } else if (tieneUT) {
      return 'UT';
    } else if (tieneHoras) {
      return 'HORAS';
    }
    
    // Por defecto, asumir UT si no se puede determinar (es más común en PDFs de aseguradoras)
    return 'UT';
  }

  /**
   * Convierte unidades de tiempo a horas
   * @param valor - Valor numérico de tiempo
   * @param tipoUnidad - Tipo de unidad detectada
   * @returns Valor convertido a horas
   */
  private convertirAHoras(valor: number, tipoUnidad: 'UT' | 'HORAS' | 'MIXTO'): number {
    if (valor === 0) return 0;
    
    switch (tipoUnidad) {
      case 'UT':
        // 10 UT = 1 hora
        return Math.round((valor / 10) * 100) / 100; // Redondear a 2 decimales
      case 'HORAS':
        return valor; // Ya está en horas
      case 'MIXTO':
        // En caso mixto, asumir UT por seguridad y mostrar advertencia
        console.warn('⚠️ Unidades mixtas detectadas, asumiendo UT para conversión');
        return Math.round((valor / 10) * 100) / 100;
      default:
        return valor;
    }
  }

  /**
   * Limpia y valida strings
   */
  private cleanString(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  /**
   * Limpia y valida números
   */
  private cleanNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    const num = parseFloat(String(value).replace(/[^\d.-]/g, ''));
    return isNaN(num) ? 0 : num;
  }

  /**
   * Crea un error tipado
   */
  private createError(type: ExtractionError['type'], message: string, details?: any): ExtractionError {
    return { type, message, details };
  }

  /**
   * Verifica si el servicio está configurado correctamente
   */
  isConfigured(): boolean {
    return true;
  }

  /**
   * Método para probar la extracción con datos de ejemplo
   */
  async testExtraction(): Promise<ExtractedData> {
    const testPdfText = `
FORD PUMA 6453MLT
WF02XXERK2PJ11480
REFERENCIA: 103889801331
AUDATEX
PRECIO HORA: 51,90
FECHA: 04/10/2024

REPUESTOS:
- Parachoques delantero: 450,00 EUR
- Faro delantero izquierdo: 320,50 EUR
- Rejilla delantera: 180,25 EUR
- Moldura lateral derecha: 125,80 EUR
- Retrovisor exterior derecho: 95,40 EUR
- Piloto trasero izquierdo: 210,75 EUR
- Emblema trasero: 45,22 EUR
- Tornillería varia: 25,00 EUR
- Clips de fijación: 15,90 EUR
- Junta parachoques: 35,50 EUR
- Soporte faro: 78,60 EUR
- Cable conexión piloto: 42,30 EUR
- Goma protección: 18,85 EUR
- Arandela especial: 8,95 EUR
- Tuerca M8: 12,40 EUR
- Grapa sujeción: 6,75 EUR
- Tapón goma: 4,20 EUR
- Aislante térmico: 22,15 EUR
- Conector eléctrico: 35,80 EUR
- Abrazadera metálica: 14,50 EUR

TOTAL REPUESTOS: 1782,92 EUR

M.O. CHAPA: 18 UT - 679,89 EUR
M.O. PINTURA: 10 UT - 272,48 EUR
MATERIALES PINTURA: 213,20 EUR
SUBTOTAL SIN IVA: 2948,49 EUR
IVA 21%: 619,18 EUR
TOTAL CON IVA: 3567,67 EUR
    `;
    
    console.log('🧪 Probando extracción con conversión UT a horas y conteo de repuestos...');
    const result = await this.extractDataFromPDF(testPdfText);
    console.log('📊 Resultado de prueba:');
    console.log('- M.O. Chapa: 18 UT =', result.insuranceAmounts.mo_chapa_horas, 'horas');
    console.log('- M.O. Pintura: 10 UT =', result.insuranceAmounts.mo_pintura_horas, 'horas');
    console.log('- Cantidad de repuestos:', result.insuranceAmounts.cantidad_materiales_repuestos, 'items');
    console.log('- Unidades detectadas:', result.insuranceAmounts.unidades_detectadas);
    
    return result;
  }
}

// Instancia singleton del servicio
export const pdfExtractionService = new PDFExtractionService();

// Función helper para usar en componentes
export async function extractPDFData(pdfText: string): Promise<ExtractedData> {
  return pdfExtractionService.extractDataFromPDF(pdfText);
}

// Función para verificar configuración
export function isPDFExtractionConfigured(): boolean {
  return pdfExtractionService.isConfigured();
}