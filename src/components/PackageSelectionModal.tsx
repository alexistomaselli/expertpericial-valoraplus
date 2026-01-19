import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";
import { useAnalysisPackages } from "@/hooks/use-analysis-packages";
import StripeIcon from "@/components/StripeIcon";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface PackageSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  title?: string;
  description?: string;
  showPurchaseButton?: boolean;
}

const PackageSelectionModal = ({ 
  open, 
  onOpenChange, 
  onSuccess,
  title = "Comprar Análisis",
  description = "Elige un paquete de análisis para continuar.",
  showPurchaseButton = true
}: PackageSelectionModalProps) => {
  const { packages, loading: packagesLoading } = useAnalysisPackages();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleCancelPayment = () => {
    setSelectedPackage(null);
    setIsProcessingPayment(false);
    onOpenChange(false);
  };

  const processPayment = async () => {
    if (!selectedPackage || !user) return;

    setIsProcessingPayment(true);
    
    try {
      const selectedPkg = packages.find(p => p.id === selectedPackage);
      if (!selectedPkg) {
        throw new Error('Paquete no encontrado');
      }

      const paymentData = {
        currency: 'eur',
        package_id: selectedPackage,
        analyses_count: selectedPkg.analyses_count,
        description: `Paquete: ${selectedPkg.name} - ${selectedPkg.analyses_count} análisis`,
        user_id: user.id
      };
      
      // Crear sesión de pago con Stripe
      console.log('Creating payment session with data:', paymentData);
      const { data, error } = await supabase.functions.invoke('payment-session', {
        body: paymentData
      });

      if (error) {
        throw new Error(`Error creando sesión de pago: ${error.message}`);
      }

      if (data?.url) {
        // Redirigir a Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error('No se recibió URL de pago');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Error en el pago",
        description: error instanceof Error ? error.message : "Ha ocurrido un error inesperado",
        variant: "destructive",
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleCancelPayment()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <span>{title}</span>
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {packagesLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Cargando paquetes...</p>
            </div>
          ) : packages.length > 0 ? (
            <RadioGroup value={selectedPackage || ''} onValueChange={setSelectedPackage}>
              <div className="space-y-3">
                {packages.map((pkg) => (
                  <div key={pkg.id} className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value={pkg.id} id={pkg.id} />
                    <Label htmlFor={pkg.id} className="flex-1 cursor-pointer">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{pkg.name}</h4>
                          {pkg.description && (
                            <p className="text-sm text-muted-foreground">{pkg.description}</p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            {pkg.analyses_count} análisis • €{(pkg.price_per_analysis / 100).toFixed(2)} por análisis
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{pkg.formattedPrice}</p>
                          {pkg.savings > 0 && (
                            <p className="text-sm text-green-600">
                              Ahorras {pkg.formattedSavings}
                            </p>
                          )}
                        </div>
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground">No hay paquetes disponibles en este momento.</p>
            </div>
          )}
          
          <div className="text-sm text-muted-foreground border-t pt-4 space-y-1">
            <p>• Pago único con descuentos por volumen</p>
            <p>• Los análisis se añaden a tu balance</p>
            <p>• Ideal para uso frecuente</p>
            <p className="flex items-center">
              • El pago se procesará de forma segura a través de 
              <StripeIcon className="mx-1 h-4 w-4" size={16} />
              Stripe
            </p>
            <p>• Podrás continuar inmediatamente después del pago</p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={handleCancelPayment}
            disabled={isProcessingPayment}
          >
            Cancelar
          </Button>
          {showPurchaseButton && (
            <Button 
              onClick={processPayment}
              disabled={isProcessingPayment || !selectedPackage}
              className="bg-gradient-primary text-primary-foreground"
            >
              {isProcessingPayment ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Procesando...
                </>
              ) : (
                <>
                  <StripeIcon className="mr-2 h-4 w-4" size={16} />
                  {selectedPackage ? (
                    `Pagar ${packages.find(p => p.id === selectedPackage)?.formattedPrice || '€0.00'}`
                  ) : (
                    'Selecciona un paquete'
                  )}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PackageSelectionModal;