import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Calculator, FileText, TrendingUp, Users, Shield, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserAccountDropdown } from "@/components/UserAccountDropdown";
import heroImage from "@/assets/hero-analytics.jpg";

const Index = () => {
  const { user, profile } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to={profile?.role === 'admin' ? '/admin/dashboard' : '/'} className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <Calculator className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">Valora Plus Analytics</span>
          </Link>
          <div className="flex items-center space-x-4">
            {user ? (
              // Mostrar dropdown cuando el usuario está logueado
              <UserAccountDropdown />
            ) : (
              // Mostrar botones de login/registro cuando no está logueado
              <>
                <Link to="/login">
                  <Button variant="outline">Iniciar Sesión</Button>
                </Link>
                <Link to="/register">
                  <Button className="bg-gradient-primary text-primary-foreground shadow-glow hover:shadow-lg transition-all duration-300">
                    Probar Gratis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-90"></div>
        <div className="relative container mx-auto px-4 py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <Badge className="mb-6 bg-primary-soft text-primary border-primary/20">
                ¡3 análisis gratuitos al mes!
              </Badge>
              <h1 className="text-4xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
                Calcula la <span className="bg-gradient-primary bg-clip-text text-transparent">rentabilidad real</span> de tu taller
              </h1>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                Compara los importes de las aseguradoras con tus costes reales. 
                Sube PDFs de Audatex, GT o Solera y obtén informes detallados de rentabilidad al instante.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                {user ? (
                  // Si el usuario está logueado, mostrar botón para ir a la app
                  <Link to="/app/nuevo">
                    <Button size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow hover:shadow-lg transition-all duration-300">
                      Crear Nuevo Análisis
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                ) : (
                  // Si no está logueado, mostrar botón de registro
                  <Link to="/register">
                    <Button size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow hover:shadow-lg transition-all duration-300 animate-pulse-glow">
                      Empezar Análisis Gratis
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                )}
                <Button size="lg" variant="outline" className="border-primary/20 hover:bg-primary-soft">
                  Ver Demo
                </Button>
              </div>
            </div>
            <div className="relative">
              <img 
                src={heroImage} 
                alt="Analytics Dashboard" 
                className="rounded-2xl shadow-elegant w-full h-auto"
              />
              <div className="absolute -top-4 -right-4 bg-success text-success-foreground px-4 py-2 rounded-full font-semibold shadow-lg">
                +37% Margen
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Todo lo que necesitas para optimizar tu rentabilidad
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Análisis completo de márgenes por expediente con datos reales de tu taller
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <FileText className="h-8 w-8" />,
                title: "Parseo Automático de PDFs",
                description: "Sube valoraciones de Audatex, GT o Solera y extrae automáticamente todos los datos",
                color: "text-primary"
              },
              {
                icon: <Calculator className="h-8 w-8" />,
                title: "Cálculo de Rentabilidad",
                description: "Compara ingresos vs costes reales con márgenes detallados por bloque de trabajo",
                color: "text-success"
              },
              {
                icon: <TrendingUp className="h-8 w-8" />,
                title: "Informes Detallados",
                description: "Genera PDFs profesionales con análisis completo y envío automático por email",
                color: "text-warning"
              },
              {
                icon: <Users className="h-8 w-8" />,
                title: "Control de Uso",
                description: "3 análisis gratuitos por mes con contador transparente de uso",
                color: "text-primary"
              },
              {
                icon: <Shield className="h-8 w-8" />,
                title: "Datos Seguros",
                description: "Cumplimiento RGPD con borrado automático de documentos sensibles",
                color: "text-success"
              },
              {
                icon: <Zap className="h-8 w-8" />,
                title: "Integración Bitrix24",
                description: "Preparado para integrarse con tu CRM existente mediante API",
                color: "text-warning"
              }
            ].map((feature, index) => (
              <Card key={index} className="bg-gradient-card border-border/50 hover:shadow-elegant transition-all duration-300 group">
                <CardContent className="p-6">
                  <div className={`${feature.color} mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="bg-gradient-primary rounded-3xl p-12 text-center text-primary-foreground">
            <h2 className="text-3xl lg:text-4xl font-bold mb-8">
              Datos que importan para tu taller
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { value: "37%", label: "Margen medio identificado" },
                { value: "3 min", label: "Tiempo de análisis" },
                { value: "100%", label: "Precisión en cálculos" }
              ].map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-4xl lg:text-5xl font-bold mb-2">{stat.value}</div>
                  <div className="text-primary-foreground/80">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          {user ? (
            // CTA para usuarios logueados
            <>
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                ¡Comienza tu próximo análisis!
              </h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Sube un nuevo PDF de valoración y descubre la rentabilidad real de tu próximo trabajo.
              </p>
              <Link to="/app/nuevo">
                <Button size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow hover:shadow-lg transition-all duration-300">
                  Crear Nuevo Análisis
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </>
          ) : (
            // CTA para usuarios no logueados
            <>
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                ¿Listo para optimizar tu rentabilidad?
              </h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Comienza con 3 análisis gratuitos. Sin compromiso, sin tarjeta de crédito.
              </p>
              <Link to="/register">
                <Button size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow hover:shadow-lg transition-all duration-300">
                  Empezar Ahora - Es Gratis
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card/50 py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Calculator className="h-6 w-6 text-primary" />
                <span className="text-lg font-semibold">Valora Plus Analytics</span>
              </div>
              <p className="text-muted-foreground">
                La herramienta definitiva para calcular la rentabilidad real de tu taller de reparación.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Producto</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link to="/features" className="hover:text-primary transition-colors">Características</Link></li>
                <li><Link to="/pricing" className="hover:text-primary transition-colors">Precios</Link></li>
                <li><Link to="/integrations" className="hover:text-primary transition-colors">Integraciones</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Soporte</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link to="/help" className="hover:text-primary transition-colors">Centro de Ayuda</Link></li>
                <li><Link to="/contact" className="hover:text-primary transition-colors">Contacto</Link></li>
                <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacidad</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-muted-foreground">
            <p>&copy; 2024 Valora Plus Analytics. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;