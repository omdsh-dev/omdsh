# Oh My DSH

[English](./README.md)

Oh My DSH 是一个独立、由社区维护的实验性项目，目标是以清晰、可审查、可复现的方式组织带版本的组件组合与默认设置。

当前公开仓库候选仍处于早期预览阶段，只包含为本项目公开设计的格式、明确虚构的测试夹具以及本地校验工具。它不提供生产可用的安装器，也不对第三方软件作兼容性保证。

## 当前状态

- 公开组件组合 Schema 仍是草案，在 `v1` 前可能调整；
- 当前不包含任何生产组件组合；
- 安装与兼容说明只会根据公开、带版本的上游文档补充；
- 本仓库内容不代表 DeepSeek 官方发行版。

## 公开来源规则

进入本仓库的内容必须能够完全依靠公开来源独立复核：

- 只引用公开、不可变的组件版本；
- 不写入凭据、个人本机路径或私有地址；
- 不复制保密源码、规范或测试证据；
- 缺少证据的兼容性结论必须保持未知；
- 在独立发布审核通过前，始终禁止软件包发布。

完整规则参见[公开来源政策](./docs/public-source-policy.zh-CN.md)。
命令行语言选择与回退规则参见[国际化指南](./docs/zh-CN/i18n.md)。

## 仓库结构

- [`distributions/`](./distributions/)：生产组件组合目录，目前为空；
- [`schemas/distribution-v1.schema.json`](./schemas/distribution-v1.schema.json)：公开数据契约；
- [`test/fixtures/`](./test/fixtures/)：只用于测试的虚构数据；
- [`scripts/`](./scripts)：确定性校验和公开边界检查；
- [`locales/`](./locales/)：完整的英文与简体中文 CLI 文案。

安全、贡献与社区规则均提供中英文版本：参见[安全政策](./SECURITY.zh-CN.md)、[贡献指南](./CONTRIBUTING.zh-CN.md)和[社区行为准则](./CODE_OF_CONDUCT.zh-CN.md)。

## 本地验证

```bash
npm ci --ignore-scripts
npm run public:check
```

`npm run visibility:check` 会在仓库公开前校验已批准的 MIT 许可证及其精确文本摘要。`npm run release:check` 还要求生产组件组合中的每个精确版本都具有匿名可读、不可变的公开证据。

## 商标与关联声明

第三方名称和商标归各自权利人所有。Oh My DSH 是独立社区项目，不是 DeepSeek 官方产品，不隶属于 DeepSeek，也未获得 DeepSeek 背书。
