# Valora Plus Analytics

Este repositorio contiene el código fuente de Valora Plus Analytics. Sigue las instrucciones a continuación para configurar tu propio entorno.

## 1. Configuración de la Base de Datos (Supabase)

Esta aplicación utiliza [Supabase](https://supabase.com) como base de datos y sistema de autenticación.

1. Crea una cuenta en Supabase y crea un nuevo proyecto.
2. Ve a la sección **SQL Editor** en el panel de Supabase de tu proyecto.
3. Copia el contenido completo del archivo `database_schema.sql` que se encuentra en la raíz de este proyecto.
4. Pégalo en el SQL Editor y ejecútalo (`Run`). Esto creará de forma automática todas las tablas, funciones y políticas de seguridad necesarias.

## 2. Variables de Entorno

Debes configurar las variables de entorno para conectar la web con tu base de datos y otros servicios.

1. Renombra el archivo `.env.example` a `.env`
2. Ve a Supabase -> **Project Settings** -> **API** y copia tu `Project URL` y `anon_key`. Pégalos en `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. (Opcional) Completa las variables de Stripe si vas a procesar pagos, y la URL de webhook de n8n para la extracción de PDFs.

## 3. Instalación y Ejecución Local

Para correr el proyecto en tu computadora:

1. Asegúrate de tener Node.js instalado.
2. Abre una terminal en esta carpeta y ejecuta:
   ```bash
   npm install
   ```
3. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```
4. Abre la dirección que te indique la terminal (por ejemplo `http://localhost:8080`) en tu navegador.

## 4. Despliegue en Producción

Puedes desplegar este código fácilmente conectando este repositorio de GitHub a plataformas como Vercel, Netlify o Easypanel. El proyecto utiliza Vite + React + TypeScript.
