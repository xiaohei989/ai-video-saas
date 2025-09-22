#!/usr/bin/env node

/**
 * CachedImage 调试脚本
 * 模拟 generateImageUrls 函数的执行过程
 */

// 模拟模板缩略图URL
const originalUrl = "https://cdn.veo3video.me/templates/thumbnails/art-coffee-machine-thumbnail.jpg";

console.log("🔍 CachedImage 执行流程调试");
console.log("==========================================");

// 模拟 generateImageUrls 函数
function generateImageUrls(originalUrl) {
  console.log(`📊 generateImageUrls调用:`, {
    originalUrl: originalUrl.substring(0, 80) + '...',
    fastPreview: true
  });
  
  // 🔧 优化的CDN检测逻辑 - 更精确的匹配条件
  const urlChecks = {
    hasTemplatesPath: originalUrl.includes('/templates/thumbnails/'),
    hasCDNDomain: originalUrl.includes('cdn.veo3video.me'),
    hasApiPath: originalUrl.includes('/api/'),
    hasSupabaseDomain: originalUrl.includes('supabase.co'),
    hasCloudflare: originalUrl.includes('cloudflare'),
    hasHttpProtocol: originalUrl.startsWith('http'),
    hasRelativePath: originalUrl.startsWith('/'),
    isValidImageUrl: /\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(originalUrl)
  };
  
  // 🚨 测试模式：暂时强制启用所有图片的模糊图功能
  const isCDNUrl = urlChecks.hasTemplatesPath || 
                   urlChecks.hasCDNDomain || 
                   urlChecks.hasSupabaseDomain ||
                   urlChecks.isValidImageUrl ||
                   true; // 🔧 强制启用用于测试
  
  console.log(`🔍 CDN检查 (优化版):`, {
    isCDNUrl,
    urlChecks,
    finalDecision: isCDNUrl ? '✅ 启用模糊图' : '❌ 跳过模糊图',
    url: originalUrl.substring(0, 80) + '...'
  });
  
  if (!isCDNUrl) {
    console.log(`❌ 非CDN URL，跳过模糊图逻辑`);
    return { final: originalUrl };
  }
  
  try {
    // 生成两级质量的URL
    const cleanUrl = originalUrl.split('?')[0]; // 移除查询参数
    
    // 安全处理URL路径 - 支持相对和绝对路径
    let path;
    
    if (cleanUrl.startsWith('/')) {
      // 相对路径：直接使用
      path = cleanUrl;
    } else if (cleanUrl.startsWith('http')) {
      // 绝对路径：提取pathname
      try {
        const url = new URL(cleanUrl);
        path = url.pathname;
      } catch (urlError) {
        console.warn(`无法解析绝对URL: ${cleanUrl}，回退到原始URL`);
        return { final: originalUrl };
      }
    } else {
      // 其他情况：假设为相对路径，添加前导斜杠
      path = '/' + cleanUrl;
    }
    
    // 确保路径格式正确
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    const result = {
      blur: `/cdn-cgi/image/w=150,q=20,blur=1,f=auto${path}`,   // 模糊图：立即显示
      final: `/cdn-cgi/image/w=400,q=75,f=auto${path}`          // 最终缩略图：高质量
    };
    
    console.log(`✅ 成功生成模糊图URLs:`, {
      originalUrl: originalUrl.substring(0, 60) + '...',
      path,
      blurUrl: result.blur,
      finalUrl: result.final,
      urlTransform: {
        original: originalUrl,
        cleaned: cleanUrl,
        extractedPath: path,
        blurTransform: 'w=150,q=20,blur=1,f=auto',
        finalTransform: 'w=400,q=75,f=auto'
      }
    });
    
    return result;
  } catch (error) {
    console.warn(`URL生成失败: ${originalUrl}，错误:`, error);
    // 发生任何错误时回退到原始URL
    return { final: originalUrl };
  }
}

// 执行测试
const urls = generateImageUrls(originalUrl);

console.log("\n🔄 模拟两级加载流程:");
console.log("==========================================");

// 阶段1：模糊图
if (urls.blur) {
  console.log(`🚀 阶段1 - 立即显示模糊图:`);
  console.log(`   URL: ${urls.blur}`);
  console.log(`   完整URL: https://cdn.veo3video.me${urls.blur}`);
  console.log(`   状态: setImageSrcToShow(${urls.blur})`);
  console.log(`   状态: setIsShowingBlur(true)`);
  console.log(`   状态: setIsLoading(false)`);
}

// 阶段2：最终图
if (urls.final) {
  console.log(`\n✨ 阶段2 - 后台加载最终图:`);
  console.log(`   URL: ${urls.final}`);
  console.log(`   完整URL: https://cdn.veo3video.me${urls.final}`);
  console.log(`   状态: 加载完成后 setImageSrcToShow(${urls.final})`);
  console.log(`   状态: setIsShowingBlur(false)`);
}

console.log("\n🎯 总结:");
console.log("==========================================");
console.log("✅ URL生成逻辑正常");
console.log("✅ 相对路径应该可以正常解析");
console.log("✅ 两级加载流程设计正确");
console.log("\n⚠️  潜在问题：");
console.log("1. 相对路径在某些环境下可能解析失败");
console.log("2. 环境变量 VITE_DISABLE_TEMPLATE_THUMBNAIL_CACHE=true 影响缓存");
console.log("3. 组件状态可能被其他逻辑覆盖");

console.log("\n🔧 建议检查点：");
console.log("1. 浏览器控制台是否有上述日志输出");
console.log("2. 相对路径是否能正确加载图片");
console.log("3. 组件是否有重复渲染或状态重置");