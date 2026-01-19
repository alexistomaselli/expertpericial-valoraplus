# Configuración de Stripe para Valora Plus

## Configuración inicial

### 1. Configurar variables de entorno en Supabase

Ejecuta los siguientes comandos en tu terminal para configurar las variables de entorno:

```bash
# Configurar la clave secreta de Stripe
supabase secrets set STRIPE_SECRET_KEY=sk_test_tu_clave_secreta_aqui

# Configurar el webhook secret de Stripe
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_tu_webhook_secret_aqui
```

### 2. Desplegar las Edge Functions

```bash
# Desplegar todas las funciones
supabase functions deploy create-payment-session
supabase functions deploy stripe-webhook
supabase functions deploy get-next-analysis-cost
```

### 3. Configurar webhooks en Stripe Dashboard

1. Ve a tu dashboard de Stripe: https://dashboard.stripe.com/webhooks
2. Crea un nuevo webhook endpoint con la URL: `https://tu-proyecto.supabase.co/functions/v1/stripe-webhook`
3. Selecciona los siguientes eventos:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copia el webhook secret y configúralo con el comando de arriba

### 4. Configurar las claves en la aplicación

En el panel de administración de la aplicación:

1. Ve a la sección "Sistema de Pagos"
2. Activa "Habilitar Facturación"
3. Activa "Habilitar Stripe"
4. Configura la clave pública de Stripe en la base de datos:

```sql
UPDATE system_settings 
SET setting_value = '{"value": "pk_test_tu_clave_publica_aqui"}'
WHERE setting_key = 'stripe_publishable_key';
```

### 5. Configurar precios

Configura el precio de análisis adicionales:

```sql
UPDATE system_settings 
SET setting_value = '{"value": 25.00}'
WHERE setting_key = 'additional_analysis_price';
```

## Flujo de pago

1. El usuario intenta crear un análisis cuando ya no tiene análisis gratuitos
2. Se muestra un modal de pago con el costo
3. Al hacer clic en "Pagar", se llama a la función `create-payment-session`
4. Se redirige al usuario a Stripe Checkout
5. Después del pago, Stripe envía un webhook a `stripe-webhook`
6. El webhook actualiza el estado del pago en la base de datos
7. El usuario es redirigido de vuelta a la aplicación

## Funciones Edge disponibles

### create-payment-session
- **Propósito**: Crear una sesión de pago en Stripe
- **Parámetros**: `{ amount: number, description?: string }`
- **Retorna**: `{ url: string, session_id: string, payment_intent_id: string }`

### stripe-webhook
- **Propósito**: Manejar webhooks de Stripe
- **Eventos soportados**: 
  - `checkout.session.completed`
  - `checkout.session.expired`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`

### get-next-analysis-cost
- **Propósito**: Obtener el costo del próximo análisis
- **Retorna**: `{ cost: number, is_free: boolean, billing_enabled: boolean }`

## Pruebas

Para probar en modo desarrollo:

1. Usa las claves de test de Stripe (empiezan con `sk_test_` y `pk_test_`)
2. Usa números de tarjeta de prueba: https://stripe.com/docs/testing#cards
3. Revisa los logs de las Edge Functions: `supabase functions logs`

## Producción

Para producción:

1. Cambia a las claves de producción de Stripe
2. Configura el webhook con la URL de producción
3. Actualiza las variables de entorno con las claves de producción