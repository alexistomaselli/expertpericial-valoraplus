import { useState, useCallback } from 'react';
import { extractPDFData, ExtractedData, ExtractionError, isPDFExtractionConfigured } from '../services/pdfExtractionService';

interface UsePDFExtractionState {
  isExtracting: boolean;
  extractedData: ExtractedData | null;
  error: ExtractionError | null;
  isConfigured: boolean;
}

interface UsePDFExtractionReturn extends UsePDFExtractionState {
  extractData: (pdfText: string) => Promise<ExtractedData | null>;
  clearData: () => void;
  clearError: () => void;
}

/**
 * Hook personalizado para manejar la extracción de datos de PDFs
 */
export function usePDFExtraction(): UsePDFExtractionReturn {
  const [state, setState] = useState<UsePDFExtractionState>({
    isExtracting: false,
    extractedData: null,
    error: null,
    isConfigured: isPDFExtractionConfigured()
  });

  /**
   * Extrae datos de un texto de PDF
   */
  const extractData = useCallback(async (pdfText: string): Promise<ExtractedData | null> => {
    if (!state.isConfigured) {
      const configError: ExtractionError = {
        type: 'API_ERROR',
        message: 'El servicio de extracción no está configurado. Verifica la API key de OpenAI.'
      };
      setState(prev => ({ ...prev, error: configError }));
      return null;
    }

    setState(prev => ({ 
      ...prev, 
      isExtracting: true, 
      error: null,
      extractedData: null 
    }));

    try {
      const data = await extractPDFData(pdfText);
      
      setState(prev => ({ 
        ...prev, 
        isExtracting: false, 
        extractedData: data 
      }));
      
      return data;
    } catch (error) {
      const extractionError: ExtractionError = error as ExtractionError;
      
      setState(prev => ({ 
        ...prev, 
        isExtracting: false, 
        error: extractionError 
      }));
      
      return null;
    }
  }, [state.isConfigured]);

  /**
   * Limpia los datos extraídos
   */
  const clearData = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      extractedData: null 
    }));
  }, []);

  /**
   * Limpia el error
   */
  const clearError = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      error: null 
    }));
  }, []);

  return {
    ...state,
    extractData,
    clearData,
    clearError
  };
}

/**
 * Hook simplificado para casos donde solo necesitas extraer datos una vez
 */
export function useSimplePDFExtraction() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extract = useCallback(async (pdfText: string): Promise<ExtractedData | null> => {
    if (!isPDFExtractionConfigured()) {
      setError('Servicio de extracción no configurado');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await extractPDFData(pdfText);
      setIsLoading(false);
      return data;
    } catch (err) {
      const extractionError = err as ExtractionError;
      setError(extractionError.message);
      setIsLoading(false);
      return null;
    }
  }, []);

  return {
    extract,
    isLoading,
    error,
    clearError: () => setError(null)
  };
}