// @ts-nocheck
// Edge Function for creating Stripe payment sessions - runs in Deno environment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req: any) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      (Deno as any).env.get('SUPABASE_URL') ?? '',
      (Deno as any).env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('No user found')
    }

    // Get request body
    const body = await req.json()
    
    const { amount, description } = body

    if (!amount || amount <= 0) {
      throw new Error('Invalid amount')
    }

    // Get user's workshop information
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('workshop_id, full_name')
      .eq('id', user.id)
      .single()

    if (profileError) {
      throw new Error('User profile not found: ' + profileError.message)
    }

    if (!profile?.workshop_id) {
      throw new Error('User workshop not found')
    }

    // Initialize Stripe
    const stripeKey = (Deno as any).env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      throw new Error('Stripe configuration missing')
    }
    
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    })

    // Get system settings for redirect URLs
    const { data: successUrl, error: successUrlError } = await supabaseClient
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'payment_success_redirect')
      .single()

    const { data: cancelUrl, error: cancelUrlError } = await supabaseClient
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'payment_cancel_redirect')
      .single()

    const baseUrl = req.headers.get('origin') || 'http://localhost:8081'
    const successRedirect = successUrl?.setting_value?.value || '/payment/success'
    const cancelRedirect = cancelUrl?.setting_value?.value || '/payment/cancel'

    // Create or get Stripe customer
    // First, try to find existing customer by email
    const existingCustomers = await stripe.customers.list({
      email: user.email,
      limit: 1
    })
    
    let customer
    if (existingCustomers.data.length > 0) {
      // Use existing customer
      customer = existingCustomers.data[0]
      console.log('Using existing Stripe customer:', customer.id)
    } else {
      // Create new customer
      customer = await stripe.customers.create({
        email: user.email,
        name: profile.full_name || user.email,
        metadata: {
          user_id: user.id,
          workshop_id: profile.workshop_id
        }
      })
      console.log('Created new Stripe customer:', customer.id)
    }

    // Create Stripe Checkout Session
    const sessionData = {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Análisis Adicional',
              description: description || 'Análisis pericial adicional',
            },
            unit_amount: Math.round(amount), // Already in cents from database
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}${successRedirect}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${cancelRedirect}?session_id={CHECKOUT_SESSION_ID}`,
      customer: customer.id, // Use existing customer ID
      // NOTE: Do NOT use customer_creation when customer ID is provided
      // This prevents conflicts and ensures the existing customer is used
      metadata: {
        user_id: user.id,
        workshop_id: profile.workshop_id,
        analysis_month: new Date().toISOString().slice(0, 7), // YYYY-MM format
        description: description || 'Análisis adicional',
        type: 'additional_analysis'
      },
    }
    
    const session = await stripe.checkout.sessions.create(sessionData)

    // Store payment record in database using the new payments table
    const paymentParams = {
      user_id_param: user.id,
      workshop_id_param: profile.workshop_id,
      stripe_payment_intent_id_param: session.payment_intent as string,
      stripe_session_id_param: session.id,
      amount_cents_param: Math.round(amount), // Amount already in cents from Stripe
      currency_param: 'EUR',
      analysis_month_param: new Date().toISOString().slice(0, 7), // YYYY-MM
      analyses_purchased_param: 1,
      unit_price_cents_param: Math.round(amount), // Amount already in cents from Stripe
      description_param: description || 'Análisis adicional',
      stripe_customer_id_param: customer.id
    }
    
    const { data: paymentId, error: dbError } = await supabaseClient
      .rpc('create_payment_record', paymentParams)

    if (dbError) {
      throw new Error('Failed to store payment record: ' + dbError.message)
    }

    return new Response(
      JSON.stringify({
        url: session.url,
        session_id: session.id,
        payment_intent_id: session.payment_intent
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error creating payment session:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})