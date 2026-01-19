import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

// Extend the ImportMeta interface to include env
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

const DebugSupabase: React.FC = () => {
  const [results, setResults] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const testConnection = async () => {
    setLoading(true);
    const testResults: any = {};

    try {
      // Test 1: Verificar autenticación
      console.log('🔍 Test 1: Verificando autenticación...');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      testResults.auth = {
        success: !authError && !!user,
        user: user?.email,
        error: authError?.message
      };
      console.log('Auth result:', testResults.auth);

      // Test 2: Verificar sesión
      console.log('🔍 Test 2: Verificando sesión...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      testResults.session = {
        success: !sessionError && !!session,
        hasSession: !!session,
        error: sessionError?.message
      };
      console.log('Session result:', testResults.session);

      // Test 3: Probar consulta simple a profiles
      console.log('🔍 Test 3: Probando consulta a profiles...');
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);
      
      testResults.profiles = {
        success: !profilesError,
        data: profilesData,
        error: profilesError?.message,
        details: profilesError
      };
      console.log('Profiles result:', testResults.profiles);

      // Test 4: Probar consulta simple a workshops
      console.log('🔍 Test 4: Probando consulta a workshops...');
      const { data: workshopsData, error: workshopsError } = await supabase
        .from('workshops')
        .select('id')
        .limit(1);
      
      testResults.workshops = {
        success: !workshopsError,
        data: workshopsData,
        error: workshopsError?.message,
        details: workshopsError
      };
      console.log('Workshops result:', testResults.workshops);

      // Test 5: Probar consulta simple a analysis
      console.log('🔍 Test 5: Probando consulta a analysis...');
      const { data: analysisData, error: analysisError } = await supabase
        .from('analysis')
        .select('id')
        .limit(1);
      
      testResults.analysis = {
        success: !analysisError,
        data: analysisData,
        error: analysisError?.message,
        details: analysisError
      };
      console.log('Analysis result:', testResults.analysis);

      // Test 6: Verificar configuración de Supabase
      console.log('🔍 Test 6: Verificando configuración...');
      testResults.config = {
        url: import.meta.env.VITE_SUPABASE_URL,
        hasKey: !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        keyLength: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.length
      };
      console.log('Config result:', testResults.config);

    } catch (error) {
      console.error('💥 Error en las pruebas:', error);
      // Proper error type handling
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      testResults.generalError = {
        message: errorMessage,
        details: error
      };
    }

    setResults(testResults);
    setLoading(false);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">🔧 Diagnóstico de Supabase</h2>
      
      <button
        onClick={testConnection}
        disabled={loading}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? 'Ejecutando pruebas...' : 'Ejecutar Diagnóstico'}
      </button>

      {Object.keys(results).length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Resultados:</h3>
          
          {results.auth && (
            <div className="p-3 border rounded">
              <h4 className="font-medium">🔐 Autenticación</h4>
              <p className={results.auth.success ? 'text-green-600' : 'text-red-600'}>
                {results.auth.success ? '✅ Exitosa' : '❌ Fallida'}
              </p>
              {results.auth.user && <p>Usuario: {results.auth.user}</p>}
              {results.auth.error && <p className="text-red-500">Error: {results.auth.error}</p>}
            </div>
          )}

          {results.session && (
            <div className="p-3 border rounded">
              <h4 className="font-medium">📋 Sesión</h4>
              <p className={results.session.success ? 'text-green-600' : 'text-red-600'}>
                {results.session.success ? '✅ Válida' : '❌ Inválida'}
              </p>
              {results.session.error && <p className="text-red-500">Error: {results.session.error}</p>}
            </div>
          )}

          {results.profiles && (
            <div className="p-3 border rounded">
              <h4 className="font-medium">👥 Tabla Profiles</h4>
              <p className={results.profiles.success ? 'text-green-600' : 'text-red-600'}>
                {results.profiles.success ? '✅ Accesible' : '❌ Error'}
              </p>
              {results.profiles.error && <p className="text-red-500">Error: {results.profiles.error}</p>}
              {results.profiles.details && (
                <pre className="text-xs bg-gray-100 p-2 mt-2 overflow-auto">
                  {JSON.stringify(results.profiles.details, null, 2)}
                </pre>
              )}
            </div>
          )}

          {results.workshops && (
            <div className="p-3 border rounded">
              <h4 className="font-medium">🏭 Tabla Workshops</h4>
              <p className={results.workshops.success ? 'text-green-600' : 'text-red-600'}>
                {results.workshops.success ? '✅ Accesible' : '❌ Error'}
              </p>
              {results.workshops.error && <p className="text-red-500">Error: {results.workshops.error}</p>}
              {results.workshops.details && (
                <pre className="text-xs bg-gray-100 p-2 mt-2 overflow-auto">
                  {JSON.stringify(results.workshops.details, null, 2)}
                </pre>
              )}
            </div>
          )}

          {results.analysis && (
            <div className="p-3 border rounded">
              <h4 className="font-medium">📊 Tabla Analysis</h4>
              <p className={results.analysis.success ? 'text-green-600' : 'text-red-600'}>
                {results.analysis.success ? '✅ Accesible' : '❌ Error'}
              </p>
              {results.analysis.error && <p className="text-red-500">Error: {results.analysis.error}</p>}
              {results.analysis.details && (
                <pre className="text-xs bg-gray-100 p-2 mt-2 overflow-auto">
                  {JSON.stringify(results.analysis.details, null, 2)}
                </pre>
              )}
            </div>
          )}

          {results.config && (
            <div className="p-3 border rounded">
              <h4 className="font-medium">⚙️ Configuración</h4>
              <p>URL: {results.config.url}</p>
              <p>Tiene Key: {results.config.hasKey ? '✅' : '❌'}</p>
              <p>Longitud Key: {results.config.keyLength}</p>
            </div>
          )}

          {results.generalError && (
            <div className="p-3 border rounded bg-red-50">
              <h4 className="font-medium text-red-700">💥 Error General</h4>
              <p className="text-red-600">Mensaje: {results.generalError.message}</p>
              <pre className="text-xs bg-red-100 p-2 mt-2 overflow-auto">
                {JSON.stringify(results.generalError.details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DebugSupabase;