# 绘轨 / Spherail for Mac

**简体中文** | [English](README.en.md)

[许可证：GPL-3.0-only](LICENSE)

本目录包含独立的 macOS 绘轨（Spherail）App。运行时只读取 App 内资源和本机数据；不需要 Django、Redis、账号或互联网。对战可使用同一局域网或蓝牙，单人游玩无需联网。

界面沿用网页版的深绿街机配色。官图首页保留循环滑动地图卡、地图预览与动态背景；点击预览会将地图展开为居中的难度选择页，返回时缩回卡片。地图编辑器采用左侧素材栏、中央棋盘、右侧设置与发球顺序的布局，并提供拖放、橡皮擦和撤销重做。复合方块在构建时生成为本地 PNG，素材栏与棋盘共用。页面转场会遵守 macOS 的“减少动态效果”设置。

新建地图以只有外墙的空白棋盘开始，发球点由用户放置。选中素材后，鼠标移到棋盘会显示半透明预览；占用位置不允许重叠，洞按 2×2 格处理，右键点击洞的任意一格可删除整洞。“？”打开与网页版对应的砖块图例，颜色说明可逐项展开。各难度分别保留撤销与重做历史。

官方地图与制作地图之间采用有方向的渐入动画，支持快速切换和“减少动态效果”。关卡成就完整排列在固定高度的信息面板内，不使用内部滚动。

新增 5 张 App 专属官图，总计 10 张地图、30 个难度：

| 地图 | 英文名 | 机关主题 |
| --- | --- | --- |
| 色阶闸阵 | Spectrum Gates | 颜色门、单向墙与可破坏墙 |
| 四色锁廊 | Chromatic Locks | 分色通道、钥匙墙与洞口开关 |
| 时隙交织 | Shifting Hours | 分批消失的限时墙与多色球洞 |
| 单行迷宫 | One-Way Labyrinth | 单向墙形成的多段迷宫 |
| 分流急湾 | Cascade Junction | 加速砖、分流通道与限时入口 |

五张地图来自 `Assets/Levels/New_Level.md`（用户提供文件的原样副本），由 `scripts/extra_official_maps.py` 解析。15 个难度保留原布局、球序、发球间隔、总时间和作者信息，包括限时墙的 Unicode 编码；不再从萌新布局推导其他难度。它们采用新的地图 ID，因此不会继承上一组五张地图的成绩与成就；本机已有数据不删除。

每张地图的萌新、进阶、大师分别有 1、2、3 个成就，共 30 个。成就包括通关、限时完成，以及大师难度的限笔或零误收挑战，详见 `Assets/Levels/README.md`。`scripts/verify_expansion.mjs` 使用实际碰撞、机关和球洞代码重放固定随机种子的通关；部分地图由测试专用程序绘线、擦除来引导，程序不改变球的位置、速度或结算状态。15 个难度均有满足全部成就的回放数据。此验证证明可达成性，不代表人工难度平衡测试。

## 安装与使用

从 [GitHub Releases](https://github.com/rrrome/spherail/releases/latest) 下载适合当前 Mac 的 DMG 安装包，打开后将 Spherail（中文系统显示为“绘轨”）拖入“应用程序”。本地构建的安装包位于 `build/Spherail-macOS.dmg`。首次启动会创建随机的 `player######` 名称和默认头像（支持上传图片、拖动和缩放裁剪）；点击右上角头像即可修改。个人地图与记录继续存储在 `~/Library/Application Support/InkBall/`，以保留旧版本数据。

“制作地图”同时展示所有本机自制地图。“新建地图”始终在首位；可按地图名称搜索，并按最近或最早编辑排序。点击地图预览即可选择难度并游玩；卡片底部提供带图标的编辑按钮和删除按钮，删除仍需确认。编辑器仍可直接试玩。保存时会检查地图名称、时间与发球间隔，以及每个已制作难度的球、球洞和颜色支持。点击编辑器或难度页右上角的“导出地图”会复制当前难度的 `INKBALL-LEVEL/1` 明文代码；在编辑器“导入”中粘贴，可导入到同一张地图的另一个难度。

## 对战

1. 两台 Mac 都打开 App，并连接同一 Wi-Fi，或在系统设置中开启蓝牙并允许绘轨使用蓝牙。难度选择页点击“对战”；附近正在运行绘轨的玩家会自动显示。
2. 选择玩家发送邀请。邀请会自动附带当前地图和难度；对方会看到邀请者头像、昵称、关卡名和难度，并可接受或拒绝。
3. 接受后双方进入三秒倒计时，随后直接开始对战。游玩时显示同尺寸的双方棋盘、当前通道与延迟；蓝牙通道还显示信号强度（dBm）。
4. 一方结束后可观看对手棋盘或离开；双方结束后显示结果。

同网设备通过 Bonjour 发现并使用 TCP 传输；蓝牙链路使用 Core Bluetooth BLE。双方都能用同一玩家 ID 合并两个通道的发现结果，列表中只显示一个玩家。Wi-Fi 信息包含设备名、游戏昵称和头像；蓝牙广播容量有限，单独通过蓝牙发现时只显示可容纳的昵称。两种通道均可用时默认选择 Wi-Fi；若与同一玩家近期两种通道的实测延迟表明蓝牙明显更快，下次邀请会优先选择蓝牙。Wi-Fi 邀请建立失败时尝试蓝牙，对局中的 Wi-Fi 重连失败时也尝试切到同一玩家的蓝牙连接。游戏地图仅传所选难度。收到的自制地图只保存在本局内存中，比赛结束或离开时清除，不写入另一台 Mac 的地图库。断线后有 20 秒重连窗口。

对局时自己的棋盘以青色边框标出。新版双方会压缩对手画面快照，并用单帧蓝牙探针测量延迟；与旧版连接时自动使用旧传输格式。倒计时按实际经过时间计算，切换到其他窗口或短暂断线不会延长关卡时限。连接正常但对手画面短暂未更新时，界面会区分“同步中”和真正断线重连。

已完成的一方可以先离开；离开消息附带本局成绩，另一方仍可继续游玩。另一方完成后使用双方成绩结算；未完成就离开的对手仍按中途退出处理。

**实机测试状态：**自动测试已覆盖蓝牙分片、TCP 拆包、同机 Bonjour 双实例发现与完整 Wi-Fi 对局，以及页面流程。第二台 Mac 稍后才能接入，因此真实双机的跨设备发现、完整比赛与通道切换仍需验证。

## 构建与测试

构建需要 macOS、Xcode Command Line Tools（Swift）、Python 3.10+（建议 3.12）和 `rsvg-convert`（通过 `brew install librsvg` 安装）。验证地图回放还需要 Node.js。

首次在本目录初始化构建环境：

```bash
bash scripts/setup.sh
```

脚本会创建当前项目的 `.venv`，并安装 `requirements-build.txt` 中固定版本的 Pillow。可通过 `PYTHON=python3.12 bash scripts/setup.sh` 指定 Python。随后执行：

```bash
.venv/bin/python -m unittest discover -s Tests/ResourceGeneration
node scripts/verify_expansion.mjs
swift test
bash scripts/build.sh
```

构建所需的游戏代码、翻译和界面素材均位于 `Web/`；基础地图配置与布局位于 `Assets/Levels/config.json` 和 `Assets/Levels/maps/`，扩展地图位于 `Assets/Levels/New_Level.md`。`scripts/layouts.py` 提供本地地图推导规则；构建脚本从这些资源生成离线官图数据、编辑器图片和 App 图标。`Web/` 中的引擎与界面文件作为源文件直接维护。

`build.sh` 默认使用当前项目的 `.venv/bin/python`，也可通过 `INKBALL_BUILD_PYTHON` 指定已安装构建依赖的 Python。脚本生成 `build/Spherail.app` 与 `build/Spherail-macOS.dmg`，并验证 DMG 校验和。发行的 App 无需 Python 或构建工具。地图分享代码的 `INKBALL-MAP/1`、`INKBALL-LEVEL/1` 前缀和局域网服务类型保留，旧地图与本机数据仍可使用。App 目前采用本地临时签名，未做 Apple Developer ID 公证，跨机安装时可能需要在 macOS“隐私与安全性”中允许打开。

## 许可证

Copyright (C) 2026 rrrome and contributors.

除另有明确声明外，本项目采用 **GNU General Public License v3.0，仅第 3 版**（SPDX：`GPL-3.0-only`）。你可以按该许可证使用、修改和再分发本项目，包括商业使用。分发修改版时，须遵守 GPLv3 对许可证、修改声明及完整对应源码的要求。既有第三方版权和许可声明继续有效。

本项目不提供任何担保，包括适销性或特定用途适用性的担保。完整条款见 [LICENSE](LICENSE)。

构建的 App 在 `Contents/Resources/` 中附带 `LICENSE` 及中英文 README。发布 App 或 DMG 时，应同时向接收者提供与该二进制版本匹配的完整对应源码（包括构建脚本），例如在同一 Release 附上对应源码压缩包。项目源码仓库：[rrrome/spherail](https://github.com/rrrome/spherail)。
