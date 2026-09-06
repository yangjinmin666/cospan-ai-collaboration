# COSPAN｜合拍：移动前端跨端验证

更新：2026-09-07。**隔离的小样，不是全量迁移或正式上线版本。**

## 本轮交付

同一套 Vue 3 + TypeScript 页面源码输出微信小程序与 H5；同一份 H5 产物进入现有 Android WebView 外壳的独立测试包。仅迁移 **发现卡片、筛选弹窗、人物详情**，不改原版 Web、小程序或生产后端。

| 共享部分 | 实际位置 |
| --- | --- |
| 页面与卡片布局、操作按钮 | `src/pages/discover/index.vue` |
| 筛选与详情组件 | `src/components/FilterSheet.vue`、`PersonSheet.vue` |
| 五组筛选与草稿规则 | `src/domain/discovery.ts` |
| 滑卡阈值、提交互斥、请求失败恢复 | `src/domain/deck.ts` |
| 批准的图标路径、头像、设计参数、音效合成 | `scripts/assets.mjs` 从原手机 Web 构建时提取 |
| 原版示例人物归一化、模拟请求 | `src/adapters/demo.ts`，不访问生产数据 |
| 运行环境差异 | 音频 Adapter、小程序胶囊/安全区、H5 返回桥接 |

这不是“把 HTML 原封不动编译为小程序”。页面已改为跨端组件表达，数据与交互规则共用，平台限制单独适配。Android 仍是 WebView 安装版，**没有改成原生 UI、uni-app x 或 App-plus**。电脑协作工作台未迁移。

视觉来源：原 `prototype/mobile-demo` 与产品 `10-移动端视觉与字体规范.md`，没有安装第三方 UI 默认皮肤。图标仍由原 `ui-icons.mjs` 生成；头像仍用同一图集及裁切坐标。小程序不适合沿用本地 CSS 背景图，改为同源 `<image>` 裁切；详情展开避开微信胶囊，关闭操作在左侧。

## 边界

- 明示“跨端验证 · 示例数据 · 不发送真实请求”；认识操作仅在内存记账，提供模拟失败入口。
- 附近、名册及底部其他页面 **尚未迁入**，点击会说明边界，不伪装为已实现。
- 没有真实登录、定位、账号恢复、通知、建联、组队或任务流程；没有读取用户会话或生产凭证。
- 开屏动画还没迁移；音效共用原版合成参数，但尚未验收手机实际响度。
- 小程序采用 `touristappid`，用于开发者工具模拟器；**不能把本轮结果当成已同步到用户手机的体验版**。
- 没有更改正式小程序 AppID、关闭域名安全检查、提交审核或发布。

## 构建

本次使用 Node 26.4.0、npm 11、Java 17、Android SDK 36、微信开发者工具 Stable 2.02.2608060。依赖及传递依赖由 `package-lock.json` 固定；uni-app 系列版本为 `3.0.0-5020420260813003`，Vue 为 3.4.21，小程序基础库固定 3.17.2。

在本目录执行：

```sh
npm ci
npm test
npm run typecheck
npm run build:h5
npm run build:mp-weixin
```

构建和类型检查会先生成素材；不要手改 `src/static/generated`。测试使用 Node 的 TypeScript 类型擦除功能，请使用上述已验证版本。未强制安装有冲突的 peer dependencies，未改系统代理或全局 npm 配置。

预览任选一种，不要同时占用 4180：

```sh
npm run dev:h5
# 或预览已构建产物：
python3 -m http.server 4180 --bind 127.0.0.1 --directory dist/build/h5
```

新预览地址 `http://127.0.0.1:4180`；旧版 4173 不变。页面是移动端宽度，桌面浏览器也不会变成桌面协作空间。

小程序：开发者工具导入本目录的 `dist/build/mp-weixin`。重新构建后若自动化连接超时，用 CLI 重新启动该隔离项目的自动化模式，再运行测试：

```sh
/Applications/wechatwebdevtools.app/Contents/MacOS/cli auto \
  --project "$PWD/dist/build/mp-weixin" --auto-port 9427
node test/mini_test.mjs
```

游客模式存在微信权限/服务提示，不能用于验证真实微信登录。曾遇到工具选中未可用的 3.16.2 基础库而白屏，固定本机可运行的 3.17.2 后恢复；不得通过关闭安全校验解决此类问题。

## Android 独立包

先构建 H5，再在产品 `android-app` 目录执行：

```sh
./gradlew --no-daemon :app:assembleDebug -PcospanUniSpike=true
cp app/build-uni-spike/outputs/apk/debug/app-debug.apk \
  ../prototype/cross-platform-spike/artifacts/cospan-unispike.apk
```

运行前需配置 Java 17 和本机 Android SDK。独立包名 `ai.rally.collaboration.unispike`，显示名称 `COSPAN 跨端验证`，与原应用可并存。只有显式设置此 Gradle 参数才使用新 H5；默认原版构建入口不变。

注意：在同一 Gradle 项目中切换默认构建与小样构建，Gradle 可能清理上次任务输出，所以将交付 APK 另存到上述忽略目录。APK 不提交 GitHub；需要时按源码重建。

## 验证与证据

`artifacts` 保存本机截图、APK 和编译检查产物，不提交仓库。自动化用例与源码一起提交。

```sh
# 先确保 4180 正在提供本次构建的 H5；需 Python Playwright 及 Chromium
python3 test/browser_test.py
# 先按上节生成 artifacts/cospan-unispike.apk
python3 test/apk_assets_test.py
```

已执行：

- 6 个共享规则测试通过：筛选草稿/取消/重置、五组条件、短拖复位、点击详情、纵向不误触、72px 阈值、提交互斥和失败恢复。
- TypeScript 检查、H5 构建、小程序构建通过；微信原生 WXML 编译器校验 5 个模板通过。
- H5 在 375×812、390×844、430×932、375×667 四种视口通过筛选、详情、返回、失败重试；390 宽执行浏览器触摸事件滑卡；无页面异常或 HTTP 错误。
- 小程序模拟器已检查发现、筛选与详情的可见界面。随后修正详情展开时关闭按钮与胶囊邻近的问题；最终构建通过，但最后一轮完整模拟器用例因自动化超时未跑完，原生工具随后确认 Mac 锁屏，**不记为通过**。专项用例在 `test/mini_test.mjs`，需解锁 Mac 并开启工具自动化连接后复测。
- Android 独立 Debug 包构建通过；57 份打包静态资源与本次 H5 逐字节一致；在 Chromium 模拟 `https://rally.local` 静态源，加载、头像和返回接口通过，禁止外部请求。
- 原版小程序 65 个测试、原版 Web 完整 Smoke、默认 Android Demo 构建及原资源打包检查通过。

**尚未完成：** Android 真机安装（本次 ADB 列表为空）、微信真机预览、iOS、实际手感/音量/性能、Live 登录与双用户链路。Chromium 静态源模拟不是 Android WebView 真机测试，构建通过不等于产品可上线。

## 迁移决策

本轮支持“同源移动页面在两类渲染环境中可落地、H5 可进入既有安装壳”的技术方向，但不证明全部迁移门槛已通过。

下一步先做微信及 Android 真机视觉/交互验收，再补 Live 请求、认证、定位与生命周期 Adapter 的受控测试；开屏、通知和其他页面分批迁入。满足原评估的准入门槛并获准后才切换原入口，不能直接推倒旧版。

依赖维护也未完成生产审计：本次使用的官方兼容版本链中存在弃用提示（如 vue-i18n 9 和自动化工具的旧依赖）；进入正式迁移前需要检查漏洞、许可及升级路径。开源框架或 Skill 不会替代这些构建、测试和审核工作。本轮没有安装第三方 Skill。

提交前已人工检查本次源码、模拟请求边界、生成素材来源及 Android opt-in 差异；默认构建不读新小样，未加入生产凭证，未整体暂存其他任务文件。审查仍不能替代上述未完成的真机及最终模拟器验收。

选型背景见 `../../docs/research/2026-09-06-COSPAN跨端前端迁移评估.md`。
