import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Users,
    Search,
    Mail,
    Shield,
    Calendar,
    Loader2,
    Building2
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface UserProfile {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    created_at: string;
    workshop_id: string | null;
    workshops?: {
        name: string;
    };
}

const AdminUsers = () => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select(`
          *,
          workshops(name)
        `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.full_name?.toLowerCase() || "").includes(searchTerm.toLowerCase())
    );

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'admin':
                return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">Administrador</Badge>;
            case 'admin_mechanic':
                return <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">Taller Admin</Badge>;
            default:
                return <Badge variant="outline">{role}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
                    <p className="text-gray-600">Visualiza y administra todos los usuarios de la plataforma</p>
                </div>
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Buscar por nombre o email..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Usuarios Registrados ({filteredUsers.length})
                    </CardTitle>
                    <CardDescription>
                        Lista completa de usuarios y sus roles asignados
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Usuario</TableHead>
                                        <TableHead>Rol</TableHead>
                                        <TableHead>Taller</TableHead>
                                        <TableHead>Fecha Registro</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.length > 0 ? (
                                        filteredUsers.map((user) => (
                                            <TableRow key={user.id}>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-gray-900">{user.full_name || 'Sin nombre'}</span>
                                                        <div className="flex items-center text-xs text-gray-500 gap-1">
                                                            <Mail className="h-3 w-3" />
                                                            {user.email}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Shield className="h-3.5 w-3.5 text-gray-400" />
                                                        {getRoleBadge(user.role)}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {user.workshops ? (
                                                        <div className="flex items-center gap-2 text-sm text-gray-700">
                                                            <Building2 className="h-3.5 w-3.5 text-gray-400" />
                                                            {user.workshops.name}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">No asignado</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        {new Date(user.created_at).toLocaleDateString('es-ES')}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center">
                                                No se encontraron usuarios que coincidan con la búsqueda.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default AdminUsers;
