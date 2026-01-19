// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get request body first
    const body = await req.json()
    const { amount, currency = 'eur', description = 'Payment', package_id, analyses_count, user_id } = body

    // Get the user from the request or from body
    let user = null
    if (req.headers.get('Authorization')) {
      const {
        data: { user: authUser },
      } = await supabaseClient.auth.getUser()
      user = authUser
    } else if (user_id) {
      // When no JWT, accept user_id from body (for testing)
      user = { id: user_id }
    }

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'No user found' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    let packageData = null
    let finalAmount = amount
    let finalDescription = description
    let finalAnalysesCount = analyses_count || 1

    // If package_id is provided, get package details
    if (package_id) {
      const { data: packageInfo, error: packageError } = await supabaseClient
        .rpc('get_package_by_id', { package_id })
        .single()

      if (packageError || !packageInfo) {
        return new Response(
          JSON.stringify({ error: 'Package not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      packageData = packageInfo
      finalAmount = Number(packageInfo.total_price)
      finalDescription = `${packageInfo.name} - ${packageInfo.analyses_count} análisis`
      finalAnalysesCount = packageInfo.analyses_count
    }

    if (!finalAmount || finalAmount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Initialize Stripe
    const stripe = new (await import('https://esm.sh/stripe@14.21.0')).default(
      Deno.env.get('STRIPE_SECRET_KEY') ?? '',
      {
        apiVersion: '2023-10-16',
      }
    )

    // Get success and cancel URLs from system settings
    const { data: settings } = await supabaseClient
      .from('system_settings')
      .select('stripe_success_url, stripe_cancel_url')
      .single()

    const baseSuccessUrl = settings?.stripe_success_url || `${req.headers.get('origin')}/payment-success`
    const baseCancelUrl = settings?.stripe_cancel_url || `${req.headers.get('origin')}/payment-cancel`
    
    // Add session_id parameter to URLs so Stripe can send it back
    const successUrl = `${baseSuccessUrl}?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${baseCancelUrl}?session_id={CHECKOUT_SESSION_ID}`

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: finalDescription,
            },
            //unit_amount: Math.round(finalAmount * 100), // Convert to cents
            unit_amount: finalAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: user.email,
      metadata: {
        user_id: user.id,
        workshop_id: profile.workshop_id || '',
        description: finalDescription,
        package_id: package_id || '',
        analyses_count: finalAnalysesCount.toString(),
      },
    })

    // Calculate unit price (already in cents from database)
    const unitPriceCents = packageData 
      ? Math.round(Number(packageData.price_per_analysis))
      : Math.round(finalAmount)

    // Store payment record
    const { error: paymentError } = await supabaseClient
      .from('payments')
      .insert({
        user_id: user.id,
        workshop_id: profile.workshop_id || '00000000-0000-0000-0000-000000000000', // Default UUID if no workshop
        stripe_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent || session.id, // Use session.id as fallback
        amount_cents: Math.round(finalAmount), // Already in cents from database
        currency: currency,
        status: 'pending',
        analysis_month: new Date().toISOString().slice(0, 7), // YYYY-MM format
        analyses_purchased: finalAnalysesCount,
        unit_price_cents: unitPriceCents,
        description: finalDescription,
        package_id: package_id || null, // ✨ Agregar package_id al registro
      })

    if (paymentError) {
      console.error('Error storing payment record:', paymentError)
      // Continue anyway, as the Stripe session was created successfully
    }

    return new Response(
      JSON.stringify({ 
        url: session.url,
        session_id: session.id 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in payment-session function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})