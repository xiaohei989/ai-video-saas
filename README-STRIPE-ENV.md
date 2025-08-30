# Stripe环境一键切换使用指南

## 概述

本系统提供了完整的Stripe测试/生产环境一键切换解决方案，支持前端、后端和Supabase Edge Functions的统一配置管理。

## 特性

- ✅ 一键切换测试/生产环境
- ✅ 自动验证密钥格式和环境一致性  
- ✅ 安全的生产环境切换（需要确认）
- ✅ 支持Supabase Edge Functions自动部署
- ✅ 配置快照文件管理
- ✅ 详细的状态显示和错误提示

## 文件结构

```
├── .env                    # 主配置文件，包含所有环境的密钥
├── .env.test              # 测试环境快照
├── .env.production        # 生产环境快照
├── scripts/
│   ├── switch-stripe-env.js    # 环境切换脚本
│   └── deploy-stripe-env.js    # Supabase部署脚本
├── src/config/
│   └── stripe-env.ts          # 前端配置管理
└── supabase/functions/_shared/
    └── stripe-config.ts       # Edge Functions配置管理
```

## 使用方法

### 1. 查看当前状态

```bash
npm run stripe:status
```

显示：
- 当前环境模式（测试/生产）
- 使用的密钥和价格ID
- 配置验证结果
- 可用命令列表

### 2. 切换到测试环境

```bash
npm run stripe:test
```

自动：
- 更新环境模式为 `test`
- 切换到测试环境的密钥和价格ID
- 验证配置格式和一致性

### 3. 切换到生产环境

```bash
npm run stripe:prod -- --confirm
```

**注意**: 生产环境切换需要 `--confirm` 标志确认

自动：
- 更新环境模式为 `production`
- 切换到生产环境的密钥和价格ID
- 验证配置格式和一致性

### 4. 部署到Supabase

#### 部署测试环境配置

```bash
npm run stripe:deploy-test
```

#### 部署生产环境配置

```bash
npm run stripe:deploy-prod -- --confirm
```

**注意**: 生产环境部署需要 `--confirm` 标志确认

#### 查看Supabase部署状态

```bash
npm run stripe:deploy-status
```

## 环境配置

### 测试环境配置

- **公钥**: `pk_test_51RLf1pGBOWryw3zI...`
- **私钥**: `sk_test_51RLf1pGBOWryw3zI...` 
- **Webhook密钥**: `whsec_FM8Mo60uVNfF350xIIaC2gSHt3O66F5D`
- **基础版价格**: `price_1S0DRpGBOWryw3zINE9dAMkH`
- **专业版价格**: `price_1S0DSRGBOWryw3zIhUvxPGv5`
- **企业版价格**: `price_1S0DT6GBOWryw3zIDi08pwgl`

### 生产环境配置

- **公钥**: `pk_live_51RLf1pGBOWryw3zI...`
- **私钥**: `sk_live_51RLf1pGBOWryw3zI...`
- **Webhook密钥**: `whsec_GhZUbVo8e6qiNp5nFbGuYz0KpJczmGUN`
- **基础版价格**: `price_1S0BmlGBOWryw3zITXUXsKsi`
- **专业版价格**: `price_1S0BnFGBOWryw3zl2Jtc9E9A`
- **企业版价格**: `price_1S0BoVGBOWryw3zIlxR8wwhr`

## 配置验证

系统会自动验证：

- ✅ 密钥格式正确性（pk_/sk_/whsec_ 前缀）
- ✅ 测试/生产环境密钥一致性
- ✅ 价格ID格式正确性
- ✅ 环境模式与密钥类型匹配

## 安全措施

1. **生产环境确认**: 所有生产环境操作都需要 `--confirm` 标志
2. **密钥验证**: 自动验证密钥格式和环境一致性
3. **配置分离**: 测试和生产密钥完全分离存储
4. **快照备份**: 配置快照文件便于恢复

## 工作流程

### 开发阶段
```bash
npm run stripe:test              # 切换到测试环境
npm run stripe:deploy-test       # 部署测试配置到Supabase
# 开发和测试...
```

### 发布阶段
```bash
npm run stripe:status            # 确认当前状态
npm run stripe:prod -- --confirm # 切换到生产环境  
npm run stripe:deploy-prod -- --confirm # 部署生产配置到Supabase
```

### 回滚到测试
```bash
npm run stripe:test              # 立即切换回测试环境
npm run stripe:deploy-test       # 恢复测试配置到Supabase
```

## 故障排除

### 配置验证失败

如果看到配置验证失败：

1. 检查密钥格式是否正确
2. 确认测试/生产密钥类型匹配
3. 验证价格ID格式

### Supabase部署失败

如果部署到Supabase失败：

1. 检查Supabase CLI版本和权限
2. 确认项目引用ID正确
3. 验证访问令牌有效

### Webhook不工作

如果webhook回调不工作：

1. 确认Stripe Dashboard中webhook端点配置正确
2. 检查webhook密钥是否匹配
3. 查看Supabase Edge Functions日志

## 重要提醒

1. **生产环境操作**: 永远小心处理生产环境配置，确保在非业务时间进行切换
2. **配置备份**: 在进行重要操作前备份当前配置
3. **验证测试**: 切换后进行完整的支付流程测试
4. **监控日志**: 密切关注Edge Functions和应用日志

## 支持

如有问题，请检查：
- 配置文件格式是否正确
- Stripe Dashboard中的密钥和价格ID
- Supabase项目配置和权限
- 应用日志和错误信息