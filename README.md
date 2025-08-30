# AI Video SaaS Platform

基于AI的视频生成SaaS服务平台，使用Google Veo3 API生成视频。

## 技术栈

- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite
- **UI组件**: Shadcn UI (待安装)
- **样式**: Tailwind CSS (待安装)
- **数据库**: Supabase (待配置)
- **支付**: Stripe (待集成)
- **视频生成**: Google Veo3 API

## 项目结构

```
ai-video-saas/
├── src/
│   ├── components/       # React组件
│   │   ├── layout/       # 布局组件
│   │   ├── templates/    # 模板相关组件
│   │   ├── video/        # 视频相关组件
│   │   ├── auth/         # 认证组件
│   │   ├── payment/      # 支付组件
│   │   └── common/       # 通用组件
│   ├── services/         # API服务
│   ├── hooks/            # 自定义Hooks
│   ├── utils/            # 工具函数
│   ├── types/            # TypeScript类型定义
│   ├── pages/            # 页面组件
│   ├── styles/           # 样式文件
│   └── assets/           # 静态资源
├── public/               # 公共资源
├── .env.example          # 环境变量示例
├── tsconfig.json         # TypeScript配置
├── vite.config.ts        # Vite配置
└── package.json          # 项目依赖
```

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 类型检查
npm run type-check
```

## 环境变量

复制 `.env.example` 到 `.env` 并填写相应的配置：

```bash
cp .env.example .env
```

## 下一步

1. 安装和配置Tailwind CSS和Shadcn UI
2. 配置Supabase数据库
3. 实现用户认证系统
4. 集成Google Veo3 API
5. 实现支付系统