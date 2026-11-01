# 第三方代码声明

本文件的许可范围仅覆盖列明的第三方组件，不覆盖原游戏、本次改编的全部代码或素材。

## PeerJS 1.5.5

- 上游：https://github.com/peers/peerjs/tree/v1.5.5
- Copyright (c) 2015 Michelle Bu and Eric Zhang, http://peerjs.com
- 许可：MIT，完整文本见 [LICENSES/PeerJS-1.5.5-MIT.txt](LICENSES/PeerJS-1.5.5-MIT.txt)。
- 文件：dist/vendor/peerjs.min.js 及对应源码映射；压缩文件与 npm 1.5.5 发布内容的 SHA-256 核对一致。

## 发布标签锁文件中的依赖

版本依据：https://github.com/peers/peerjs/blob/v1.5.5/package-lock.json 。本地副本位于 upstream/vendor/；bundle 出现情况根据 peerjs.min.js.map 的 sources 判断。

| 组件 | 锁定版本 | 许可 | 浏览器 bundle 源码映射 | 完整许可 |
| --- | --- | --- | --- | --- |
| peerjs-js-binarypack | 2.1.0 | MIT | 包含 | [副本](LICENSES/peerjs-js-binarypack-2.1.0.txt) |
| eventemitter3 | 4.0.7 | MIT | 包含 | [副本](LICENSES/eventemitter3-4.0.7.txt) |
| webrtc-adapter | 9.0.1 | BSD-3-Clause | 包含 | [副本](LICENSES/webrtc-adapter-9.0.1.txt) |
| sdp | 3.2.0 | MIT | 包含 | [副本](LICENSES/sdp-3.2.0.txt) |
| @msgpack/msgpack | 2.8.0 | ISC | 未出现，仅记录上游声明依赖 | [副本](LICENSES/msgpack-msgpack-2.8.0.txt) |

每个副本保留上游完整版权及免责条款，下载 URL 记录在 upstream/vendor/dependency-license-sources.json。没有将这些依赖的许可作为整个仓库的许可。

## GitHub CI 引用

CI 引用官方 https://github.com/actions/checkout 和 https://github.com/actions/setup-node 的 v7；action 本体不打包进入本仓库，由 GitHub Actions 运行时获取。
