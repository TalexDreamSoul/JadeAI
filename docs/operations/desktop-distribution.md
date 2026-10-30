# JadeAI Desktop 发行指南

## 运行架构

正式桌面端是 JadeAI 云端服务的安全客户端。账号、AI、订单、支付和会员数据只存在云端，不在用户电脑上创建第二套业务数据库。

默认服务地址和启动路径位于 `config/desktop-runtime.json`。正式打包前必须确认该地址是已启用 HTTPS 的生产环境。临时验收可用 `JADE_DESKTOP_URL` 和 `JADE_DESKTOP_START_PATH` 覆盖。

## 本地开发

```bash
pnpm dev:desktop
```

开发模式默认启动本地 Next.js 和独立 SQLite 数据目录。要在开发包中验收云端模式：

```bash
JADE_DESKTOP_MODE=remote JADE_DESKTOP_URL=https://resume.wc1.tagzxia.com pnpm dev:desktop
```

## macOS 打包

```bash
pnpm dist:mac
```

命令会生成 DMG 和自动更新所需的 ZIP。未配置 Apple 证书时可生成本地验收包，不得将未签名产物对外发布。

云端包只包含 Electron 主进程、预加载脚本和远端运行配置，不包含 Next.js standalone、SQLite 迁移或根 `node_modules`。构建钩子会校验这些边界，并要求 `desktop-runtime.json` 使用 HTTPS 远端地址；检查失败会直接终止打包。

正式发布需在 CI 密钥中配置以下任一组公证凭据：

- App Store Connect API：`APPLE_API_KEY`、`APPLE_API_KEY_ID`、`APPLE_API_ISSUER`。
- Apple ID：`APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID`。

代码签名使用 electron-builder 标准的 `CSC_LINK` / `CSC_KEY_PASSWORD` 或本机钥匙串证书。自动更新从 GitHub Releases 读取稳定版本，发布时应同时上传 DMG、ZIP 和更新元数据。

仓库的 `JadeAI Desktop Release` workflow 只允许手工触发，并要求输入已经存在且与 `package.json` 一致的 `v<version>` 标签。`desktop-release` Environment 应开启人工审批，并配置：

- 签名：`CSC_LINK`、`CSC_KEY_PASSWORD`。
- 公证二选一：`APPLE_API_KEY_P8`、`APPLE_API_KEY_ID`、`APPLE_API_ISSUER`；或 `APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID`。

流水线默认创建 Draft Release。操作人复核 DMG、ZIP、`latest-mac.yml`、签名和公证结果后，再在 GitHub 将草稿正式发布；正式发布后稳定版客户端才会收到自动更新。

## 离线实验包

只在需要验证本地存储或无网工作流时使用：

```bash
pnpm dist:mac:local
```

该产物内置 Next.js 和 SQLite，不用于正式商业发行。

## 发布前检查

1. `pnpm type-check` 、`pnpm test` 和 `pnpm lint` 全部通过。
2. 远程 `/api/ready` 正常，登录、支付返回和文件下载均通过桌面端验收。
3. `codesign --verify --deep --strict` 和 `spctl --assess --type execute` 通过。
4. 安装后首启、重启、断网错误页、外链和自动更新行为正常。

Developer ID 签名不等于完成公证。只有 `spctl` 接受且 `xcrun stapler validate` 能找到公证票据的产物才允许公开发布。可在本地检查云端包内容：

```bash
test ! -e release/mac-arm64/JadeAI.app/Contents/Resources/standalone
test ! -e release/mac-arm64/JadeAI.app/Contents/Resources/drizzle
test ! -e release/mac-arm64/JadeAI.app/Contents/Resources/app.asar.unpacked/node_modules
test -f release/mac-arm64/JadeAI.app/Contents/Resources/desktop-runtime.json
test -f release/mac-arm64/JadeAI.app/Contents/Resources/app-update.yml
```
