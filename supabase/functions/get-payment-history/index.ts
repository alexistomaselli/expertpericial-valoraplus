// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the user from the request
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get user_id from request body or use authenticated user's id
    const { user_id } = await req.json()
    const targetUserId = user_id || user.id

    // Verify user can access this data (users can only see their own payments)
    if (targetUserId !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: You can only access your own payment history' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get Stripe secret key
    // @ts-ignore
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured')
    }

    // Search for payment intents in Stripe using the user_id in metadata
    const stripeResponse = await fetch(
      `https://api.stripe.com/v1/payment_intents/search?query=metadata['user_id']:'${targetUserId}'&limit=50`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    if (!stripeResponse.ok) {
      const errorText = await stripeResponse.text()
      console.error('Stripe API error:', errorText)
      throw new Error(`Stripe API error: ${stripeResponse.status}`)
    }

    const stripeData = await stripeResponse.json()

    // Also get local payment records from Supabase for additional context
    const { data: localPayments, error: localError } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })

    if (localError) {
      console.error('Error fetching local payments:', localError)
    }

    // Combine and format the data
    const paymentHistory = {
      stripe_payments: stripeData.data || [],
      local_payments: localPayments || [],
      total_stripe_payments: stripeData.total_count || 0,
      has_more: stripeData.has_more || false
    }

    return new Response(
      JSON.stringify(paymentHistory),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in get-payment-history function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})