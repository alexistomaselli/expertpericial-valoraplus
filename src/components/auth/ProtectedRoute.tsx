import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute = ({ 
  children, 
  allowedRoles = ['admin_mechanic', 'admin', 'mechanic']
}: ProtectedRouteProps) => {
  const { user, profile, loading: isLoading } = useAuth();
  const [authTimeout, setAuthTimeout] = useState(false);
  const location = useLocation();

  // Establecer un tiempo máximo para la carga
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        console.log('⏰ ProtectedRoute: Timeout alcanzado después de 15 segundos');
        setAuthTimeout(true);
      }
    }, 15000); // 15 segundos máximo de espera

    return () => clearTimeout(timer);
  }, [isLoading]);

  console.log('🛡️ ProtectedRoute: Estado actual:', {
    user: !!user,
    profile: !!profile,
    isLoading,
    isAuthenticated: !!user && !!profile,
    authTimeout
  });

  // Si está cargando y no ha expirado el tiempo, mostrar un indicador de carga
  if (isLoading && !authTimeout) {
    console.log('🛡️ ProtectedRoute: Mostrando indicador de carga');
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Cargando información del usuario...</p>
        </div>
      </div>
    );
  }

  // Si hay usuario autenticado, mostrar el contenido protegido
  if (user && profile) {
    console.log('🛡️ ProtectedRoute: Usuario autenticado, verificando permisos');
    
    // Si hay roles permitidos y el usuario no tiene uno de esos roles, redirigir a página no autorizada
    if (allowedRoles.length > 0 && profile && !allowedRoles.includes(profile.role)) {
      console.log('🛡️ ProtectedRoute: Usuario sin permisos, redirigiendo a unauthorized');
      return <Navigate to="/unauthorized" />;
    }
    
    // Si todo está bien, mostrar el contenido protegido
    console.log('🛡️ ProtectedRoute: Mostrando contenido protegido');
    return <>{children}</>;
  }

  // Si no está autenticado o ha expirado el tiempo, redirigir al login
  console.log('🛡️ ProtectedRoute: Redirigiendo al login - no autenticado o timeout');
  
  // Guardar la ubicación actual para redirigir después del login
  const currentPath = location.pathname;
  sessionStorage.setItem('redirectAfterLogin', currentPath);
  
  return <Navigate to="/login" />;
};