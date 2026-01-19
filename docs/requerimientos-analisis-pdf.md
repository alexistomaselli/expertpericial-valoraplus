# Requerimientos del Sistema - Análisis de PDFs de Valoración Pericial

## Contexto del Proyecto

**Valora Plus** es un SaaS para talleres mecánicos que permite analizar la rentabilidad real de las reparaciones comparando los importes que paga la aseguradora con los costos reales del taller.

### Roles del Sistema
- **Admin (Expert Pericial)**: Cliente que administra talleres y sus análisis
- **Taller**: Usuario final que realiza análisis de rentabilidad

### Modelo de Negocio
- **Freemium**: 1 análisis gratuito por mes por taller
- **Pago por uso**: 5€ por análisis adicional (vía Stripe)

## Flujo Principal del Análisis

### 1. Subida y Procesamiento del PDF
**Página**: `/app/nuevo` (NewAnalysis.tsx)
**Referencia visual**: `context/page-upload-rating-file.png`

**Proceso**:
1. El taller sube un PDF de valoración pericial (Audatex, GT Motive, Solera)
2. El PDF se envía a un webhook de n8n para procesamiento
3. n8n utiliza IA (GPT-4o) para extraer datos estructurados

### 2. Extracción de Datos del Vehículo
**Referencia visual**: `context/page-data-verification.png`

**Datos extraídos automáticamente**:
- **Matrícula**: Identificación del vehículo
- **Bastidor**: Número de chasis
- **Fabricante**: Marca del vehículo
- **Modelo**: Modelo específico
- **Referencia**: Referencia interna del sistema
- **Sistema**: Sistema de valoración (ej: AUDA, GT Motive)
- **Precio por hora**: Tarifa horaria establecida

### 3. Extracción de Importes de la Aseguradora
**Datos extraídos automáticamente**:
- **Repuestos Total**: Importe total de repuestos
- **MO Chapa UT**: Unidades de tiempo de mano de obra chapa
- **MO Chapa EUR**: Importe de mano de obra chapa
- **MO Pintura UT**: Unidades de tiempo de mano de obra pintura
- **MO Pintura EUR**: Importe de mano de obra pintura
- **Materiales Pintura EUR**: Importe de materiales de pintura

### 4. Ingreso de Costos del Taller
**Página**: Formulario de costos del taller
**Referencia visual**: `context/page-cost.png`

**Datos a ingresar manualmente**:
- Costos reales de repuestos
- Costos reales de mano de obra chapa
- Costos reales de mano de obra pintura
- Costos reales de materiales de pintura
- Otros costos adicionales

### 5. Cálculo y Visualización de Rentabilidad
**Página**: Resultados del análisis
**Referencia visual**: `context/page-profitability.png`

**Métricas calculadas**:
- **Rentabilidad total**: Diferencia entre importes aseguradora vs costos reales
- **Rentabilidad por categoría**:
  - Repuestos
  - Mano de obra chapa
  - Mano de obra pintura
  - Otros costos
- **Porcentajes de rentabilidad**
- **Gráficos comparativos**

## Entidades del Sistema

### 1. Analysis (Análisis)
```sql
- id: UUID (PK)
- workshop_id: UUID (FK -> workshops.id)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
- status: ENUM ('processing', 'pending_costs', 'completed', 'failed')
- pdf_url: TEXT (URL del PDF original)
- analysis_month: DATE (para control de límites mensuales)
```

### 2. Vehicle_Data (Datos del Vehículo)
```sql
- id: UUID (PK)
- analysis_id: UUID (FK -> analysis.id)
- matricula: VARCHAR(20)
- bastidor: VARCHAR(50)
- fabricante: VARCHAR(100)
- modelo: VARCHAR(100)
- referencia: VARCHAR(100)
- sistema: VARCHAR(50) (AUDA, GT Motive, etc.)
- precio_hora: DECIMAL(10,2)
```

### 3. Insurance_Amounts (Importes Aseguradora)
```sql
- id: UUID (PK)
- analysis_id: UUID (FK -> analysis.id)
- repuestos_total: DECIMAL(10,2)
- mo_chapa_ut: DECIMAL(8,2)
- mo_chapa_eur: DECIMAL(10,2)
- mo_pintura_ut: DECIMAL(8,2)
- mo_pintura_eur: DECIMAL(10,2)
- mat_pintura_eur: DECIMAL(10,2)
```

### 4. Workshop_Costs (Costos del Taller)
```sql
- id: UUID (PK)
- analysis_id: UUID (FK -> analysis.id)
- repuestos_costo: DECIMAL(10,2)
- mo_chapa_costo: DECIMAL(10,2)
- mo_pintura_costo: DECIMAL(10,2)
- mat_pintura_costo: DECIMAL(10,2)
- otros_costos: DECIMAL(10,2)
- created_at: TIMESTAMP
```

### 5. Profitability_Results (Resultados de Rentabilidad)
```sql
- id: UUID (PK)
- analysis_id: UUID (FK -> analysis.id)
- rentabilidad_total: DECIMAL(10,2)
- rentabilidad_repuestos: DECIMAL(10,2)
- rentabilidad_mo_chapa: DECIMAL(10,2)
- rentabilidad_mo_pintura: DECIMAL(10,2)
- rentabilidad_materiales: DECIMAL(10,2)
- porcentaje_total: DECIMAL(5,2)
- porcentaje_repuestos: DECIMAL(5,2)
- porcentaje_mo_chapa: DECIMAL(5,2)
- porcentaje_mo_pintura: DECIMAL(5,2)
- porcentaje_materiales: DECIMAL(5,2)
- calculated_at: TIMESTAMP
```

### 6. Monthly_Usage (Control de Uso Mensual)
```sql
- id: UUID (PK)
- workshop_id: UUID (FK -> workshops.id)
- month_year: DATE
- free_analyses_used: INTEGER DEFAULT 0
- paid_analyses_count: INTEGER DEFAULT 0
- total_amount_paid: DECIMAL(10,2) DEFAULT 0
```

## Integraciones Externas

### 1. n8n Webhook
- **URL**: Webhook configurado en n8n
- **Método**: POST
- **Payload**: PDF file + metadata
- **Response**: JSON con datos extraídos

### 2. Stripe (Futuro)
- **Propósito**: Procesamiento de pagos por análisis adicionales
- **Integración**: Cuando se supere el límite mensual gratuito

## Funcionalidades Administrativas (Expert Pericial)

### Dashboard Admin
- Lista de talleres registrados
- Estadísticas de uso por taller
- Análisis realizados por período
- Ingresos generados
- Métricas de adopción

### Gestión de Talleres
- Ver detalles de cada taller
- Historial de análisis
- Control de límites y facturación
- Soporte y comunicación

## Estados del Análisis

1. **processing**: PDF enviado a n8n, esperando extracción
2. **pending_costs**: Datos extraídos, esperando costos del taller
3. **completed**: Análisis completo con rentabilidad calculada
4. **failed**: Error en el procesamiento

## Consideraciones Técnicas

### Seguridad
- RLS (Row Level Security) para aislar datos por taller
- Validación de archivos PDF
- Límites de tamaño de archivo
- Rate limiting en endpoints

### Performance
- Procesamiento asíncrono con n8n
- Caching de resultados calculados
- Optimización de consultas para dashboards

### Escalabilidad
- Arquitectura preparada para múltiples talleres
- Sistema de colas para procesamiento
- Monitoreo de uso y performance

## Próximos Pasos

1. **Crear migraciones de base de datos** para las nuevas entidades
2. **Implementar API endpoints** para el flujo de análisis
3. **Desarrollar interfaz de subida** de PDFs
4. **Integrar con webhook de n8n** para procesamiento
5. **Crear formulario de costos** del taller
6. **Implementar cálculos de rentabilidad** y visualización
7. **Desarrollar dashboard administrativo** para Expert Pericial
8. **Integrar sistema de pagos** con Stripe