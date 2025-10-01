import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'
import { getStripeSecretKey, getEdgeStripeEnvironmentInfo } from '../_shared/stripe-config.ts'
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'

// 多语言翻译映射
const translations = {
  en: {
    credits: 'Credits',
    creditsDescription: 'Purchase {credits} credits for AI video generation'
  },
  zh: {
    credits: '积分',
    creditsDescription: '购买 {credits} 个积分用于生成AI视频'
  },
  ja: {
    credits: 'クレジット',
    creditsDescription: 'AI動画生成用の{credits}クレジットを購入'
  },
  ko: {
    credits: '크레딧',
    creditsDescription: 'AI 비디오 생성을 위한 {credits} 크레딧 구매'
  },
  es: {
    credits: 'Créditos',
    creditsDescription: 'Comprar {credits} créditos para generación de videos con IA'
  },
  fr: {
    credits: 'Crédits',
    creditsDescription: 'Acheter {credits} crédits pour la génération de vidéos IA'
  },
  de: {
    credits: 'Credits',
    creditsDescription: '{credits} Credits für KI-Videogenerierung kaufen'
  },
  ar: {
    credits: 'نقاط',
    creditsDescription: 'شراء {credits} نقطة لإنتاج فيديوهات الذكاء الاصطناعي'
  }
}

// 获取翻译文本
function getTranslation(language: string, key: string, params?: Record<string, any>): string {
  const lang = translations[language as keyof typeof translations] || translations.en
  let text = lang[key as keyof typeof lang] || translations.en[key as keyof typeof translations.en]
  
  if (params) {
    Object.entries(params).forEach(([paramKey, value]) => {
      text = text.replace(`{${paramKey}}`, value.toString())
    })
  }
  
  return text
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

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

    const requestBody = await req.json()
    console.log(`[CHECKOUT] 📝 请求参数:`, JSON.stringify(requestBody, null, 2))
    
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
      type = 'subscription',
      language = 'en'  // 添加语言参数，默认英语
    } = requestBody
    
    // 验证通用必要参数
    if (!userId) {
      console.error('[CHECKOUT] ❌ 缺少 userId 参数')
      throw new Error('Missing required parameter: userId')
    }
    if (!successUrl) {
      console.error('[CHECKOUT] ❌ 缺少 successUrl 参数')
      throw new Error('Missing required parameter: successUrl')
    }
    if (!cancelUrl) {
      console.error('[CHECKOUT] ❌ 缺少 cancelUrl 参数')
      throw new Error('Missing required parameter: cancelUrl')
    }
    
    // 根据模式验证特定参数
    if (mode === 'subscription') {
      if (!priceId) {
        console.error('[CHECKOUT] ❌ 订阅模式缺少 priceId 参数')
        throw new Error('Missing required parameter: priceId for subscription mode')
      }
      if (!planId) {
        console.error('[CHECKOUT] ❌ 订阅模式缺少 planId 参数')
        throw new Error('Missing required parameter: planId for subscription mode')
      }
    } else if (mode === 'payment') {
      if (!amount || amount <= 0) {
        console.error('[CHECKOUT] ❌ 积分购买模式缺少 amount 参数或金额无效')
        throw new Error('Missing or invalid parameter: amount for payment mode')
      }
      if (!credits || credits <= 0) {
        console.error('[CHECKOUT] ❌ 积分购买模式缺少 credits 参数或积分无效')
        throw new Error('Missing or invalid parameter: credits for payment mode')
      }
    }
    
    console.log(`[CHECKOUT] ✅ 参数验证通过: mode=${mode}, userId=${userId}, language=${language}${mode === 'subscription' ? `, priceId=${priceId}, planId=${planId}` : `, amount=${amount}, credits=${credits}`}`)
    
    // 多语言调试信息
    if (mode === 'payment') {
      console.log(`[CHECKOUT] 🌍 积分购买多语言信息:`, {
        originalLanguage: language,
        detectedLang: translations[language as keyof typeof translations] ? language : 'fallback-to-en',
        productName: `${credits} ${getTranslation(language, 'credits')}`,
        description: getTranslation(language, 'creditsDescription', { credits }),
        availableLanguages: Object.keys(translations)
      })
      
      // 特别调试日语
      if (language === 'ja') {
        console.log(`[CHECKOUT] 🇯🇵 日语特别调试:`, {
          jaCredits: translations.ja.credits,
          jaDescription: translations.ja.creditsDescription,
          finalProductName: `${credits} ${getTranslation('ja', 'credits')}`,
          finalDescription: getTranslation('ja', 'creditsDescription', { credits })
        })
      }
    }

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
                name: `${credits} ${getTranslation(language, 'credits')}`,
                description: getTranslation(language, 'creditsDescription', { credits }),
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
    console.error('[CHECKOUT] ❌ 发生错误:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
    })

    // 返回更详细的错误信息用于调试
    return new Response(
      JSON.stringify({
        error: error.message,
        errorName: error.name,
        details: `Checkout session creation failed: ${error.message}`,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})