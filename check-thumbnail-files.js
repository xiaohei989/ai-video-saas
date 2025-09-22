#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// 模板配置文件目录
const templatesDir = 'src/features/video-creator/data/templates';
const thumbnailsDir = 'public/templates/thumbnails';

// 获取所有 JSON 文件
const templateFiles = fs.readdirSync(templatesDir).filter(file => file.endsWith('.json'));

console.log('🔍 检查所有缩略图文件是否存在...\n');

const missingFiles = [];
const existingFiles = [];

templateFiles.forEach(filename => {
  const filepath = path.join(templatesDir, filename);
  const templateName = filename.replace('.json', '');
  
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const template = JSON.parse(content);
    
    // 从URL提取文件名
    const thumbnailUrl = template.thumbnailUrl;
    const blurThumbnailUrl = template.blurThumbnailUrl;
    
    if (thumbnailUrl) {
      const thumbnailFilename = thumbnailUrl.split('/').pop();
      const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename);
      
      if (fs.existsSync(thumbnailPath)) {
        existingFiles.push({ template: templateName, file: thumbnailFilename, type: 'normal' });
        console.log(`✅ ${templateName} - ${thumbnailFilename}`);
      } else {
        missingFiles.push({ template: templateName, file: thumbnailFilename, type: 'normal' });
        console.log(`❌ ${templateName} - ${thumbnailFilename} (文件不存在)`);
      }
    }
    
    if (blurThumbnailUrl) {
      const blurFilename = blurThumbnailUrl.split('/').pop();
      const blurPath = path.join(thumbnailsDir, blurFilename);
      
      if (fs.existsSync(blurPath)) {
        existingFiles.push({ template: templateName, file: blurFilename, type: 'blur' });
        console.log(`✅ ${templateName} - ${blurFilename}`);
      } else {
        missingFiles.push({ template: templateName, file: blurFilename, type: 'blur' });
        console.log(`❌ ${templateName} - ${blurFilename} (文件不存在)`);
      }
    }
    
    console.log('');
    
  } catch (error) {
    console.log(`❌ ${templateName} - JSON解析错误: ${error.message}\n`);
  }
});

// 汇总报告
console.log('\n📊 文件检查结果汇总:');
console.log(`存在的文件: ${existingFiles.length}`);
console.log(`缺失的文件: ${missingFiles.length}`);

if (missingFiles.length > 0) {
  console.log('\n🚨 缺失的文件列表:');
  missingFiles.forEach(item => {
    console.log(`   ${item.template} - ${item.file} (${item.type})`);
  });
  
  console.log('\n💡 建议解决方案:');
  console.log('1. 检查本地是否有类似名称的文件可以复制重命名');
  console.log('2. 从其他位置获取缺失的缩略图文件');
  console.log('3. 生成新的缩略图文件');
} else {
  console.log('\n🎉 所有缩略图文件都存在！');
}