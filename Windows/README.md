# Spherail / 绘轨 for Windows

Windows 游戏版本与 `AppInfo.plist` 中的 Mac 版一致：**0.1.4**。

## 安装

支持 Windows 10/11 x64。下载私有仓库 Release 中的 `Spherail-0.1.4-Windows-x64-Setup.exe`，选择安装位置后启动。安装程序只为当前用户安装，无需管理员权限。

也可以使用 `Portable.exe`，或完整解压 `.zip` 后运行其中的 `Spherail.exe`。安装版、便携版和 ZIP 版都使用 `%APPDATA%\Spherail\InkBall` 保存玩家资料、自制地图、成绩和成就；卸载会保留存档。不要仅从 ZIP 中取出 EXE，旁边的资源文件也是运行所需的。

发行包包含 Electron 运行时、全部游戏素材、Three.js 和离线贴图，玩家无需安装 Node.js、Python、Swift 或 WebView2，也无需联网。

安装包尚未进行商业代码签名，Windows 可能显示“未知发布者”或 SmartScreen 提示。请从本私有仓库下载，并核对 Release 的 SHA-256 校验文件。

## 功能

- 10 张官方地图、30 个难度，2D/3D 切换、画线、擦除、镜头操作、暂停和重开。
- 自制地图编辑、试玩、撤销重做、地图代码导入导出。
- 头像裁剪、简体中文/English、持久化成绩和成就。
- Wi-Fi/有线局域网对战，使用与 Mac 相同的 Bonjour `_inkball._tcp` 和带长度前缀的 JSON 协议；接收的地图仅保存在本局内存中。
- Windows 版暂不提供蓝牙对战或 Wi-Fi/蓝牙切换。Windows 防火墙提示时，请允许访问专用网络。

自动测试覆盖 Windows 同机双实例的邀请、快照、结算、已完成玩家离开、TCP 重连，以及实际 Electron 窗口的 2D/3D 游戏、编辑器、存档与离线资源。真实双机、Windows/Mac 跨系统联机以及不同显卡仍需实机验证；同机测试不代表已经完成这些测试。

## 开发与打包

需要 Node.js 24（含 npm）、Python 3.12（含 Pillow）。在项目根目录的 PowerShell 中执行：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-build.txt
npm.cmd ci
npm.cmd start
```

```powershell
npm.cmd test
npm.cmd run test:windows
npm.cmd run build:windows
$env:SPHERAIL_EXE = (Resolve-Path .\dist\win-unpacked\Spherail.exe).Path
npm.cmd run test:windows
Remove-Item Env:SPHERAIL_EXE
.\scripts\test_windows_installer.ps1
```

产物在 `dist/`，UI 测试截图在 `test-results/`。构建脚本会检查 Windows 与 Mac 的版本号相同，复用 Mac 版图标，打包安装版、便携版和 ZIP 版。`v*-windows` 标签触发 GitHub Actions，在 Windows 上重新构建并测试，通过后向 `rrrome/spherail_private` 发布 Release、对应源码 ZIP 和 SHA-256 校验文件。公开仓库不接收此流程的提交或发行包。

## Windows / English

Requires Windows 10/11 x64. Use the per-user Setup installer, the Portable executable, or extract the complete ZIP and run `Spherail.exe`. Saves are stored in `%APPDATA%\Spherail\InkBall` and survive uninstalling. No developer tools or internet connection are required to play.

The Windows version includes the existing offline 2D/3D game, workshop, profile, records, achievements and LAN matches. Bluetooth is available only in the Mac version. Allow private network access in Windows Firewall for LAN discovery. Cross-device Windows/Mac multiplayer and other GPUs still require hardware testing. This release is unsigned; verify the published SHA-256 hashes before running it.

Source and binaries are distributed under GPL-3.0-only; Electron/Chromium and other dependencies retain their own notices. The release includes a matching source archive.
