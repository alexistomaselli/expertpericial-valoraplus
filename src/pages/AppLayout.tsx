import { Outlet, useNavigate } from "react-router-dom";
import { Calculator, BarChart3, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserAccountDropdown } from "@/components/UserAccountDropdown";
import { useEffect } from "react";

const AppLayout = () => {
  const { session, loading, profile } = useAuth();
  const navigate = useNavigate();

  // Redirigir a login si no hay sesión
  useEffect(() => {
    if (!loading && !session) {
      navigate('/login', { replace: true });
    }
  }, [session, loading, navigate]);
  
  return (
    <div className="min-h-screen bg-background">
      {/* App Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to={profile?.role === 'admin' ? '/admin/dashboard' : '/'} className="flex items-center space-x-2">
            <Calculator className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold text-foreground">Valora Plus</span>
          </Link>
          
          <div className="flex items-center">
            <UserAccountDropdown />
          </div>
        </div>
      </header>

      {/* App Navigation */}
      <nav className="border-b bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex space-x-8 py-3">
            <Link 
              to="/app/nuevo" 
              className="flex items-center space-x-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Calculator className="h-4 w-4" />
              <span>Nuevo Análisis</span>
            </Link>
            <Link 
              to="/app/micuenta" 
              className="flex items-center space-x-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <BarChart3 className="h-4 w-4" />
              <span>Mi Cuenta</span>
            </Link>
            <Link 
              to="/app/historial-pagos" 
              className="flex items-center space-x-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <CreditCard className="h-4 w-4" />
              <span>Historial de Pagos</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;