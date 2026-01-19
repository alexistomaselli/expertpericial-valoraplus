import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, FileText, Filter, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type AnalysisRow = {
  id: string;
  status: string;
  analysis_date: string;
  valuation_date: string | null;
  user_id: string;
  workshop_id: string | null;
  user_full_name: string | null;
  workshop_name: string | null;
  net_subtotal: number | string | null;
  total_with_iva: number | string | null;
  iva_percentage: number | string | null;
  iva_amount: number | string | null;
  painting_hourly_cost: number | string | null;
  painting_actual_hours: number | string | null;
  painting_consumables_cost: number | string | null;
  bodywork_hourly_cost: number | string | null;
  bodywork_actual_hours: number | string | null;
  spare_parts_purchase_cost: number | string | null;
  subcontractor_costs: number | string | null;
  other_costs: number | string | null;
  total_count?: number;
};

const PAGE_SIZE = 10;

// Helper function to safely convert string/number values
function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "string") return parseFloat(value) || 0;
  return value || 0;
}

function sumCost(row: AnalysisRow) {
  const painting = toNumber(row.painting_hourly_cost) * toNumber(row.painting_actual_hours);
  const paintingConsumables = toNumber(row.painting_consumables_cost);
  const bodywork = toNumber(row.bodywork_hourly_cost) * toNumber(row.bodywork_actual_hours);
  const spareParts = toNumber(row.spare_parts_purchase_cost);
  const subcontractor = toNumber(row.subcontractor_costs);
  const other = toNumber(row.other_costs);
  return painting + paintingConsumables + bodywork + spareParts + subcontractor + other;
}

function income(row: AnalysisRow) {
  // IMPORTANTE: Usar net_subtotal (base imponible) para cálculos de rentabilidad
  // Los cálculos de rentabilidad deben basarse en el subtotal SIN IVA
  const netSubtotal = toNumber(row.net_subtotal);
  if (netSubtotal > 0) {
    return netSubtotal;
  }
  
  // Solo como fallback si net_subtotal no está disponible
  console.warn('net_subtotal no disponible para análisis:', row.id);
  return 0;
}

function getCalculationStatus(row: AnalysisRow) {
  // Si tiene datos de costes, la rentabilidad está calculada
  if (row.painting_hourly_cost !== null || row.bodywork_hourly_cost !== null || row.spare_parts_purchase_cost !== null) {
    return "Rentabilidad calculada";
  }
  
  // Si el status es 'completed' pero no tiene costes, está listo para calcular
  if (row.status === 'completed') {
    return "Listo para calcular";
  }
  
  // Si está en processing, está procesando
  if (row.status === 'processing') {
    return "Procesando";
  }
  
  // Otros estados
  return row.status;
}

const AdminAnalyses = () => {
  console.log("🚀 AdminAnalyses component loaded!");
  
  const { session, profile } = useAuth();
  console.log("🔐 Estado de autenticación:", { 
    hasSession: !!session, 
    userRole: profile?.role,
    userId: session?.user?.id 
  });
  
  const [rows, setRows] = useState<AnalysisRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const fetchData = async () => {
    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      setError("Error de autenticación");
      setLoading(false);
      return;
    }
    
    if (!user) {
      setError("No hay usuario autenticado");
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    // Obtener todos los datos sin filtro de estado para poder filtrar por estado calculado
    const { data, error } = await (supabase as any).rpc('get_admin_analyses', {
      p_limit: 1000, // Obtener más datos para filtrar localmente
      p_offset: 0,
      p_from_date: fromDate || null,
      p_to_date: toDate || null,
      p_status: null // No filtrar por estado en la base de datos
    });
    
    if (error) {
      setError(error.message);
      setRows([]);
      setTotal(0);
    } else {
      let analysisData = (data as unknown as AnalysisRow[]) ?? [];
      
      // Filtrar por estado calculado si se seleccionó uno
      if (status) {
        analysisData = analysisData.filter(row => getCalculationStatus(row) === status);
      }
      
      // Aplicar paginación después del filtrado
      const totalFiltered = analysisData.length;
      const startIndex = page * PAGE_SIZE;
      const endIndex = startIndex + PAGE_SIZE;
      const paginatedData = analysisData.slice(startIndex, endIndex);
      
      setRows(paginatedData);
      setTotal(totalFiltered);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fromDate, toDate, status]);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 0;

  const summary = useMemo(() => {
    if (!rows.length) return { avgMargin: 0, avgPercent: 0 };
    let sumM = 0;
    let sumPerc = 0;
    let count = 0;
    for (const r of rows) {
      const inc = income(r);
      const ct = sumCost(r);
      const m = inc - ct;
      const perc = inc > 0 ? (m / inc) * 100 : 0;
      sumM += m;
      sumPerc += perc;
      count++;
    }
    return {
      avgMargin: Math.round(sumM / count),
      avgPercent: Math.round((sumPerc / count) * 100) / 100,
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FileText className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Análisis</h2>
        </div>
        <div className="text-sm text-muted-foreground">
          Media margen: <span className="font-medium">€{summary.avgMargin}</span> · Media %: <span className="font-medium">{summary.avgPercent}%</span>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-lg">Listado de análisis</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filtros</span>
            </div>
            <Input type="date" value={fromDate} onChange={(e) => { setPage(0); setFromDate(e.target.value); }} className="w-40" />
            <Input type="date" value={toDate} onChange={(e) => { setPage(0); setToDate(e.target.value); }} className="w-40" />
            <select
              className="h-10 px-3 rounded-md border bg-background"
              value={status}
              onChange={(e) => { setPage(0); setStatus(e.target.value); }}
            >
              <option value="">Todos los estados</option>
              <option value="Rentabilidad calculada">Rentabilidad calculada</option>
              <option value="Listo para calcular">Listo para calcular</option>
              <option value="Procesando">Procesando</option>
            </select>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <div className="text-sm text-muted-foreground">{total} resultados</div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 flex items-center rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-destructive">
              <AlertCircle className="mr-2 h-4 w-4" />
              <span>Error al cargar análisis: {error}</span>
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Taller</TableHead>
                  <TableHead>Monto Valoración</TableHead>
                  <TableHead>Costes</TableHead>
                  <TableHead>Margen</TableHead>
                  <TableHead>%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <div className="h-6 w-full bg-muted animate-pulse rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No hay análisis para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => {
                    const inc = income(r);
                    const ct = sumCost(r);
                    const m = inc - ct;
                    const perc = inc > 0 ? Math.round(((m / inc) * 100) * 100) / 100 : 0;
                    const calculationStatus = getCalculationStatus(r);
                    
                    return (
                      <TableRow key={r.id}>
                        <TableCell>{r.analysis_date ? new Date(r.analysis_date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</TableCell>
                        <TableCell>
                          <span className={
                            calculationStatus === "Rentabilidad calculada" 
                              ? "text-green-600 font-medium" 
                              : calculationStatus === "Listo para calcular"
                              ? "text-blue-600 font-medium"
                              : calculationStatus === "Procesando"
                              ? "text-yellow-600 font-medium"
                              : "text-gray-600"
                          }>
                            {calculationStatus}
                          </span>
                        </TableCell>
                        <TableCell>{r.workshop_name || "-"}</TableCell>
                        <TableCell>€{inc.toFixed(2)}</TableCell>
                        <TableCell>€{Math.round(ct)}</TableCell>
                        <TableCell className={m >= 0 ? "text-green-600" : "text-red-600"}>€{Math.round(m)}</TableCell>
                        <TableCell className={m >= 0 ? "text-green-600" : "text-red-600"}>{perc}%</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Página {totalPages === 0 ? 0 : page + 1} de {totalPages}</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={loading || page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</Button>
              <Button variant="outline" disabled={loading || page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAnalyses;