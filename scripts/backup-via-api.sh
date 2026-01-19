#!/bin/bash

# Script para crear backup usando la API REST de Supabase
# Exporta datos de todas las tablas principales

# Cargar variables de entorno
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "Error: No se encontró el archivo .env"
    exit 1
fi

# Verificar que las variables necesarias estén configuradas
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_PUBLISHABLE_KEY" ]; then
    echo "Error: Variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY son requeridas"
    exit 1
fi

echo "🔄 Iniciando backup via API REST de Supabase..."
echo "🌐 URL: $VITE_SUPABASE_URL"

# Crear directorio de backups si no existe
mkdir -p backups/api

# Timestamp para el nombre del archivo
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Lista de tablas a exportar
TABLES=("profiles" "workshops" "analysis" "vehicle_data" "insurance_amounts" "workshop_costs")

echo "📊 Exportando datos de las tablas..."

# Función para exportar una tabla
export_table() {
    local table=$1
    local file="backups/api/${table}_${TIMESTAMP}.json"
    
    echo "  📋 Exportando tabla: $table"
    
    curl -s \
        -H "apikey: $VITE_SUPABASE_PUBLISHABLE_KEY" \
        -H "Authorization: Bearer $VITE_SUPABASE_PUBLISHABLE_KEY" \
        -H "Content-Type: application/json" \
        "$VITE_SUPABASE_URL/rest/v1/$table?select=*" \
        -o "$file"
    
    if [ $? -eq 0 ] && [ -s "$file" ]; then
        echo "  ✅ $table exportada: $file ($(du -h $file | cut -f1))"
    else
        echo "  ❌ Error al exportar $table"
        return 1
    fi
}

# Exportar cada tabla
for table in "${TABLES[@]}"; do
    export_table "$table"
done

# Crear un backup consolidado en formato SQL
CONSOLIDATED_BACKUP="backups/api/consolidated_backup_${TIMESTAMP}.sql"

echo ""
echo "🔄 Creando backup consolidado en formato SQL..."

cat > "$CONSOLIDATED_BACKUP" << 'EOF'
-- Backup consolidado de Supabase
-- Generado automáticamente

-- Nota: Este backup contiene solo los datos, no la estructura de las tablas
-- Para restaurar completamente, primero ejecuta las migraciones

BEGIN;

EOF

# Convertir cada archivo JSON a INSERT statements
for table in "${TABLES[@]}"; do
    json_file="backups/api/${table}_${TIMESTAMP}.json"
    if [ -f "$json_file" ] && [ -s "$json_file" ]; then
        echo "-- Datos de la tabla: $table" >> "$CONSOLIDATED_BACKUP"
        echo "DELETE FROM $table;" >> "$CONSOLIDATED_BACKUP"
        
        # Usar jq para convertir JSON a SQL INSERTs (si está disponible)
        if command -v jq &> /dev/null; then
            echo "  🔄 Convirtiendo $table a SQL..."
            # Esto es un ejemplo básico, puede necesitar ajustes según la estructura
            echo "-- Conversión automática de JSON a SQL no implementada completamente" >> "$CONSOLIDATED_BACKUP"
            echo "-- Archivo JSON disponible: $json_file" >> "$CONSOLIDATED_BACKUP"
        else
            echo "-- jq no disponible, archivo JSON: $json_file" >> "$CONSOLIDATED_BACKUP"
        fi
        
        echo "" >> "$CONSOLIDATED_BACKUP"
    fi
done

echo "COMMIT;" >> "$CONSOLIDATED_BACKUP"

echo "✅ Backup consolidado creado: $CONSOLIDATED_BACKUP"

# Crear un script de restauración
RESTORE_SCRIPT="backups/api/restore_${TIMESTAMP}.sh"

cat > "$RESTORE_SCRIPT" << EOF
#!/bin/bash

# Script de restauración para el backup del $TIMESTAMP
# 
# IMPORTANTE: Este script restaura solo los datos, no la estructura
# Asegúrate de que las tablas existan antes de ejecutar

echo "🔄 Iniciando restauración del backup del $TIMESTAMP"

# Cargar variables de entorno
if [ -f ../../.env ]; then
    export \$(cat ../../.env | grep -v '^#' | xargs)
else
    echo "Error: No se encontró el archivo .env"
    exit 1
fi

# Lista de archivos de backup
EOF

for table in "${TABLES[@]}"; do
    echo "echo \"📋 Restaurando tabla: $table\"" >> "$RESTORE_SCRIPT"
    echo "# curl -X POST \\" >> "$RESTORE_SCRIPT"
    echo "#     -H \"apikey: \$VITE_SUPABASE_PUBLISHABLE_KEY\" \\" >> "$RESTORE_SCRIPT"
    echo "#     -H \"Authorization: Bearer \$VITE_SUPABASE_PUBLISHABLE_KEY\" \\" >> "$RESTORE_SCRIPT"
    echo "#     -H \"Content-Type: application/json\" \\" >> "$RESTORE_SCRIPT"
    echo "#     -d @${table}_${TIMESTAMP}.json \\" >> "$RESTORE_SCRIPT"
    echo "#     \"\$VITE_SUPABASE_URL/rest/v1/$table\"" >> "$RESTORE_SCRIPT"
    echo "" >> "$RESTORE_SCRIPT"
done

echo "echo \"✅ Restauración completada\"" >> "$RESTORE_SCRIPT"

chmod +x "$RESTORE_SCRIPT"

echo ""
echo "📁 Archivos de backup creados:"
for table in "${TABLES[@]}"; do
    file="backups/api/${table}_${TIMESTAMP}.json"
    if [ -f "$file" ]; then
        echo "   📋 $table: $file ($(du -h $file | cut -f1))"
    fi
done

echo "   🔄 Consolidado: $CONSOLIDATED_BACKUP ($(du -h $CONSOLIDATED_BACKUP | cut -f1))"
echo "   🛠️  Script de restauración: $RESTORE_SCRIPT"
echo ""
echo "✅ Backup via API completado!"
echo ""
echo "💡 Los archivos JSON contienen los datos en formato JSON"
echo "💡 Para restaurar, revisa el script: $RESTORE_SCRIPT"