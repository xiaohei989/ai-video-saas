#!/usr/bin/env node

console.log('🗑️ 清理NewImageCache低质量缓存')
console.log('=' .repeat(50))

// 创建清理页面，通过浏览器环境清理
const clearCacheHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>清理NewImageCache缓存</title>
</head>
<body>
    <h1>清理NewImageCache缓存</h1>
    <div id="status">正在清理...</div>
    
    <script>
        (async () => {
            const status = document.getElementById('status');
            let clearedCount = 0;
            
            try {
                // 清理所有可能的IndexedDB数据库
                const dbNames = [
                    'unified-cache-v1',
                    'unified-cache', 
                    'image-cache',
                    'template-cache',
                    'thumbnail-cache',
                    'newImageCache',
                    'keyval-store'
                ];
                
                status.innerHTML = '🔄 清理IndexedDB数据库...<br>';
                
                for (const dbName of dbNames) {
                    try {
                        await new Promise((resolve, reject) => {
                            const deleteReq = indexedDB.deleteDatabase(dbName);
                            deleteReq.onerror = () => reject(deleteReq.error);
                            deleteReq.onsuccess = () => resolve();
                            deleteReq.onblocked = () => setTimeout(resolve, 1000);
                            setTimeout(() => reject(new Error('timeout')), 5000);
                        });
                        
                        status.innerHTML += '✅ 已删除: ' + dbName + '<br>';
                        clearedCount++;
                    } catch (error) {
                        status.innerHTML += '⚠️ 清理: ' + dbName + ' (' + error.message + ')<br>';
                    }
                }
                
                // 清理localStorage中的图片缓存相关项
                status.innerHTML += '<br>🔄 清理localStorage...<br>';
                const keys = Object.keys(localStorage);
                let localStorageCleared = 0;
                
                keys.forEach(key => {
                    if (key.includes('img_') || 
                        key.includes('image') || 
                        key.includes('thumbnail') || 
                        key.includes('template') ||
                        key.includes('cache')) {
                        localStorage.removeItem(key);
                        localStorageCleared++;
                    }
                });
                
                status.innerHTML += '✅ 清理localStorage项: ' + localStorageCleared + '个<br>';
                
                // 清理sessionStorage
                sessionStorage.clear();
                status.innerHTML += '✅ 清理sessionStorage<br>';
                
                // 强制垃圾回收（如果支持）
                if (window.gc) {
                    window.gc();
                    status.innerHTML += '✅ 执行垃圾回收<br>';
                }
                
                status.innerHTML += '<br><h2>🎉 清理完成</h2>';
                status.innerHTML += '<p>已清理IndexedDB数据库: ' + clearedCount + '个</p>';
                status.innerHTML += '<p>已清理localStorage项: ' + localStorageCleared + '个</p>';
                status.innerHTML += '<p><strong>建议刷新页面或重启浏览器以确保完全清理</strong></p>';
                
                console.log('NewImageCache缓存清理完成');
                
            } catch (error) {
                status.innerHTML += '<br><div style="color:red">❌ 清理过程出错: ' + error.message + '</div>';
                console.error('清理失败:', error);
            }
        })();
    </script>
</body>
</html>
`;

// 写入HTML文件
import fs from 'fs';
import path from 'path';

const htmlPath = path.join(process.cwd(), 'clear-new-image-cache.html');
fs.writeFileSync(htmlPath, clearCacheHTML);

console.log('✅ 清理页面已创建: clear-new-image-cache.html')
console.log('📋 请用浏览器打开此文件执行清理:')
console.log('   file://' + htmlPath)
console.log()
console.log('🎯 此工具将清理:')
console.log('   - 所有NewImageCache相关的IndexedDB数据库')
console.log('   - localStorage中的图片缓存项')
console.log('   - sessionStorage中的所有数据')
console.log('   - 强制执行垃圾回收')
console.log()
console.log('⚠️ 清理完成后建议:')
console.log('   1. 刷新所有页面')
console.log('   2. 重启浏览器')
console.log('   3. 重新访问应用以使用新的专业级配置')