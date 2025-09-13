#!/usr/bin/env node

// 测试日语支付参数的脚本
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hvkzwrnvxsleeonqqrzq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testJapanesePayment() {
  console.log('🇰🇷 테스트 한국어 결제 파라미터 전달...');
  
  try {
    // 模拟一个假的用户token（测试参数传递逻辑）
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      headers: {
        'Authorization': 'Bearer fake-token-for-testing'
      },
      body: {
        amount: 4999, // $49.99 in cents
        currency: 'usd',
        userId: 'test-user-id',
        credits: 1000,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        mode: 'payment',
        type: 'credit_purchase',
        language: 'ko'  // 명확하게 한국어 파라미터 전달
      }
    });

    if (error) {
      console.error('❌ Edge Function 错误:', error);
      
      // 尝试获取详细错误信息
      if (error.context && error.context.body) {
        try {
          const errorBody = await error.context.text();
          console.log('🔍 错误详情:', errorBody);
        } catch (e) {
          console.log('🔍 无法解析错误详情');
        }
      }
    } else {
      console.log('✅ Edge Function 响应:', data);
    }
  } catch (err) {
    console.error('❌ 请求异常:', err.message);
  }
}

testJapanesePayment();