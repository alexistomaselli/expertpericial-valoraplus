import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    User,
    Mail,
    Lock,
    Save,
    Loader2,
    ShieldCheck,
    KeyRound
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

const AdminProfile = () => {
    const { user, profile, refreshProfile } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [formData, setFormData] = useState({
        full_name: "",
        email: ""
    });
    const [passwordData, setPasswordData] = useState({
        newPassword: "",
        confirmPassword: ""
    });

    useEffect(() => {
        if (profile) {
            setFormData({
                full_name: profile.full_name || "",
                email: user?.email || ""
            });
        }
    }, [profile, user]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: formData.full_name
                })
                .eq('id', user.id);

            if (error) throw error;

            await refreshProfile();
            toast({
                title: "Perfil actualizado",
                description: "Tus datos han sido guardados correctamente.",
            });
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "No se pudo actualizar el perfil.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast({
                title: "Error",
                description: "Las contraseñas no coinciden.",
                variant: "destructive",
            });
            return;
        }

        if (passwordData.newPassword.length < 6) {
            toast({
                title: "Error",
                description: "La contraseña debe tener al menos 6 caracteres.",
                variant: "destructive",
            });
            return;
        }

        setPasswordLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: passwordData.newPassword
            });

            if (error) throw error;

            setPasswordData({ newPassword: "", confirmPassword: "" });
            toast({
                title: "Contraseña actualizada",
                description: "Tu contraseña ha sido cambiada correctamente.",
            });
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "No se pudo actualizar la contraseña.",
                variant: "destructive",
            });
        } finally {
            setPasswordLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
                <p className="text-gray-600">Gestiona tu información personal y seguridad</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Información Personal */}
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <User className="h-5 w-5 text-primary" />
                            Datos Personales
                        </CardTitle>
                        <CardDescription>
                            Actualiza tu nombre y correo electrónico
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Correo Electrónico</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                    <Input
                                        id="email"
                                        type="email"
                                        value={formData.email}
                                        disabled
                                        className="pl-10 bg-gray-50"
                                    />
                                </div>
                                <p className="text-xs text-gray-500">El correo no se puede cambiar por seguridad</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="full_name">Nombre y Apellidos</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                    <Input
                                        id="full_name"
                                        placeholder="Tu nombre completo"
                                        value={formData.full_name}
                                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                        className="pl-10"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="pt-2">
                                <Button type="submit" disabled={loading} className="w-full sm:w-auto flex items-center gap-2">
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* Seguridad / Contraseña */}
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <Lock className="h-5 w-5 text-primary" />
                            Seguridad
                        </CardTitle>
                        <CardDescription>
                            Cambia tu contraseña de acceso
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="newPassword">Nueva Contraseña</Label>
                                <div className="relative">
                                    <KeyRound className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                    <Input
                                        id="newPassword"
                                        type="password"
                                        placeholder="Mínimo 6 caracteres"
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        className="pl-10"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                                <div className="relative">
                                    <ShieldCheck className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                    <Input
                                        id="confirmPassword"
                                        type="password"
                                        placeholder="Repite la contraseña"
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        className="pl-10"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="pt-2">
                                <Button
                                    type="submit"
                                    disabled={passwordLoading}
                                    variant="outline"
                                    className="w-full sm:w-auto border-primary text-primary hover:bg-primary/5"
                                >
                                    {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                                    {passwordLoading ? 'Actualizando...' : 'Actualizar Contraseña'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default AdminProfile;
