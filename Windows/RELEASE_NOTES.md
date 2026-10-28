Spherail / 绘轨 Windows **0.1.4**，游戏版本号与 Mac 版一致。

- Windows 10/11 x64；提供当前用户安装包、免安装 Portable EXE 和完整 ZIP。
- 复用原版 2D/3D 引擎、10 张官方地图与 30 个难度、地图编辑器、双语界面、头像、成绩及成就。
- 全部运行资源和贴图离线打包，无需 Node.js、Python、Swift 或 WebView2。
- 接入 Wi-Fi/有线 LAN 对战、邀请、观战、成绩结算和断线重连。Windows 暂不提供蓝牙对战。
- 存档位于 `%APPDATA%\Spherail\InkBall`，卸载后保留。

此前已验证：版本同步、存档与地图代码、30 个官方难度验证、15 个物理回放、TCP 拆包/连包、同机双实例对战和重连，以及本机源码/打包后 Electron 窗口中的 2D/3D、画线、暂停、编辑器和剪贴板。本次发布流水线复核非视觉功能测试、构建和安装卸载，不再重复视觉截图验收。真实双机、跨 Windows/Mac 联机及不同 GPU 仍需实机验证。

安装包尚未商业代码签名。请核对 `SHA256SUMS.txt`，并在 Windows 防火墙提示时允许专用网络访问。

对应源码：`Spherail-0.1.4-source.zip`。源代码及游戏采用 GPL-3.0-only；第三方运行时保留各自许可证。

Windows game version matches macOS **0.1.4**. Download Setup for a per-user install, Portable for a single executable, or extract the complete ZIP. No developer tools or internet are required to play. LAN multiplayer is included; Bluetooth is Mac-only. Cross-device Windows/Mac and other GPUs still require hardware validation. This release is unsigned. Verify the SHA-256 checksums and see `Windows/README.md` for details.
