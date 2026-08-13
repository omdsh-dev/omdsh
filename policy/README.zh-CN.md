# 公开组件政策

[English](./README.md)

`public-components.json` 是从 `workshop-projection-lock.json` 固定的 DSH Hub Workshop Registry 快照派生出的只读发行投影，不是第二套目录或审批源，初始状态为空。只有当某个组件版本具有固定到完整 40 位 Git commit 的公开 GitHub 源码地址，且无需凭据即可检查该地址时，才能将其加入投影。对应 npm 精确版本必须可匿名读取；已发布的包名、版本、sha512 integrity、源码仓库和 `gitHead` 都必须与投影条目一致。投影变化必须同时更新 Workshop 快照锁与投影摘要。

维护者批准许可证后，`approved-license.json` 会记录其 SPDX 标识以及已审查 `LICENSE.md` 精确内容的 SHA-256 摘要。审批记录缺失或许可证正文发生变化时，仓库公开就绪检查会继续阻止公开。
