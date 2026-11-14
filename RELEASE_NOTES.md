# 绘轨 / Spherail 0.1.5 — Mac & Windows

Mac 和 Windows 统一为 **0.1.5（build 6）**，在同一发行版提供两端安装包。

- 两端共用导航、地图详情、工坊、编辑器、对战、结算和弹窗布局，以及间距、文字层级和单向砖块的横杆箭头素材。
- 保留深绿街机主题、材质、页面动效、离线 2D/3D、10 张官图与 30 个难度、自制地图、成绩和成就。
- Mac 仅提供 Apple Silicon（`arm64`）DMG；打开后将 Spherail 拖入“应用程序”。
- Windows 10/11 x64 提供 Setup 安装包、Portable EXE 和完整 ZIP。
- Mac 支持局域网和蓝牙对战，Windows 支持局域网对战。真实跨设备及跨系统联机仍需实机验证。

本版使用自动化功能、资源、存档和网络协议测试，验证构建产物、Mac DMG 与临时签名，以及 Windows 打包后功能和安装卸载；不进行视觉验收。

Mac 的原生功能、WebKit 编辑器与 Bonjour 同机集成测试均在 Apple Silicon 上验证。

Mac 未经 Apple Developer ID 公证，Windows 未进行商业代码签名。请核对 `SHA256SUMS.txt`，并按系统提示允许打开。更新及卸载不会主动删除已有存档。

完整对应源码为 `Spherail-0.1.5-source.zip`，与本次发行标签一致。项目采用 GPL-3.0-only，第三方依赖保留各自许可证。

Mac and Windows now share version **0.1.5 (build 6)**, desktop layouts and one-way tile artwork. Choose the Apple Silicon Mac (`arm64`) DMG, or the Windows x64 Setup, Portable or full ZIP. Intel Macs are not supported by this release. Both versions run offline. Mac supports LAN and Bluetooth matches; Windows supports LAN. Cross-device and cross-platform multiplayer still need hardware validation. Packages are not commercially signed or notarized; verify the SHA-256 checksums. Matching GPL-3.0-only source is included.
