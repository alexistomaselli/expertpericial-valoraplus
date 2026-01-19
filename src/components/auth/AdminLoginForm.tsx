import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Esquema de validación
const formSchema = z.object({
  email: z.string().email("Ingresa un correo electrónico válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

type FormValues = z.infer<typeof formSchema>;

export function AdminLoginForm() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleAdminLogin = async (values: FormValues) => {
    setLoginError(null);
    setIsSubmitting(true);

    try {
      //console.log('🔐 AdminLoginForm: Intentando iniciar sesión como administrador...');

      // Intentar iniciar sesión suprimiendo el toast de éxito automático
      const result = await signIn(values.email, values.password, { suppressSuccessToast: true });

      if (result.success) {
        //console.log('🔐 AdminLoginForm: Login exitoso, verificando rol de administrador...');

        // Verificar que el usuario tenga rol de administrador
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          if (error) {
            console.error('🔐 AdminLoginForm: Error obteniendo perfil:', error);
            setLoginError("Error al verificar permisos de administrador.");
            // Cerrar sesión si hay error
            await supabase.auth.signOut();
            setIsSubmitting(false);
            return;
          }

          if (profile?.role !== 'admin') {
            console.error('🔐 AdminLoginForm: Usuario no es administrador:', profile?.role);
            setLoginError("Acceso denegado. Solo los administradores pueden acceder a este panel.");
            // Cerrar sesión si no es admin
            await supabase.auth.signOut();
            setIsSubmitting(false);
            return;
          }

          console.log('🔐 AdminLoginForm: Usuario verificado como administrador, redirigiendo...');
          // Mostrar toast de éxito solo para administradores válidos
          import('@/components/ui/use-toast').then(({ toast }) => {
            toast({
              title: "Acceso autorizado",
              description: "Bienvenido al panel de administración",
            });
          });
          // El useEffect en AdminLogin se encargará de la redirección
        } else {
          setLoginError("Error al verificar la sesión del usuario.");
          setIsSubmitting(false);
        }
      } else {
        console.error('🔐 AdminLoginForm: Error en login:', result.error);
        setLoginError(result.error || "Error al iniciar sesión. Verifica tus credenciales.");
        setIsSubmitting(false);
      }
    } catch (error: any) {
      console.error("🔐 AdminLoginForm: Error inesperado en el inicio de sesión:", error);
      setLoginError(error?.message || "Error al iniciar sesión. Verifica tus credenciales.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md border-2 border-red-200">
      <div className="flex items-center justify-center mb-4">
        <Shield className="h-8 w-8 text-red-600 mr-2" />
        <h2 className="text-2xl font-bold text-center text-red-600">Panel de Administración</h2>
      </div>

      <p className="text-center text-gray-600 mb-6 text-sm">
        Acceso restringido solo para administradores de Valora Plus
      </p>

      {loginError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {loginError}
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleAdminLogin)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Correo Electrónico de Administrador</FormLabel>
                <FormControl>
                  <Input
                    placeholder="admin@valoraplus.com"
                    {...field}
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Contraseña</FormLabel>
                  <ForgotPasswordDialog />
                </div>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Contraseña de administrador"
                    {...field}
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando acceso...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Acceder como Administrador
              </>
            )}
          </Button>
        </form>
      </Form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          ¿Eres un taller?{" "}
          <Link
            to="/login"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Accede aquí
          </Link>
        </p>
      </div>
    </div>
  );
}

function ForgotPasswordDialog() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    const result = await resetPassword(email);
    setIsSubmitting(false);

    if (result.success) {
      setIsOpen(false);
      setEmail("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-xs text-red-600 hover:text-red-800 font-medium"
        >
          ¿Olvidaste tu contraseña?
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Restablecer contraseña admin</DialogTitle>
          <DialogDescription>
            Ingresa tu correo institucional para recibir un enlace de recuperación.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-2">
            <FormLabel>Correo Electrónico</FormLabel>
            <Input
              type="email"
              placeholder="admin@valoraplus.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>
          <Button type="submit" className="w-full bg-red-600 hover:bg-red-700" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar enlace de recuperación"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}