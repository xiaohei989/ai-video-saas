# 视频模板多语言翻译工具

这是一个用于批量处理视频模板多语言翻译的完整工具系统，支持 8 种语言的自动化翻译管理。

## 🌍 支持语言

- 🇺🇸 英语 (en) - 英文
- 🇨🇳 中文 (zh) - 中文
- 🇯🇵 日语 (ja) - 日文  
- 🇰🇷 韩语 (ko) - 韩文
- 🇪🇸 西班牙语 (es) - 西班牙文
- 🇩🇪 德语 (de) - 德文
- 🇫🇷 法语 (fr) - 法文
- 🇸🇦 阿拉伯语 (ar) - 阿拉伯文

## 📁 目录结构

```
src/tools/template-translation/
├── data/                           # 翻译数据文件
│   ├── terminology.json            # 专业术语翻译对照表
│   ├── translations-batch-1.json   # 第一批模板翻译
│   ├── translations-batch-2.json   # 第二批模板翻译
│   └── translations-batch-3.json   # 第三批模板翻译
├── engine/                         # 翻译处理引擎
│   ├── TemplateAnalyzer.ts        # 模板分析器
│   ├── TranslationProcessor.ts     # 翻译处理器
│   └── index.ts                    # 引擎入口
├── manager/                        # 翻译管理器
│   └── TranslationManager.ts       # 高级翻译管理功能
├── cli/                           # 命令行界面
│   └── TranslationCLI.ts          # CLI 工具
├── backups/                       # 备份目录（自动创建）
├── test-translation-system.ts     # 测试脚本
└── README.md                      # 说明文档
```

## 🚀 快速开始

### 1. 测试系统

首先运行测试脚本确保系统正常工作：

```bash
npx tsx src/tools/template-translation/test-translation-system.ts
```

### 2. 查看当前状态

```bash
npx tsx src/tools/template-translation/cli/TranslationCLI.ts status
```

### 3. 验证翻译数据

```bash
npx tsx src/tools/template-translation/cli/TranslationCLI.ts validate
```

### 4. 预览翻译效果

```bash
npx tsx src/tools/template-translation/cli/TranslationCLI.ts preview
```

### 5. 应用翻译（推荐先测试）

```bash
# 模拟运行（不修改文件）
npx tsx src/tools/template-translation/cli/TranslationCLI.ts apply --dry-run

# 实际应用翻译
npx tsx src/tools/template-translation/cli/TranslationCLI.ts apply
```

## 📊 功能特性

### 🔍 模板分析
- 自动检测模板是否已有多语言支持
- 提取所有可翻译字段
- 分析 promptTemplate 类型（字符串 vs JSON）
- 生成详细的分析报告

### 🌐 翻译处理
- 支持 8 种语言的完整翻译
- 专业术语一致性保证
- 智能字段映射和验证
- 批量翻译应用

### 🛡️ 安全保障
- 自动备份系统
- 干净的回滚机制
- 翻译数据验证
- 模拟模式测试

### 📈 管理工具
- 实时状态监控
- 翻译覆盖率统计
- 详细的处理报告
- 命令行界面

## 🔧 CLI 命令详解

### `status` - 显示状态报告
```bash
npx tsx src/tools/template-translation/cli/TranslationCLI.ts status
```
显示当前翻译状态，包括：
- 模板总数和翻译覆盖率
- 未翻译模板列表
- 发现的问题和建议

### `validate` - 验证翻译数据
```bash
npx tsx src/tools/template-translation/cli/TranslationCLI.ts validate
```
检查翻译数据的完整性和正确性：
- 多语言格式验证
- 模板覆盖率检查
- 数据一致性验证

### `preview` - 预览翻译效果
```bash
npx tsx src/tools/template-translation/cli/TranslationCLI.ts preview
```
不修改文件的情况下预览翻译结果：
- 显示翻译统计信息
- 展示翻译示例
- 生成处理报告

### `apply` - 应用翻译
```bash
# 模拟模式（推荐先用此模式测试）
npx tsx src/tools/template-translation/cli/TranslationCLI.ts apply --dry-run

# 实际应用
npx tsx src/tools/template-translation/cli/TranslationCLI.ts apply

# 强制应用（跳过验证）
npx tsx src/tools/template-translation/cli/TranslationCLI.ts apply --force

# 不创建备份
npx tsx src/tools/template-translation/cli/TranslationCLI.ts apply --skip-backup
```

### `backup` - 创建备份
```bash
# 创建手动备份
npx tsx src/tools/template-translation/cli/TranslationCLI.ts backup "重要更新前的备份"

# 创建默认备份
npx tsx src/tools/template-translation/cli/TranslationCLI.ts backup
```

### `list-backups` - 列出备份
```bash
npx tsx src/tools/template-translation/cli/TranslationCLI.ts list-backups
```

## 📋 翻译数据结构

### 术语表格式 (`terminology.json`)
```json
{
  "terminology": {
    "asmr": {
      "en": "ASMR",
      "zh": "ASMR", 
      "ja": "ASMR",
      "ko": "ASMR",
      "es": "ASMR",
      "de": "ASMR",
      "fr": "ASMR",
      "ar": "ASMR"
    }
  }
}
```

### 翻译批次格式 (`translations-batch-*.json`)
```json
{
  "batch": 1,
  "description": "第一批模板翻译",
  "templates": {
    "template-slug": {
      "name": {
        "en": "Template Name",
        "zh": "模板名称",
        "ja": "テンプレート名",
        "ko": "템플릿 이름",
        "es": "Nombre de Plantilla", 
        "de": "Vorlagenname",
        "fr": "Nom du Modèle",
        "ar": "اسم القالب"
      },
      "description": {
        // 8种语言的描述翻译
      },
      "params": {
        "param_name": {
          "label": {
            // 8种语言的标签翻译
          },
          "options": [
            {
              "value": "option_value",
              "label": {
                // 8种语言的选项标签翻译
              }
            }
          ]
        }
      }
    }
  }
}
```

## 🎯 最佳实践

### 1. 使用流程
1. **测试**: 先运行 `test-translation-system.ts` 确保系统正常
2. **状态检查**: 使用 `status` 命令了解当前状态
3. **验证**: 使用 `validate` 命令检查翻译数据
4. **预览**: 使用 `preview` 命令查看翻译效果
5. **模拟应用**: 使用 `apply --dry-run` 模拟应用
6. **正式应用**: 使用 `apply` 正式应用翻译

### 2. 安全建议
- 总是在应用前创建备份
- 使用 `--dry-run` 模式测试
- 定期验证翻译数据完整性
- 保留重要时刻的手动备份

### 3. 维护建议
- 新增模板时及时添加翻译
- 定期检查翻译覆盖率
- 保持术语表的一致性更新
- 监控翻译质量和用户反馈

## 🔧 系统架构

### 核心组件

1. **TemplateAnalyzer** - 模板分析器
   - 检测多语言支持状态
   - 提取可翻译字段
   - 生成分析报告

2. **TranslationProcessor** - 翻译处理器
   - 验证翻译数据格式
   - 应用翻译到模板
   - 生成处理报告

3. **TranslationManager** - 翻译管理器
   - 文件操作管理
   - 备份和恢复
   - 高级管理功能

4. **TranslationCLI** - 命令行界面
   - 用户友好的操作界面
   - 完整的命令支持
   - 详细的输出反馈

### 数据流程

```
翻译数据文件 → TranslationProcessor → 验证 → 应用到模板 → 备份 → 更新文件
     ↑                ↓
术语表文件 ←→ TemplateAnalyzer → 分析报告 → TranslationManager → CLI输出
```

## 🚨 注意事项

1. **文件安全**: 系统会自动创建备份，但建议手动备份重要状态
2. **验证重要**: 总是先验证翻译数据再应用
3. **测试优先**: 使用 `--dry-run` 模式确保操作正确
4. **增量更新**: 新增翻译时遵循现有的数据结构
5. **质量控制**: 定期检查翻译质量和用户体验

## 🐛 故障排除

### 常见问题

1. **文件路径错误**
   - 确保在项目根目录运行命令
   - 检查文件路径配置

2. **翻译验证失败**
   - 检查翻译数据格式
   - 确保所有语言代码正确
   - 验证术语表一致性

3. **模板加载失败**
   - 确保模板文件为有效 JSON
   - 检查文件权限
   - 验证目录结构

### 获取帮助

```bash
npx tsx src/tools/template-translation/cli/TranslationCLI.ts help
```

## 📈 未来扩展

- [ ] 支持更多语言
- [ ] 自动翻译质量评估
- [ ] 翻译记忆库集成
- [ ] Web 管理界面
- [ ] 翻译协作平台
- [ ] 自动化 CI/CD 集成

---

🎉 **恭喜！** 你现在拥有了一个完整的视频模板多语言翻译管理系统！