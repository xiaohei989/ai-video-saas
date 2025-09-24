# Supabase 凭据配置指南

本项目现在支持通过 `.env` 文件统一管理所有 Supabase 凭据，包括数据库密码和 Access Token。

## 配置项说明

### 已添加到 .env 的新配置

```bash
# Supabase Access Token (用于 CLI 操作)
SUPABASE_ACCESS_TOKEN=sbp_bce3f20e1be1fe5cab227066d5b9567973cb46bb

# Supabase 数据库密码 (用于直接数据库连接)
SUPABASE_DATABASE_PASSWORD=huixiangyigou2025!
```

### 现有的 Supabase 配置

```bash
# Supabase 项目配置
VITE_SUPABASE_URL=https://hvkzwrnvxsleeonqqrzq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 使用方式

### 1. 自动读取环境变量

所有脚本现在会优先从环境变量读取配置：

```bash
# 直接运行，会自动读取 .env 文件中的 SUPABASE_ACCESS_TOKEN
./setup-redis-credentials.sh <REDIS_URL> <REDIS_TOKEN>

# 运行部署脚本
./deploy-redis-functions.sh

# Node.js 脚本
node scripts/deploy-stripe-env.js test
```

### 2. 手动指定（备用方式）

如果需要临时使用不同的凭据：

```bash
# 临时覆盖 Access Token
SUPABASE_ACCESS_TOKEN=your_custom_token ./deploy-redis-functions.sh

# 或者导出环境变量
export SUPABASE_ACCESS_TOKEN=your_custom_token
./setup-redis-credentials.sh <REDIS_URL> <REDIS_TOKEN>
```

### 3. 直接数据库连接

使用数据库密码进行直接连接：

```bash
# 使用环境变量中的密码
PGPASSWORD=$SUPABASE_DATABASE_PASSWORD psql -h aws-1-us-west-1.pooler.supabase.com -U postgres.hvkzwrnvxsleeonqqrzq -d postgres

# 或者直接使用
PGPASSWORD=huixiangyigou2025! psql -h aws-1-us-west-1.pooler.supabase.com -U postgres.hvkzwrnvxsleeonqqrzq -d postgres
```

## 已更新的文件

### 脚本文件
- ✅ `setup-redis-credentials.sh` - 现在从环境变量读取 Access Token
- ✅ `deploy-redis-functions.sh` - 优先使用环境变量
- ✅ `scripts/deploy-stripe-env.js` - 支持环境变量配置

### 配置文件
- ✅ `.env` - 添加了新的凭据配置
- ✅ `.env.example` - 添加了示例配置

## 安全建议

1. **不要将 .env 文件提交到版本控制**
   - 确保 `.env` 在 `.gitignore` 中

2. **定期轮换凭据**
   - Access Token 可在 Supabase Dashboard 中重新生成
   - 数据库密码可在项目设置中修改

3. **团队协作**
   - 使用 `.env.example` 作为模板
   - 每个开发者维护自己的 `.env` 文件

4. **生产环境**
   - 在服务器上设置环境变量
   - 不要在生产环境中使用 `.env` 文件

## 故障排除

### 权限错误
如果遇到权限错误，检查：
- Access Token 是否正确
- 是否有足够的权限执行操作

### 数据库连接错误
如果数据库连接失败，检查：
- 数据库密码是否正确
- 网络连接是否正常
- 项目引用 (hvkzwrnvxsleeonqqrzq) 是否正确

### 脚本执行错误
确保：
- 脚本有执行权限：`chmod +x script_name.sh`
- 所有依赖工具已安装 (supabase CLI, psql 等)