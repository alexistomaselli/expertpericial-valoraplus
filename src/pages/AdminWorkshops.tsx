import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Building2, Loader2, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase, Workshop } from "@/lib/supabase";

const PAGE_SIZE = 10;

const AdminWorkshops = () => {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkshops = async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from("workshops" as never)
      .select("id,name,email,phone,address,created_at,updated_at", { count: "estimated" })
      .order("created_at", { ascending: false });

    // Usar búsqueda por prefijo para mejorar rendimiento
    const trimmed = search.trim();
    if (trimmed.length >= 2) {
      const term = trimmed.replace(/%/g, "");
      // Coincidencias en cualquier posición para soportar "Taller Alexis" con término "ale"
      query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`);
    }

    query = query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    const { data, count, error } = await query;
    if (error) {
      console.error("Error cargando talleres:", error);
      setError(error.message);
      setWorkshops([]);
      setTotal(0);
    } else {
      setWorkshops((data ?? []) as Workshop[]);
      setTotal(count ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(fetchWorkshops, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Building2 className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Talleres</h2>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-lg">Listado de talleres</CardTitle>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => {
                setPage(0);
                setSearch(e.target.value);
              }}
              className="max-w-sm"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <div className="text-sm text-muted-foreground">
              {total} resultados{search ? ` para "${search}"` : ""}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 flex items-center rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-destructive">
              <AlertCircle className="mr-2 h-4 w-4" />
              <span>Error al cargar talleres: {error}</span>
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead className="text-right">Creado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <div className="h-6 w-full bg-muted animate-pulse rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : workshops.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No hay talleres{search ? " que coincidan con la búsqueda" : ""}.
                    </TableCell>
                  </TableRow>
                ) : (
                  workshops.map((ws) => (
                    <TableRow key={ws.id}>
                      <TableCell className="font-medium">{ws.name}</TableCell>
                      <TableCell>{ws.email || "-"}</TableCell>
                      <TableCell>{ws.phone || "-"}</TableCell>
                      <TableCell className="max-w-[320px] truncate">{ws.address || "-"}</TableCell>
                      <TableCell className="text-right">{new Date(ws.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Link to={`/admin/workshops/${ws.id}/analisis`}>
                          <Button size="sm" className="inline-flex items-center">
                            <FileText className="h-4 w-4 mr-2" />
                            Ver análisis
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Página {totalPages === 0 ? 0 : page + 1} de {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={loading || page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                disabled={loading || page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminWorkshops;