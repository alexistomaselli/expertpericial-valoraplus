import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Shield } from "lucide-react";

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

export function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-red-600 mx-auto mb-4" />
          <p className="text-red-700 font-medium">Verificando permisos de administrador...</p>
        </div>
      </div>
    );
  }

  // Si no hay sesión, redirigir al login de admin
  if (!session) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // Si hay sesión pero no hay perfil aún, mostrar loading
  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-red-600 mx-auto mb-4" />
          <p className="text-red-700 font-medium">Cargando perfil de usuario...</p>
        </div>
      </div>
    );
  }

  // Si el usuario no es administrador, mostrar acceso denegado
  if (profile.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center border-2 border-red-200">
          <Shield className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-600 mb-2">Acceso Denegado</h1>
          <p className="text-gray-600 mb-6">
            No tienes permisos para acceder al panel de administración.
          </p>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Rol actual: <span className="font-medium">{profile.role}</span>
            </p>
            <p className="text-sm text-gray-500">
              Se requiere rol: <span className="font-medium text-red-600">admin</span>
            </p>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-200">
            <a 
              href="/admin/login" 
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Ir al Login de Admin
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Si todo está bien, mostrar el contenido protegido
  return <>{children}</>;
}