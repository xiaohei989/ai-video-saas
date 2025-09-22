#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// 模板配置文件目录
const templatesDir = 'src/features/video-creator/data/templates';

// 获取所有 JSON 文件
const templateFiles = fs.readdirSync(templatesDir).filter(file => file.endsWith('.json'));

console.log('🔍 检查所有模板的缩略图配置...\n');

const problems = [];

templateFiles.forEach(filename => {
  const filepath = path.join(templatesDir, filename);
  const templateName = filename.replace('.json', '');
  
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const template = JSON.parse(content);
    
    const hasThumbnailUrl = template.thumbnailUrl && template.thumbnailUrl.trim();
    const hasBlurThumbnailUrl = template.blurThumbnailUrl && template.blurThumbnailUrl.trim();
    
    if (!hasThumbnailUrl) {
      problems.push({
        template: templateName,
        issue: '缺少 thumbnailUrl',
        severity: 'error'
      });
    }
    
    if (!hasBlurThumbnailUrl) {
      problems.push({
        template: templateName,
        issue: '缺少 blurThumbnailUrl',
        severity: 'warning'
      });
    }
    
    // 显示状态
    const thumbnailStatus = hasThumbnailUrl ? '✅' : '❌';
    const blurStatus = hasBlurThumbnailUrl ? '✅' : '⚠️';
    
    console.log(`${thumbnailStatus} ${blurStatus} ${templateName}`);
    
    if (hasThumbnailUrl) {
      console.log(`   📷 ${template.thumbnailUrl}`);
    }
    if (hasBlurThumbnailUrl) {
      console.log(`   🌫️  ${template.blurThumbnailUrl}`);
    }
    
    console.log('');
    
  } catch (error) {
    problems.push({
      template: templateName,
      issue: `JSON解析错误: ${error.message}`,
      severity: 'error'
    });
    console.log(`❌ ${templateName} - JSON解析错误: ${error.message}\n`);
  }
});

// 汇总报告
console.log('\n📊 检查结果汇总:');
console.log(`总模板数: ${templateFiles.length}`);
console.log(`有问题的: ${problems.length}`);

if (problems.length > 0) {
  console.log('\n🚨 发现的问题:');
  
  const errors = problems.filter(p => p.severity === 'error');
  const warnings = problems.filter(p => p.severity === 'warning');
  
  if (errors.length > 0) {
    console.log('\n❌ 错误 (必须修复):');
    errors.forEach(p => console.log(`   ${p.template}: ${p.issue}`));
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️ 警告 (建议修复):');
    warnings.forEach(p => console.log(`   ${p.template}: ${p.issue}`));
  }
} else {
  console.log('\n🎉 所有模板配置都正常！');
}