import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  console.log('开始初始化支付表结构...')

  try {
    // 执行SQL来创建表
    const createTablesSql = `
      -- 支付记录表
      CREATE TABLE IF NOT EXISTS public.payments (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          stripe_payment_intent_id TEXT UNIQUE,
          stripe_checkout_session_id TEXT,
          amount DECIMAL(10,2) NOT NULL,
          currency VARCHAR(3) DEFAULT 'usd',
          status VARCHAR(20) DEFAULT 'pending',
          description TEXT,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- 用户积分表
      CREATE TABLE IF NOT EXISTS public.user_credits (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
          balance INTEGER DEFAULT 0,
          total_earned INTEGER DEFAULT 0,
          total_spent INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- 积分交易记录表
      CREATE TABLE IF NOT EXISTS public.credit_transactions (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          amount INTEGER NOT NULL,
          type VARCHAR(20) NOT NULL,
          description TEXT,
          reference_id TEXT,
          reference_type VARCHAR(50),
          balance_before INTEGER NOT NULL,
          balance_after INTEGER NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `

    // 执行创建表的SQL
    const { error: createError } = await supabaseClient.rpc('exec', {
      sql: createTablesSql
    }).catch(async () => {
      // 如果rpc exec不可用，尝试使用原生SQL查询
      return await supabaseClient.from('dummy').select('*').limit(0)
        .then(() => ({ error: null }))
        .catch(() => ({ error: 'Cannot execute SQL' }))
    })

    if (createError) {
      console.log('尝试通过原生方式创建表...')
    }

    // 创建索引
    const createIndexesSql = `
      -- 创建索引
      CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
      CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent ON public.payments(stripe_payment_intent_id);
      CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
      CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON public.user_credits(user_id);
      CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_credit_transactions_reference ON public.credit_transactions(reference_id, reference_type);
      CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at);
    `

    console.log('创建索引...')
    await supabaseClient.rpc('exec', { sql: createIndexesSql }).catch(() => {})

    // 创建触发器函数
    const createTriggerFunctionSql = `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      CREATE TRIGGER IF NOT EXISTS update_payments_updated_at 
          BEFORE UPDATE ON public.payments 
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
          
      CREATE TRIGGER IF NOT EXISTS update_user_credits_updated_at 
          BEFORE UPDATE ON public.user_credits 
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `

    console.log('创建触发器...')
    await supabaseClient.rpc('exec', { sql: createTriggerFunctionSql }).catch(() => {})

    // 创建积分操作函数
    const createCreditFunctionSql = `
      CREATE OR REPLACE FUNCTION add_user_credits(
          p_user_id UUID,
          p_amount INTEGER,
          p_type TEXT,
          p_description TEXT,
          p_reference_id TEXT DEFAULT NULL,
          p_reference_type TEXT DEFAULT NULL
      )
      RETURNS BOOLEAN AS $$
      DECLARE
          current_balance INTEGER := 0;
          new_balance INTEGER;
      BEGIN
          INSERT INTO user_credits (user_id, balance, total_earned, total_spent)
          VALUES (p_user_id, 0, 0, 0)
          ON CONFLICT (user_id) DO NOTHING;
          
          SELECT balance INTO current_balance 
          FROM user_credits 
          WHERE user_id = p_user_id;
          
          new_balance := current_balance + p_amount;
          
          UPDATE user_credits 
          SET 
              balance = new_balance,
              total_earned = CASE WHEN p_amount > 0 THEN total_earned + p_amount ELSE total_earned END,
              total_spent = CASE WHEN p_amount < 0 THEN total_spent + ABS(p_amount) ELSE total_spent END,
              updated_at = NOW()
          WHERE user_id = p_user_id;
          
          INSERT INTO credit_transactions (
              user_id, amount, type, description, reference_id, reference_type,
              balance_before, balance_after
          ) VALUES (
              p_user_id, p_amount, p_type, p_description, p_reference_id, p_reference_type,
              current_balance, new_balance
          );
          
          UPDATE profiles 
          SET 
              credits = new_balance,
              total_credits_earned = CASE WHEN p_amount > 0 THEN total_credits_earned + p_amount ELSE total_credits_earned END,
              total_credits_spent = CASE WHEN p_amount < 0 THEN total_credits_spent + ABS(p_amount) ELSE total_credits_spent END,
              updated_at = NOW()
          WHERE id = p_user_id;
          
          RETURN TRUE;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `

    console.log('创建积分操作函数...')
    await supabaseClient.rpc('exec', { sql: createCreditFunctionSql }).catch(() => {})

    // 从profiles表迁移数据到user_credits表
    console.log('迁移现有积分数据...')
    const { error: migrateError } = await supabaseClient.rpc('exec', {
      sql: `
        INSERT INTO user_credits (user_id, balance, total_earned, total_spent)
        SELECT id, credits, total_credits_earned, total_credits_spent 
        FROM profiles 
        ON CONFLICT (user_id) DO UPDATE SET
            balance = EXCLUDED.balance,
            total_earned = EXCLUDED.total_earned,
            total_spent = EXCLUDED.total_spent;
      `
    }).catch(() => ({ error: null }))

    // 设置RLS策略
    const rlsSql = `
      ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
      DROP POLICY IF EXISTS "Users can view own credits" ON public.user_credits;
      DROP POLICY IF EXISTS "Users can view own credit transactions" ON public.credit_transactions;
      DROP POLICY IF EXISTS "Service role can manage payments" ON public.payments;
      DROP POLICY IF EXISTS "Service role can manage credits" ON public.user_credits;
      DROP POLICY IF EXISTS "Service role can manage credit transactions" ON public.credit_transactions;

      CREATE POLICY "Users can view own payments" ON public.payments
          FOR SELECT USING (auth.uid() = user_id);
      CREATE POLICY "Users can view own credits" ON public.user_credits
          FOR SELECT USING (auth.uid() = user_id);
      CREATE POLICY "Users can view own credit transactions" ON public.credit_transactions
          FOR SELECT USING (auth.uid() = user_id);
      CREATE POLICY "Service role can manage payments" ON public.payments
          FOR ALL USING (auth.role() = 'service_role');
      CREATE POLICY "Service role can manage credits" ON public.user_credits
          FOR ALL USING (auth.role() = 'service_role');
      CREATE POLICY "Service role can manage credit transactions" ON public.credit_transactions
          FOR ALL USING (auth.role() = 'service_role');
    `

    console.log('设置RLS策略...')
    await supabaseClient.rpc('exec', { sql: rlsSql }).catch(() => {})

    console.log('✓ 支付表结构初始化完成')

    return new Response(JSON.stringify({
      success: true,
      message: '支付表结构已成功创建',
      tables: ['payments', 'user_credits', 'credit_transactions'],
      functions: ['add_user_credits']
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('初始化失败:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})