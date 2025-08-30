import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'
import { getStripeSecretKey, getEdgeStripeEnvironmentInfo } from '../_shared/stripe-config.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // 验证用户身份
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const stripe = new Stripe(getStripeSecretKey(), {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })
    
    // 打印环境信息用于调试
    const envInfo = getEdgeStripeEnvironmentInfo()
    console.log(`[CHECKOUT] 🔧 运行环境: ${envInfo.environment}`)

    const { 
      priceId, 
      amount,
      currency = 'usd',
      userId, 
      planId, 
      credits,
      successUrl, 
      cancelUrl, 
      mode = 'subscription',
      type = 'subscription'
    } = await req.json()

    // 获取或创建Stripe客户
    let customer
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', userId)
      .single()

    if (profile?.stripe_customer_id) {
      customer = await stripe.customers.retrieve(profile.stripe_customer_id)
    } else {
      customer = await stripe.customers.create({
        email: profile?.email || user.email || '',
        metadata: {
          supabase_user_id: userId,
        },
      })

      // 保存客户ID到数据库
      await supabaseClient
        .from('profiles')
        .update({ stripe_customer_id: customer.id })
        .eq('id', userId)
    }

    let sessionConfig: any = {
      customer: customer.id,
      success_url: successUrl,
      cancel_url: cancelUrl,
      payment_method_types: ['card'],
      metadata: {
        user_id: userId,
        type,
      }
    }

    if (mode === 'subscription') {
      // 订阅模式
      sessionConfig = {
        ...sessionConfig,
        mode: 'subscription',
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        subscription_data: {
          metadata: {
            user_id: userId,
            plan_id: planId,
          },
        },
      }
    } else {
      // 一次性支付模式（积分购买）
      sessionConfig = {
        ...sessionConfig,
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: `${credits} 积分`,
                description: `购买 ${credits} 个积分用于生成AI视频`,
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          metadata: {
            user_id: userId,
            credits: credits.toString(),
            type: 'credit_purchase',
          },
        },
      }
    }

    const session = await stripe.checkout.sessions.create(sessionConfig)

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})