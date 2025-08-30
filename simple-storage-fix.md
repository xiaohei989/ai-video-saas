# 快速修复 Storage 上传权限问题

## 方法1：通过UI界面修复（推荐）

### 步骤：

1. **登录 Supabase Dashboard**
2. **进入 Storage → avatars bucket**
3. **点击 Policies 标签**
4. **删除所有现有策略**（点击每个策略旁边的垃圾桶图标）
5. **创建新策略**：

### 使用快速模板创建策略

点击 **New Policy** → **Get started quickly**

选择模板：**Give users access to their own folder**

这会自动创建正确的策略，允许用户：
- 查看所有头像
- 上传到自己的文件夹
- 更新自己的文件
- 删除自己的文件

## 方法2：简化的策略（最宽松，用于测试）

如果上面的方法还是不行，可以创建最简单的策略：

1. **新建策略**
2. **选择 "For full customization"**
3. **创建以下策略**：

**策略1 - 允许所有操作（仅用于测试）**
- Policy name: `Allow all for authenticated users`
- Allowed operation: 选择所有（SELECT, INSERT, UPDATE, DELETE）
- Target roles: `authenticated`
- WITH CHECK: `true`
- USING: `true`

## 方法3：执行SQL脚本

在 SQL Editor 中执行 `fix-storage-policies.sql` 文件内容。

## 验证修复

修复后测试：
1. 刷新页面
2. 重新登录
3. 尝试上传头像

## 如果还是失败

检查以下几点：

1. **确认bucket存在**
   - Storage页面应该能看到 `avatars` bucket

2. **确认bucket是public**
   - bucket设置中 "Public bucket" 应该是开启的

3. **检查文件路径**
   - 上传路径格式应该是：`{user_id}/avatar-{timestamp}.{ext}`

4. **查看具体错误**
   - 打开浏览器开发者工具
   - Network标签查看失败的请求
   - 查看响应详情

## 临时解决方案

如果急需使用，可以暂时禁用RLS（不推荐生产环境）：

```sql
-- 临时禁用avatars bucket的RLS（仅用于测试）
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
```

记得测试完后重新启用：

```sql
-- 重新启用RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```