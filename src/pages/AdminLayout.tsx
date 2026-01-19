import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Shield, 
  Users, 
  Building2, 
  BarChart3, 
  Settings, 
  LogOut,
  Menu,
  X,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const AdminLayout = () => {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login");
  };

  const navigation = [
    {
      name: "Dashboard",
      href: "/admin/dashboard",
      icon: BarChart3,
      current: location.pathname === "/admin/dashboard"
    },
    {
      name: "Usuarios",
      href: "/admin/users",
      icon: Users,
      current: location.pathname === "/admin/users"
    },
    {
      name: "Talleres",
      href: "/admin/workshops",
      icon: Building2,
      current: location.pathname === "/admin/workshops"
    },
    {
      name: "Análisis",
      href: "/admin/analisis",
      icon: FileText,
      current: location.pathname === "/admin/analisis"
    },
    {
      name: "Configuración",
      href: "/admin/settings",
      icon: Settings,
      current: location.pathname === "/admin/settings"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar para móvil */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-primary">
            <div className="flex h-16 items-center justify-between px-4">
              <div className="flex items-center">
                <Shield className="h-8 w-8 text-primary-foreground" />
                <span className="ml-2 text-lg font-semibold text-primary-foreground">Admin Panel</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-primary-foreground hover:text-primary-foreground/80"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 px-2 py-4">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                      item.current
                        ? "bg-primary/80 text-primary-foreground"
                        : "text-primary-foreground/80 hover:bg-primary/60 hover:text-primary-foreground"
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Sidebar para desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-primary pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4">
            <Shield className="h-8 w-8 text-primary-foreground" />
            <span className="ml-2 text-lg font-semibold text-primary-foreground">Valora Plus Admin</span>
          </div>
          <nav className="mt-8 flex-1 flex flex-col divide-y divide-primary/40 overflow-y-auto">
            <div className="px-2 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                      item.current
                        ? "bg-primary/80 text-primary-foreground"
                        : "text-primary-foreground/80 hover:bg-primary/60 hover:text-primary-foreground"
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Header */}
        <div className="sticky top-0 z-40 flex h-16 flex-shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Separador */}
          <div className="h-6 w-px bg-gray-200 lg:hidden" />

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1 items-center">
              <h1 className="text-lg font-semibold text-gray-900">
                Panel de Administración
              </h1>
            </div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* Información del usuario */}
              <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200" />
              <div className="flex items-center gap-x-4">
                <div className="text-sm text-gray-700">
                  <span className="font-medium">{profile?.full_name || profile?.email}</span>
                  <div className="text-xs text-primary font-medium">Administrador</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  className="text-primary border-primary hover:bg-primary-soft"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Cerrar Sesión
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Contenido de la página */}
        <main className="flex-1">
          <div className="py-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;