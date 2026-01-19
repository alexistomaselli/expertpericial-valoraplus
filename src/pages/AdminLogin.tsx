import { Shield, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AdminLoginForm } from "@/components/auth/AdminLoginForm";
import { useAuth } from "@/contexts/AuthContext";

const AdminLogin = () => {
  const { session, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  // Redirigir si el usuario ya está autenticado como admin
  useEffect(() => {
    if (!loading && session && profile) {
      if (profile.role === 'admin') {
        navigate("/admin/dashboard", { replace: true });
      }
      // No hacer logout automático aquí - AdminLoginForm se encarga de la verificación
    }
  }, [session, profile, loading, navigate]);

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-600"></div>
      </div>
    );
  }

  // Si hay sesión de admin, no mostrar nada (se está redirigiendo)
  if (session && profile?.role === 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link 
            to="/" 
            className="inline-flex items-center text-red-700 hover:text-red-800 transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al inicio
          </Link>
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Shield className="h-8 w-8 text-red-600" />
            <span className="text-2xl font-bold text-red-600">Valora Plus</span>
          </div>
          <div className="bg-red-600 text-white px-4 py-2 rounded-lg inline-block mb-2">
            <span className="text-sm font-semibold">PANEL DE ADMINISTRACIÓN</span>
          </div>
          <p className="text-red-700/80 text-sm">
            Acceso exclusivo para administradores del sistema
          </p>
        </div>
        
        <AdminLoginForm />
        
        {/* Footer de seguridad */}
        <div className="mt-8 text-center">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-yellow-800 text-xs">
              <Shield className="h-3 w-3 inline mr-1" />
              Área restringida. Todos los accesos son monitoreados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;