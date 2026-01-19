import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { isPDFExtractionConfigured, pdfExtractionService } from '@/services/pdfExtractionService';

export function DebugOpenAI() {
  const [testResult, setTestResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const runDiagnostics = async () => {
    setIsLoading(true);
    setTestResult(null);

    try {
      const diagnostics = {
        // Verificar configuración del servicio
        isServiceConfigured: isPDFExtractionConfigured(),
        
        // Variables de entorno relevantes
        envVars: {
          VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? 'Configurada' : 'No configurada',
          NODE_ENV: import.meta.env.NODE_ENV || 'N/A',
          MODE: import.meta.env.MODE || 'N/A',
        }
      };

      console.log('🔍 Diagnósticos OpenAI:', diagnostics);
      setTestResult({ ...diagnostics, type: 'diagnostics' });

    } catch (error) {
      console.error('❌ Error en diagnósticos:', error);
      setTestResult({ 
        error: error instanceof Error ? error.message : 'Error desconocido',
        type: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testExtraction = async () => {
    setIsLoading(true);
    setTestResult(null);

    try {
      console.log('🧪 Iniciando test de extracción...');
      const result = await pdfExtractionService.testExtraction();
      console.log('✅ Test de extracción exitoso:', result);
      setTestResult({ ...result, type: 'extraction_test' });
    } catch (error) {
      console.error('❌ Error en test de extracción:', error);
      setTestResult({ 
        error: error instanceof Error ? error.message : 'Error desconocido',
        type: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔧 Debug Servicio de IA (Edge)
          <Badge variant={isPDFExtractionConfigured() ? "default" : "destructive"}>
            {isPDFExtractionConfigured() ? "Configurado" : "No Configurado"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={runDiagnostics} 
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? "Ejecutando..." : "Ejecutar Diagnósticos"}
          </Button>
          <Button 
            onClick={testExtraction} 
            disabled={isLoading || !isPDFExtractionConfigured()}
            variant="default"
          >
            {isLoading ? "Probando..." : "Test de Extracción"}
          </Button>
        </div>

        {testResult && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Resultado:</h3>
            <pre className="text-sm overflow-auto max-h-96 bg-white p-3 rounded border">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-blue-800 mb-2">Información de Debug:</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p><strong>Servicio configurado:</strong> {isPDFExtractionConfigured() ? "✅ Sí" : "❌ No"}</p>
            <p><strong>Entorno:</strong> {import.meta.env.MODE}</p>
            <p><strong>URL actual:</strong> {window.location.origin}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}