# 协作指南

## 开发流程

1. 从 `main` 新建功能分支，例如 `fix/mobile-controls` 或 `feat/reconnect`。
2. 用 `npm start` 启动本地服务，编辑 `dist/` 中的 ES 模块；当前没有构建步骤。
3. 提交前运行 `npm run check`。逻辑改动增加有实际行为意义的测试；纯文案调整不必增加重复测试。
4. 提交 Pull Request，说明问题、改动结果、验证方式和仍未覆盖的设备/网络。

不要将 `.git/`、`.netlify/`、`.openai/`、`.env`、令牌、生产站点绑定或本地绝对路径提交到仓库。`package.json` 的 `private: true` 仅防止意外发布到 npm，不控制 GitHub 仓库可见性。

## 模块边界

- 战斗数值、友伤与救援放在 `dist/coop.js`；网络输入验证和协议放在 `dist/network.js`。
- 客户端渲染和音频不决定权威战斗结果。音效事件按场景 ID 与事件 ID 去重。
- 修改原提取模块时，保持与 `upstream/` 的来源关系和改动说明；不要用重新提取覆盖现有合作适配。
- 手机 UI 改动同时检查竖持的旋转布局和实际横屏，确认摇杆轴向、按钮点击范围、画布比例及退出行为。

## 来源记录

新增图片、声音或库时补充 `SOURCES.md` / `THIRD_PARTY_NOTICES.md` 及来源 URL、版本、许可、修改说明。AI 图还需要记录参考素材及提示词，不将生成图写成原作者资源。

`PROVENANCE.json` 是交付基线的来源清单。后续修改要维护受影响条目；正式打包时执行 `npm run snapshot` 更新 `SNAPSHOT.json`。`npm run verify:snapshot` 是交付完整性检查，不是每次开发都必须保持不变的测试。

## PR 建议内容

- 可以复现的问题和预期行为。
- 实际改变了什么、是否影响协议或存量房间。
- `npm run check` 结果；UI 改动附视口尺寸及截图。
- 实测范围：同机/跨设备、Wi-Fi/移动网络、浏览器和系统。
- 来源与许可是否变化，以及仍存在的限制。

## GitHub Actions

`.github/workflows/checks.yml` 使用官方 `actions/checkout@v7` 与 `actions/setup-node@v7`，在 Node.js 22、24 执行检查；仅需要仓库读取权限，不含生产发布或托管密钥。配置参考各 action 的官方仓库文档。
