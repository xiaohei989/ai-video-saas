#!/usr/bin/env node

// 获取Edge Function日志的脚本
async function getFunctionLogs() {
  const projectRef = 'hvkzwrnvxsleeonqqrzq';
  const accessToken = 'sbp_bce3f20e1be1fe5cab227066d5b9567973cb46bb';
  
  // 使用Supabase Management API获取日志
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/functions/create-checkout-session/invocations`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (response.ok) {
    const logs = await response.json();
    console.log('📋 Edge Function 调用日志:');
    console.log(JSON.stringify(logs, null, 2));
  } else {
    console.error('❌ 获取日志失败:', response.status, response.statusText);
    const errorText = await response.text();
    console.error('错误详情:', errorText);
  }
}

getFunctionLogs().catch(console.error);