import { Calculator, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { useAuth } from "@/contexts/AuthContext";

const Login = () => {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  // Redirigir a dashboard si el usuario ya está autenticado
  useEffect(() => {
    if (!loading && session) {
      navigate("/app/micuenta", { replace: true });
    }
  }, [session, loading, navigate]);

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
      </div>
    );
  }

  // Si hay sesión, no mostrar nada (se está redirigiendo)
  if (session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center text-primary-foreground hover:text-primary-foreground/80 transition-colors mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al inicio
          </Link>
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Calculator className="h-8 w-8 text-primary-foreground" />
            <span className="text-2xl font-bold text-primary-foreground">Valora Plus</span>
          </div>
          <p className="text-primary-foreground/80">Accede para empezar tu análisis gratuito</p>
        </div>
        
        <LoginForm />
      </div>
    </div>
  );
};

export default Login;