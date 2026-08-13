# 公开组件政策

[English](./README.md)

`public-components.json` 是生产定义使用的精确版本允许清单，初始状态为空。只有当某个组件版本具有固定到完整 40 位 Git commit 的公开 GitHub 源码地址，且无需凭据即可检查该地址时，才能将其加入清单。对应 npm 精确版本必须可匿名读取；已发布的包名、版本、sha512 integrity、源码仓库和 `gitHead` 都必须与批准条目一致。

维护者批准许可证后，`approved-license.json` 会记录其 SPDX 标识以及已审查 `LICENSE.md` 精确内容的 SHA-256 摘要。审批记录缺失或许可证正文发生变化时，仓库公开就绪检查会继续阻止公开。
