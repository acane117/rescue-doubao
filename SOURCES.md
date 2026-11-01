# 来源与改编说明

记录日期：2026-11-01。当前成果名：**营救豆包**；协作快照版本：**0.5.0**。

## 原游戏

- 原网页标题：**勇者奶蛙传：关于如何从憋笑魔王手中救下公主这件事**。
- 用户提供的公开入口：[原游戏网页](https://h5.metaapp.cn/online/h5/BUsvkkbBiAq2pF2Ttx4j/1.0.2/6/index.html)。为避免携带个人分享追踪参数，此处仅保留规范路径。
- 资源基址：`https://h5.metaapp.cn/online/h5/BUsvkkbBiAq2pF2Ttx4j/1.0.2/6/`。
- 原作者、权利人及再分发/衍生使用许可：**未核实**。不将资源托管域名视为作者姓名，也不将网页公开可访问视为开源许可。
- 本项目不是原作者的官方续作、合作项目或原始工程发布。

## 代码来源

| 本包文件 | 来源及处理 |
| --- | --- |
| `dist/base.js` | 从原网页 `assets/game-BDvRcsxG.js` 提取常量与战斗模型；拆出单玩家更新入口，接入合作角色与敌人调度，适配扩大地图边界，并更新部分显示文字。仍为公开压缩构建代码，不是原作者开发时的未压缩源码。 |
| `dist/audio-original.js` | 从 `assets/main-BsKo9vWW.js` 提取企鹅、狗、背景音乐、奶蛋和 Web Audio 音效控制器；加入独立模块导出与浏览器兼容入口，保留原声音参数。 |
| `dist/coop.js`、`dist/network.js` | 本次协作新增的合作规则和网络实现，依赖原战斗模型；不代表原作者原有多人实现。 |
| `dist/app.js`、`dist/render.js`、`dist/view.js`、`dist/mobile.js`、`dist/audio.js`、页面和样式 | 本次协作新增/重做的界面、渲染、横屏、输入与音频适配；保留原角色和玩法语境。 |
| `tests/`、`serve.mjs`、工具及本包文档 | 本次协作整理、实现和验证的内容。 |

原公开文件的本地快照放在 `upstream/`：`index.html`、`game-BDvRcsxG.js`、`main-BsKo9vWW.js`、`game-DhG0Y0Ys.css`、`main-B4FeNT19.css`。这些文件保存了最初检查时的公开构建内容，未补齐原页面全部依赖，不可作为一个完整原工程直接运行。

## 美术与音频

- `dist/assets/backgrounds/`、原 `.webp` 角色图、笼子覆盖图和渠道图来自原网页资源。
- `dist/assets/audio/` 中 8 个 MP3 来自原游戏：背景、死亡、大笑、超级大笑、奶蛋语音、刀盾狗叫声、企鹅狂暴与死亡音轨。逐项 URL、字节数保留在 `art/original-audio-sources.json`。
- 所有上述原资源的作者与许可状态同原游戏：未核实，不在本包中重新授予使用许可。

## AI 衍生角色图与 AI 协助

需求提出者负责合作玩法、数值、名称、画风反馈及手机横屏等需求；实现、排错、测试和文档由 Codex 协助完成。这是项目实现过程说明，不是对原游戏权属的声明。

以下图像使用 OpenAI 内置 imagegen，参照原角色生成，不是原游戏发布时的资源，也不因 AI 生成而免除对原角色形象的权利核实：

| 文件 | 用途 | 原参考与生成记录 |
| --- | --- | --- |
| `dist/assets/characters/hero-hd.png` | 较早的四姿态高清图，保留作历史素材 | 原 `hero-poster.webp`、`hero-idle.webp`；`art/hero-hd-prompt.txt` |
| `dist/assets/characters/hero-walk-v3.png` | 八帧行走图集 | 原角色及 `hero-run.webp` 步态参考；`art/hero-motion-v3-prompts.txt` |
| `dist/assets/characters/hero-poses-v3.png` | 站立、大笑、防御 | 同一角色身份参考；`art/hero-motion-v3-prompts.txt` |

## 第三方库

浏览器运行时使用 **PeerJS 1.5.5**：

- 项目：[peers/peerjs](https://github.com/peers/peerjs)。
- 当前文件：`dist/vendor/peerjs.min.js`，已与 `https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js` 核对 SHA-256 一致。
- 对应许可证：[上游 v1.5.5 LICENSE](https://github.com/peers/peerjs/blob/v1.5.5/LICENSE)，完整副本为 `LICENSES/PeerJS-1.5.5-MIT.txt`。
- 本包补齐对应 `peerjs.min.js.map`，供协作者调试依赖；原项目元数据及锁文件见 `upstream/vendor/`。
- 发布标签锁文件中的依赖许可证副本与来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。其中 `@msgpack/msgpack` 为上游声明依赖，但未出现在该浏览器 bundle 的源码映射中，单独作此标注。

原网页使用的 Phaser 并非当前 Canvas 合作版本的运行时依赖；没有把 Phaser 引擎加入 `dist`，也未将其代码称作本次新增实现。

## 逐文件记录

`PROVENANCE.json` 将文件区分为原游戏资源、原构建快照、提取适配代码、本次新增代码、AI 衍生图、第三方库及文档，并记录来源 URL 或生成提示。`SNAPSHOT.json` 记录交付文件字节数和 SHA-256。

发现原作者署名或许可信息后，请在此处和逐文件记录中补齐，而不是根据托管平台猜测。
