#!/bin/bash

# Script completo de backup para Supabase
# Incluye datos, migraciones y configuración

echo "🚀 Iniciando backup completo de Supabase..."

# Timestamp para todos los archivos
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="backups/complete_${TIMESTAMP}"

# Crear directorio de backup
mkdir -p "$BACKUP_DIR"

echo "📁 Directorio de backup: $BACKUP_DIR"

# 1. Backup de datos via API
echo "📊 1. Exportando datos via API..."
./scripts/backup-via-api.sh

# Mover archivos de API al directorio completo
if [ -d "backups/api" ]; then
    cp -r backups/api/* "$BACKUP_DIR/"
    echo "✅ Datos exportados y copiados"
else
    echo "❌ Error: No se encontraron datos exportados"
fi

# 2. Backup de migraciones
echo "📋 2. Respaldando migraciones..."
tar -czf "$BACKUP_DIR/migrations.tar.gz" supabase/migrations/
echo "✅ Migraciones respaldadas"

# 3. Backup de configuración
echo "⚙️ 3. Respaldando configuración..."
cp supabase/config.toml "$BACKUP_DIR/" 2>/dev/null || echo "⚠️ config.toml no encontrado"
cp .env.example "$BACKUP_DIR/" 2>/dev/null || echo "⚠️ .env.example no encontrado"

# 4. Crear archivo de información del backup
cat > "$BACKUP_DIR/backup_info.txt" << EOF
BACKUP COMPLETO DE SUPABASE
===========================

Fecha de creación: $(date)
Timestamp: $TIMESTAMP

CONTENIDO DEL BACKUP:
--------------------

📊 DATOS (formato JSON):
- profiles_${TIMESTAMP}.json
- workshops_${TIMESTAMP}.json  
- analysis_${TIMESTAMP}.json
- vehicle_data_${TIMESTAMP}.json
- insurance_amounts_${TIMESTAMP}.json
- workshop_costs_${TIMESTAMP}.json

📋 ESTRUCTURA:
- migrations.tar.gz (todas las migraciones SQL)
- consolidated_backup_${TIMESTAMP}.sql (backup consolidado)

⚙️ CONFIGURACIÓN:
- config.toml (configuración de Supabase)
- .env.example (ejemplo de variables de entorno)

🛠️ SCRIPTS:
- restore_${TIMESTAMP}.sh (script de restauración)

INSTRUCCIONES DE RESTAURACIÓN:
-----------------------------

1. Para restaurar la estructura:
   - Extraer migrations.tar.gz
   - Ejecutar migraciones en orden en una nueva instancia de Supabase

2. Para restaurar datos:
   - Usar el script restore_${TIMESTAMP}.sh
   - O importar manualmente los archivos JSON via API

3. Para configuración:
   - Copiar config.toml a tu proyecto
   - Configurar variables de entorno basándote en .env.example

NOTAS IMPORTANTES:
-----------------
- Este backup contiene datos sensibles, manténlo seguro
- Las contraseñas y claves API no están incluidas por seguridad
- Verifica que todas las tablas tengan datos antes de usar en producción

EOF

# 5. Crear archivo comprimido final
echo "📦 4. Creando archivo comprimido final..."
cd backups
tar -czf "supabase_complete_backup_${TIMESTAMP}.tar.gz" "complete_${TIMESTAMP}/"
cd ..

# 6. Mostrar resumen
echo ""
echo "✅ BACKUP COMPLETO FINALIZADO"
echo "================================"
echo ""
echo "📁 Directorio: $BACKUP_DIR"
echo "📦 Archivo comprimido: backups/supabase_complete_backup_${TIMESTAMP}.tar.gz"
echo ""
echo "📊 Archivos incluidos:"
ls -la "$BACKUP_DIR/" | grep -v "^total" | awk '{print "   " $9 " (" $5 " bytes)"}'
echo ""
echo "📦 Tamaño del backup comprimido:"
du -h "backups/supabase_complete_backup_${TIMESTAMP}.tar.gz"
echo ""
echo "💡 Para restaurar:"
echo "   1. Extraer: tar -xzf supabase_complete_backup_${TIMESTAMP}.tar.gz"
echo "   2. Leer: complete_${TIMESTAMP}/backup_info.txt"
echo "   3. Seguir las instrucciones de restauración"
echo ""
echo "🔒 IMPORTANTE: Este backup contiene datos sensibles."
echo "   Guárdalo en un lugar seguro y no lo compartas públicamente."