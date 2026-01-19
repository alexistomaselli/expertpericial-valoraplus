// @ts-nocheck
// Edge Function for calculating next analysis cost - runs in Deno environment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
          headers: { Authorization: req.headers.get('Authorization') ?? '' },
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

    // Get monthly usage information
    const { data: usageData, error: usageError } = await supabaseClient
      .rpc('get_current_monthly_usage')

    if (usageError) {
      console.error('Error getting monthly usage:', usageError)
      throw new Error('Failed to get monthly usage')
    }

    // Get system settings for billing
    const { data: billingEnabled } = await supabaseClient
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'billing_enabled')
      .single()

    const { data: additionalPrice } = await supabaseClient
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'additional_analysis_price')
      .single()

    const isBillingEnabled = billingEnabled?.setting_value?.value === true
    const price = parseFloat(additionalPrice?.setting_value?.value || '0')

    // Calculate if next analysis is free
    const freeAnalysesUsed = usageData?.free_analyses_used || 0
    const freeAnalysesLimit = usageData?.free_analyses_limit || 0
    const totalAnalyses = usageData?.total_analyses || 0
    const isNextAnalysisFree = totalAnalyses < freeAnalysesLimit

    // Determine cost
    let cost = 0
    if (!isNextAnalysisFree && isBillingEnabled) {
      cost = price
    }

    return new Response(
      JSON.stringify({
        cost,
        is_free: isNextAnalysisFree,
        billing_enabled: isBillingEnabled,
        free_analyses_used: freeAnalysesUsed,
        total_analyses: totalAnalyses,
        free_analyses_limit: freeAnalysesLimit,
        additional_analysis_price: price
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error getting next analysis cost:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})