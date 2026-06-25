# VERSION

## v3.0.22-cn.95 - 2026-06-25

### 变更
修复APK端文件图片损坏-相对路径未拼接服务器地址

#### 手机APK端查看旅行文件页面下的图片都是损坏状态
- **根因**：file.url 是相对路径，移动端 WebView 解析到 https://localhost 而非服务器地址
- **修复**：getAuthUrl/fetchImageAsBlob/downloadFile/openFile 移动端拼接 getBaseUrl()

### 涉及文件
- `client/src/api/authUrl.ts`
- `client/src/utils/fileDownload.ts`

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.94 - 2026-06-25

### 变更
修复APK白屏-PWA Service Worker冲突

#### 手机APK打开直接白屏
- **根因**：VitePWA 注入的 SW 在 APK 覆盖安装时缓存旧资源，旧 JS 文件 404 导致白屏
- **修复**：
  1. APK 构建时移除 PWA SW（build-apk.yml 添加清理步骤）
  2. main.tsx 启动时注销旧 SW 并清除 caches

### 涉及文件
- `.github/workflows/build-apk.yml`
- `client/src/main.tsx`

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.93 - 2026-06-25

### 变更
修复公交路线导出图片截断（离屏克隆方案）

#### 导出图片下部仍然被截断
- **根因**：position:fixed + height:90vh 受视口约束，toCanvas 的 style 选项无法覆盖子元素计算样式
- **修复**：深克隆面板到离屏容器，移除所有约束后自由布局截图，不修改原 DOM

### 涉及文件
- `client/src/components/Planner/TransitRoutePanel.tsx`

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.92 - 2026-06-24

### 变更
修复公交路线导出图片截断和APK端损坏

#### 1. 导出图片下部截断
- **根因**：flex 布局塌缩导致内容区高度为 0，toCanvas 渲染时内容被裁剪
- **修复**：截图前临时展开面板和可滚动区，等待布局后截图再恢复

#### 2. APK端图片损坏
- **根因**：canvas.toBlob() 在 Capacitor WebView 中回调不触发
- **修复**：改用 toDataURL + 手动转 Blob

### 涉及文件
- `client/src/components/Planner/TransitRoutePanel.tsx`

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.91 - 2026-06-24

### 变更
Tab栏Collab中文化

#### Tab栏 Collab 中文名称
- **修复**：简体中文 Collab → 协作，繁体中文 Collab → 協作

### 涉及文件
- `client/src/i18n/translations/zh.ts`
- `client/src/i18n/translations/zhTw.ts`

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.90 - 2026-06-24

### 变更
Tab栏中文化-假期和寰球

#### Tab栏 Vacay/Atlas 中文名称
- **修复**：简体/繁体中文翻译中 Vacay → 假期，Atlas → 寰球

### 涉及文件
- `client/src/i18n/translations/zh.ts`
- `client/src/i18n/translations/zhTw.ts`

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.89 - 2026-06-24

### 变更
隐私保护-移除个人域名和GitHub用户名

#### 隐私保护：移除文件中暴露的个人域名和GitHub用户名
- **修复**：CHANGELOG.md 和 VERSION.md 中个人域名替换为 `your-domain.example.com`，GitHub 用户名替换为 `your-github-username`

### 涉及文件
- `CHANGELOG.md`
- `VERSION.md`

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.88 - 2026-06-23

### 变更
管理页默认语言选择器+高德开放平台跳转链接

#### 优化1：管理页"用户默认设置"添加语言选择器
- **修复**：后端添加 language 到 DEFAULTABLE_USER_SETTING_KEYS，前端添加语言选择器

#### 优化2：用户设置页 AMap 提示添加高德开放平台跳转链接
- **修复**：在提示中添加 https://lbs.amap.com/ 跳转链接

### 涉及文件
- `client/src/components/Admin/DefaultUserSettingsTab.tsx`
- `client/src/components/Settings/MapSettingsTab.tsx`
- `server/src/services/settingsService.ts`

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.87 - 2026-06-23

### 变更
高德地图Key安全保护+用户Key优先

#### 优化1：用户设置页不显示管理员全局高德地图Key明文
- **修复**：后端注入全局标志位而非明文，前端只显示"已使用全局配置"提示，用户可输入自己的 Key 覆盖

#### 优化2：后端 API 调用优先使用用户自己的 Key
- **修复**：mapsService/weatherService 优先级改为：用户 Key → 全局 Key

### 涉及文件
- `client/src/components/Settings/MapSettingsTab.tsx`
- `client/src/store/settingsStore.ts`
- `server/src/services/settingsService.ts`
- `server/src/services/mapsService.ts`
- `server/src/services/weatherService.ts`

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.86 - 2026-06-23

### 变更
管理页高德地图全局配置+用户默认地图提供商选择器

#### 优化1：管理页"用户默认设置"添加地图提供商选择器
- **修复**：在 DefaultUserSettingsTab 中添加地图提供商选择器（AMap 高德地图 / Leaflet / Mapbox GL），默认选中 AMap

#### 优化2：管理页添加高德地图 JS API Key 和安全密钥全局配置
- **修复**：
  1. 后端添加 amap-key 和 amap-security-code 的 admin API 路由
  2. 前端 AdminPage 添加 JS API Key 和安全密钥配置 UI
  3. 管理员配置后，所有用户自动获得这些 Key（后端已有注入逻辑）

### 涉及文件
- `client/src/components/Admin/DefaultUserSettingsTab.tsx`
- `client/src/pages/AdminPage.tsx`
- `client/src/api/client.ts`
- `server/src/services/adminService.ts`
- `server/src/routes/admin.ts`

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.85 - 2026-06-23

### 变更
移除用户设置页重复的"Web服务 Key"输入框，新注册用户默认使用高德地图。

#### 优化1：移除用户设置页重复的"Web服务 Key"输入框
- **问题**：`/settings` 和 `/admin` 都有"高德地图 Web 服务 Key"，两处重复且用户修改不生效（被全局配置覆盖）
- **修复**：从 `/settings` 移除"Web服务 Key"输入框，只保留 `/admin` 全局配置，添加提示文字引导用户到管理页配置

#### 优化2：新注册用户默认使用高德地图
- **修复**：
  1. `map_provider` 默认值从 `'leaflet'` 改为 `'amap'`
  2. 后端 `DEFAULTABLE_USER_SETTING_KEYS` 添加 `'map_provider'`，管理员可控制新用户默认地图提供商
  3. `VALID_VALUES` 添加 `map_provider` 合法值验证

### 涉及文件
- `client/src/components/Settings/MapSettingsTab.tsx`
- `client/src/store/settingsStore.ts`
- `server/src/services/settingsService.ts`

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.84 - 2026-06-23

### 变更
修复浅色模式导航栏黑色、启动页面太快、旅程封面不显示、编辑条目底部空白。

#### 修复1：浅色模式底部导航栏黑色 + 启动页面太快
- **根因**：`Theme.SplashScreen` 父主题可能覆盖 `android:navigationBarColor`，XML 配置不生效
- **修复**：`MainActivity.java` 添加运行时导航栏颜色设置（根据系统深色模式动态选择白色/黑色 + `windowLightNavigationBar`）
- **启动页面**：splash 时长 800ms→2000ms，避免一闪而过

#### 修复2：旅程封面在所有平台都不显示
- **根因**：后端 Journey `cover_image` 存储为 `journey/xxx.jpg` 或 `covers/xxx.jpg`（无 `/uploads/` 前缀），前端 `getAssetUrl()` 直接使用导致路径错误
  - Web：`journey/xxx.jpg` → 浏览器解析为 `https://server/journey/xxx.jpg` → 404
  - 移动端：`https://server/journey/xxx.jpg` → 404
- **修复**：`getAssetUrl()` 自动为不以 `/` 开头的相对路径补全 `/uploads/` 前缀

#### 修复3：编辑条目页面底部空白
- **根因**：`EntryEditor` 容器 `paddingBottom: 'var(--bottom-nav-h)'`（84px+），但模态框 z-9999 已覆盖 BottomNav z-50，留白冗余
- **修复**：改为 `paddingBottom: 'env(safe-area-inset-bottom, 0px)'`
- **额外**：`MobileEntryView` 内容区 `pb-32`（128px）→ `pb-8`（32px）

### 涉及文件
- `client/android/app/src/main/java/com/trek/app/MainActivity.java`
- `client/capacitor.config.ts`
- `client/src/utils/serverConfig.ts`
- `client/src/pages/JourneyDetailPage.tsx`
- `client/src/components/Journey/MobileEntryView.tsx`

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.83 - 2026-06-23

### 变更
修复深色模式底部导航栏白色、设计启动过渡页面、修复手机端地图不显示高德。

#### 修复1：深色模式底部导航栏区域白色背景
- **根因**：Android 主题 `AppTheme` 使用 `Theme.AppCompat.Light.DarkActionBar`（始终浅色），未设置 `android:navigationBarColor`
- **修复**：
  - `AppTheme` 改为 `Theme.AppCompat.DayNight.DarkActionBar`（跟随系统深色模式）
  - 创建 `values/colors.xml`（浅色：`#ffffff`）和 `values-night/colors.xml`（深色：`#09090b`）
  - 三个主题均添加 `android:navigationBarColor` 和 `android:windowBackground`

#### 修复2：APK启动过渡页面
- **问题**：原 splash 是 Capacitor 默认占位图，视觉效果差
- **修复**：
  - `index.html` 添加内联 CSS splash screen：TREK logo（脉冲动画）+ tagline + 加载进度条，支持深色/浅色模式
  - 删除 11 个旧 `splash.png`，创建 `splash.xml`（纯色背景，跟随 DayNight）
  - Capacitor splash 配置：时长 1500ms→800ms，背景色 `#0f172a`→`#09090b`

#### 修复3：手机端旅程页面地图不显示高德地图
- **根因**：`MobileMapTimeline.tsx` 和 `JourneyPublicPage.tsx` 硬编码导入 `JourneyMap`（Leaflet），而非 `JourneyMapAuto`（自动切换）
- **修复**：两个文件改为导入 `JourneyMapAuto`，尊重用户的地图提供商设置（AMap/Mapbox/Leaflet）

### 涉及文件
- `client/android/app/src/main/res/values/colors.xml`（新建）
- `client/android/app/src/main/res/values-night/colors.xml`（新建）
- `client/android/app/src/main/res/values/styles.xml`
- `client/android/app/src/main/res/drawable/splash.xml`（新建）
- `client/android/app/src/main/res/drawable*/splash.png`（删除 11 个）
- `client/capacitor.config.ts`
- `client/index.html`
- `client/src/components/Journey/MobileMapTimeline.tsx`
- `client/src/pages/JourneyPublicPage.tsx`

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.82 - 2026-06-23

### 变更
彻底修复移动端 APK 旅行封面图片不显示（Helmet CORP 头阻止跨域图片加载）。

#### 问题
手机端浏览器正常显示旅行封面，但 APK 中封面图片不显示。地点图片正常（cn.79 修复）。

#### 根因（关键发现）
Helmet 默认设置 `Cross-Origin-Resource-Policy: same-origin` 响应头，阻止跨域 no-cors 请求加载资源。

- **封面图片**：通过 `<img src={getAssetUrl(cover_image)}>` 加载，是跨域 no-cors 请求 → 被 CORP 阻止
- **地点图片**：通过 `photoService.fetchPhoto()` → `urlToBase64()` 用 `fetch()` 获取并转为 base64 data URL → data URL 不受 CORP 限制 → 正常显示

Capacitor 移动端 WebView origin 为 `https://localhost`，请求服务器 `https://server/uploads/covers/xxx.jpg` 是跨域请求。`<img>` 标签默认发送 no-cors 请求，被 `Cross-Origin-Resource-Policy: same-origin` 头阻止。

#### 修复
在 Helmet 配置中添加 `crossOriginResourcePolicy: false`，禁用 `Cross-Origin-Resource-Policy` 响应头。

### 涉及文件
- `server/src/app.ts`（L160: 添加 `crossOriginResourcePolicy: false`）

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.81 - 2026-06-23

### 变更
修复移动端 APK 旅行封面图片不显示（静态文件 CORS + CSP）。

#### 问题
手机端浏览器和 APK 模式下，旅行封面（SpotlightCard、MobileTripCard）的封面图片无法显示，显示为渐变色背景。手机网页端正常显示。功能按钮常显已修复（cn.80），但封面图片仍然不显示。

#### 根因分析（两个因素叠加）

**因素1：`/uploads/` 静态文件路由缺少 CORS 响应头**
- `express.static()` 提供的静态文件可能未正确继承全局 `cors()` 中间件的 `Access-Control-Allow-Origin` 响应头
- Capacitor 移动端 WebView origin 为 `https://localhost`，请求服务器 `https://server/uploads/covers/xxx.jpg` 是跨域请求
- 浏览器跨域 `<img>` 加载虽然不发送 cookie，但仍需要服务端返回 `Access-Control-Allow-Origin` 头才能正确渲染（某些 WebView 实现更严格）
- **对比**：`/api/maps/place-photo/:id/bytes` 经过 Express 路由处理链，CORS 中间件正常附加响应头 → 地点图标正常显示

**因素2：CSP `imgSrc` 缺少 `http:` 协议**
- Helmet 配置的 `imgSrc: ["'self'", "data:", "blob:", "https:"]` 不包含 `http:`
- 使用 HTTP 服务器的 NAS 用户（内网访问）的封面图片会被 CSP 策略阻止
- 虽然当前用户使用 HTTPS，但为了兼容性仍需添加

#### 修复
1. **app.ts L133**：CSP `imgSrc` 添加 `"http:"`，支持 HTTP 服务器用户
2. **app.ts L234-236**：为 `/uploads/avatars`、`/uploads/covers`、`/uploads/journey` 三个静态文件路由添加显式 `cors({ origin: corsOrigin })` 中间件，确保跨域请求始终获得正确的 CORS 响应头

### 涉及文件
- `server/src/app.ts`（CSP imgSrc + 静态文件路由 CORS）

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.80 - 2026-06-23

### 变更
修复旅行封面在 APK 中不显示（cover_image 双重路径遗漏）+ 手机端旅行卡片功能按钮不可见。

#### 1. 旅行封面在 APK 中不显示（cover_image 双重路径遗漏）
- **问题**：手机 APK 中旅行封面仍然不显示，手机网页端正常
- **根因**：`JourneyDetailPage.tsx` L3134 的设置面板封面预览仍有 `getAssetUrl(`/uploads/${journey.cover_image}`)` 双重路径拼接。后端存储的 `cover_image` 已经是 `/uploads/covers/xxx.jpg` 完整路径，再拼接 `/uploads/` 变成 `/uploads//uploads/covers/xxx.jpg`，导致 404
- **修复**：改为 `getAssetUrl(journey.cover_image)` 直接使用完整路径
- **之前已修复**：JourneyPage.tsx L248/L478、JourneyDetailPage.tsx L481（cn.79 对话中修复但未推送）

#### 2. 手机端旅行卡片功能按钮不可见
- **问题**：手机端浏览器和 APK 模式下，"我的旅行"中最近的旅行（SpotlightCard）封面右上方功能按钮（编辑、复制、归档、删除）看不见，但手指点击该区域会触发功能
- **根因**：SpotlightCard 的功能按钮使用 `opacity-0 group-hover:opacity-100`，只在鼠标 hover 时显示。手机端没有 hover 事件，按钮始终 opacity-0 不可见
- **修复**：改为 `md:opacity-0 md:group-hover:opacity-100`，手机端（<768px）默认可见（opacity-1），桌面端保持 hover 显示
- **注意**：电脑桌面端模式不调整，保持鼠标划过显示的行为

### 涉及文件
- `client/src/pages/JourneyDetailPage.tsx`（L3134 cover_image 双重路径修复）
- `client/src/pages/JourneyPublicPage.tsx`（L454 cover_image 双重路径修复）
- `client/src/pages/DashboardPage.tsx`（L231 SpotlightCard 功能按钮手机端常显）

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.79 - 2026-06-23

### 变更
彻底修复移动端 APK 地点图标不显示问题 + 状态栏深色模式适配。

#### 1. 服务器端：移除 /api/maps/place-photo/:id/bytes 的 authenticate
- **问题**：移动端 APK 中大部分地点图标不显示，只有个别地点有图片
- **根因**：`/api/maps/place-photo/:id/bytes` 路由有 `authenticate` 中间件。网页端浏览器同源请求自动发送 cookie → 认证通过。但移动端 `<img>` 标签跨域请求（`https://localhost` → `https://server`）**不发送 cookie** → 401 → 图片不显示
- **"个别地点有图片"的原因**：那些地点的 `image_url` 是 `/uploads/...` 格式（不需要认证），而大部分地点通过 `fetchPhoto()` 获取的 `photoUrl` 是 `/api/maps/place-photo/xxx/bytes`（需要认证）
- **修复**：移除 `authenticate`，与 `/uploads/avatars` 和 `/uploads/covers` 的安全模型一致（placeId 是不可猜测的 Google/OSM ID，照片是外部公开 POI 图片）

#### 2. 状态栏深色模式适配
- **问题**：状态栏颜色不随系统深色模式变化，深色模式下状态栏文字看不清
- **修复**：
  - `main.tsx`：根据系统深色模式动态设置状态栏样式（`Style.Dark`/`Style.Light`）和背景色
  - 监听 `prefers-color-scheme` 变化事件，实时更新状态栏样式
  - `index.css`：添加 CSS 变量 `--safe-area-top`/`--safe-area-bottom` 方便全局使用

### 涉及文件
- `server/src/routes/maps.ts`（移除 authenticate）
- `client/src/main.tsx`（状态栏深色模式适配）
- `client/src/index.css`（CSS safe-area 变量）

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.78 - 2026-06-23

### 变更
v3.0.22-cn.75/77 的图片 URL 修复仍有遗漏，导致移动端 APK 封面图片和地点图标仍然不显示。本次彻底修复所有遗漏位置。

#### 1. DashboardPage 封面图片：3处 `<img src={trip.cover_image}>` 遗漏 getAssetUrl
- **问题**：cn.75 只修改了 `background-image` 中的 `cover_image`，遗漏了 3 处 `<img src={trip.cover_image}>`
- **修复**：3 处都改为 `src={getAssetUrl(trip.cover_image)}`

#### 2. photoService.ts：photoUrl 相对路径未转换
- **问题**：服务器返回的 `photoUrl` 是 `/api/maps/place-photo/xxx/bytes` 相对路径，photoService 直接用作 img src，移动端解析为 `https://localhost/...` 失败
- **修复**：
  - L112-121: `photoId` 作为 photoUrl 时包 `getAssetUrl()`
  - L137: 服务器返回的 `photoUrl` 包 `getAssetUrl()`
  - L118/L153: `urlToBase64()` 参数也包 `getAssetUrl()`

#### 3. 其他遗漏的 img src
- AdminPage.tsx: `src={u.avatar_url}` → `getAssetUrl(u.avatar_url)`
- AccountTab.tsx: `src={user.avatar_url}` → `getAssetUrl(user.avatar_url)`
- CollabNotes.tsx: `src={data.image}` 和 `src={user.avatar}` → `getAssetUrl()`
- CollabChat.tsx: `src={data.image}` → `getAssetUrl(data.image)`
- JourneyDetailPage.tsx: `src={`/api/integrations/memories/...`}` → `getAssetUrl()`

### 涉及文件（8个）
- `client/src/pages/DashboardPage.tsx`（3处 img src）
- `client/src/services/photoService.ts`（photoUrl 转换）
- `client/src/pages/AdminPage.tsx`
- `client/src/components/Settings/AccountTab.tsx`
- `client/src/components/Collab/CollabNotes.tsx`
- `client/src/components/Collab/CollabChat.tsx`
- `client/src/pages/JourneyDetailPage.tsx`

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.77 - 2026-06-22

### 变更
v3.0.22-cn.75 的图片 URL 修复遗漏了一些关键组件，导致移动端 APK 仍然有部分图片不显示。本次补充修复。

#### 1. PlaceAvatar 组件：地点图标图片
- **问题**：计划栏、侧边栏中的地点图片（PlaceAvatar）不显示
- **根因**：`PlaceAvatar` 组件中 `photoSrc` 直接使用 `place.image_url` 作为 img src，没有经过 `getAssetUrl()` 转换
- **修复**：在 `getAssetUrl(place.image_url)` 处应用 `getAssetUrl()` 包裹

#### 2. photoUrl() 工具函数：旅行照片
- **问题**：旅行详情中的照片、共享旅行照片、相册图片不显示
- **根因**：`photoUrl()` 工具函数返回相对路径 `/api/photos/...`，移动端会解析为 `https://localhost/api/...` 失败
- **修复**：3 个文件中的 `photoUrl()` 函数统一在 return 时包一层 `getAssetUrl()`
  - `JourneyDetailPage.tsx`
  - `JourneyPublicPage.tsx`
  - `MobileEntryView.tsx`
  - `MobileEntryCard.tsx`

#### 3. 地图 marker 图片
- **问题**：地图上的地点标记图片不显示
- **根因**：MapView/MapViewGL/MapViewAMap 三个地图组件中，HTML 模板字符串的 `<img src="...">` 直接使用 `place.image_url` 和 `photoUrl`，没有处理
- **修复**：3 个文件中的 img src 和 fallback URL 都应用 `getAssetUrl()`

#### 4. 相册和图片灯箱
- **问题**：PhotoGallery、PhotoLightbox、Journey/PhotoLightbox 中的图片不显示
- **根因**：直接使用 `photo.url` 或 `photo.src` 作为 src
- **修复**：3 个文件应用 `getAssetUrl()`

### 涉及文件（11个）
- `client/src/components/shared/PlaceAvatar.tsx`
- `client/src/pages/JourneyDetailPage.tsx` (photoUrl)
- `client/src/pages/JourneyPublicPage.tsx` (photoUrl)
- `client/src/components/Journey/MobileEntryView.tsx` (photoUrl)
- `client/src/components/Journey/MobileEntryCard.tsx` (photoUrl)
- `client/src/components/Map/MapView.tsx`
- `client/src/components/Map/MapViewGL.tsx`
- `client/src/components/Map/MapViewAMap.tsx`
- `client/src/components/Photos/PhotoGallery.tsx`
- `client/src/components/Photos/PhotoLightbox.tsx`
- `client/src/components/Journey/PhotoLightbox.tsx`

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.76 - 2026-06-22

### 变更
修复移动端 App 内容与手机顶部状态栏重叠的问题。

#### 1. 状态栏覆盖 WebView 内容
- **问题**：APK 中页面内容与手机顶部状态栏图标重叠，且无法点击该区域的按钮
- **根因**：Capacitor Android 默认让 WebView 延伸到状态栏下方（edge-to-edge），但页面内容没有添加 safe-area 顶部 padding。移动端 Navbar 是 `hidden md:flex`（仅桌面显示），`--nav-h` 在移动端为 `0px`，内容从屏幕最顶部开始
- **修复**：
  1. `main.tsx`：启动时调用 `StatusBar.setOverlaysWebView({ overlay: false })`，让 WebView 不延伸到状态栏下方，内容自动在状态栏下方开始
  2. `index.css`：添加 CSS 兜底 `@media (max-width: 767px) { body { padding-top: env(safe-area-inset-top, 0px); } }`，配合 `box-sizing: border-box` 确保布局正确

### 涉及文件
- `client/src/main.tsx`（StatusBar 插件配置）
- `client/src/index.css`（CSS safe-area 兜底）

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.75 - 2026-06-22

### 变更
修复移动端 App 图片资源无法加载的问题。Capacitor 移动端 WebView 中相对路径（如 `/uploads/xxx.jpg`）会解析为 `https://localhost/uploads/...` 导致图片加载失败。

#### 修复内容
在 18 个前端文件中导入并应用 `getAssetUrl()` 函数，将相对路径资源 URL 转换为完整服务器 URL：
- **页面文件**：DashboardPage、JourneyPage、JourneyDetailPage、SharedTripPage、JourneyPublicPage
- **组件文件**：Navbar、DayPlanSidebar、PlaceInspector、DayDetailPanel、TripMembersModal、TodoListPanel、FileManager、CollabChat、CollabPolls、WhatsNextWidget、BudgetPanel、InAppNotificationItem、PackingListPanel
- SharedTripPage.tsx 中的复杂条件 URL 逻辑（`trip.cover_image.startsWith('http') ? ... : trip.cover_image.startsWith('/') ? ... : '/uploads/' + ...`）简化为 `getAssetUrl(trip.cover_image)`
- DayPlanSidebar.tsx 和 JourneyDetailPage.tsx 合并已有的 serverConfig import

### 涉及文件
- `client/src/pages/DashboardPage.tsx`
- `client/src/pages/JourneyPage.tsx`
- `client/src/pages/JourneyDetailPage.tsx`
- `client/src/pages/SharedTripPage.tsx`
- `client/src/pages/JourneyPublicPage.tsx`
- `client/src/components/Layout/Navbar.tsx`
- `client/src/components/Planner/DayPlanSidebar.tsx`
- `client/src/components/Planner/PlaceInspector.tsx`
- `client/src/components/Planner/DayDetailPanel.tsx`
- `client/src/components/Trips/TripMembersModal.tsx`
- `client/src/components/Todo/TodoListPanel.tsx`
- `client/src/components/Files/FileManager.tsx`
- `client/src/components/Collab/CollabChat.tsx`
- `client/src/components/Collab/CollabPolls.tsx`
- `client/src/components/Collab/WhatsNextWidget.tsx`
- `client/src/components/Budget/BudgetPanel.tsx`
- `client/src/components/Notifications/InAppNotificationItem.tsx`
- `client/src/components/Packing/PackingListPanel.tsx`

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.74 - 2026-06-22

### 变更
彻底修复移动端 App "创建管理员账号"和白屏问题。v3.0.22-cn.73 的 `refreshApiBaseUrl()` 修复是必要的但不充分——真正的根因是**多个 useEffect 和 connectivity probe 在服务器地址初始化之前就发起了 API 请求**。

#### 1. main.tsx：移动端启动时先初始化服务器地址再渲染
- **根因**：`startConnectivityProbe()` 在模块加载时就运行，此时 `cachedServerUrl` 为空，probe 请求 `https://localhost/api/health` 失败 → `isReachable()=false`。同时 App 的 useEffect 也并行运行 `loadUser()` 和 `getAppConfig()`，用错误的 baseURL 发起请求
- **修复**：将渲染和 probe 包装在 `async bootstrap()` 中，移动端先 `await initServerUrl()` + `refreshApiBaseUrl()` 再渲染和启动 probe

#### 2. App.tsx：第二个 useEffect 依赖 serverReady
- **根因**：React 的所有 useEffect 在首次渲染后同时运行，第二个 useEffect（加载用户和配置）不等待第一个 useEffect（初始化服务器地址）完成就用错误的 baseURL 发起 API 请求
- **修复**：第二个 useEffect 添加 `if (shouldShowServerConfig() && !serverReady) return` 守卫，依赖数组改为 `[serverReady]`。同样处理 loadSettings/loadAddons 和 registerSyncTriggers 的 useEffect

#### 3. api/client.ts：移动端跳过代理认证重载逻辑
- **根因**：响应拦截器检测到请求失败且 `isReachable()=false` 时，调用 `unregisterSWAndReload()` 触发页面重载。移动端 App 不经过 CF Access/Pangolin 代理，此逻辑无意义且导致白屏循环
- **修复**：两个代理认证检测块都添加 `!Capacitor.isNativePlatform()` 条件，移动端直接跳过

#### 4. connectivity.ts：服务器地址未配置时跳过 probe
- **根因**：首次启动未配置服务器地址时，probe 请求 `https://localhost/api/health` 必然失败
- **修复**：`probe()` 添加 `if (!isServerUrlConfigured()) { setReachable(false); return }` 守卫

### 涉及文件
- `client/src/main.tsx`（async bootstrap：先 initServerUrl + refreshApiBaseUrl 再渲染）
- `client/src/App.tsx`（第二个 useEffect 依赖 serverReady + loadSettings/registerSyncTriggers 也加守卫）
- `client/src/api/client.ts`（响应拦截器移动端跳过代理认证重载）
- `client/src/sync/connectivity.ts`（probe 服务器地址未配置时跳过）

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.73 - 2026-06-22

### 变更
修复移动端 App apiClient baseURL 未刷新的真正根因。

#### 1. apiClient baseURL 未刷新
- **根因**：`apiClient` 模块加载时 baseURL 固定为 `/api`，`initServerUrl()` 设置 `cachedServerUrl` 后没有调用 `refreshApiBaseUrl()` 更新 baseURL
- **修复**：`initServerUrl()` 成功后调用 `refreshApiBaseUrl()`

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.72 - 2026-06-22

### 变更
修复移动端 App 登录和白屏问题。

#### 1. 移动端 App 无法登录（Cookie SameSite）
- **根因**：session cookie 使用 `SameSite=Lax`，移动端跨站请求无法发送 cookie
- **修复**：Capacitor 移动端请求使用 `SameSite=None; Secure`

#### 2. 移动端 App 白屏（connectivity probe 相对路径）
- **根因**：`probe()` 使用相对路径 `/api/health`，移动端请求 `https://localhost/api/health` 失败，触发白屏循环
- **修复**：使用 `getApiBaseUrl()` 拼接完整服务器地址

#### 3. 其他相对路径 fetch 请求
- 修复 6 个文件中的 `fetch('/api/...')` 为 `fetch(`${getApiBaseUrl()}/...`)`

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.71 - 2026-06-22

### 变更
修复移动端 App 无法连接服务器的紧急 bug。

#### 1. 移动端 App 连接服务器失败
- **问题**：更新到 v3.0.22-cn.70 后，移动端 App 连接服务器显示"Failed to fetch"
- **根因**：无 `ALLOWED_ORIGINS` 时 production 模式 `corsOrigin = false`，不添加 CORS 头，移动端跨域请求被拒绝
- **修复**：无 `ALLOWED_ORIGINS` 时 production 模式也允许所有 origin（`corsOrigin = true`）

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

---

## v3.0.22-cn.70 - 2026-06-22

### 变更
修复 CORS 配置过严导致网页端无法访问的紧急 bug。

#### 1. CORS 配置过严导致 Internal Server Error
- **问题**：更新镜像后电脑网页端登录显示 "Internal server error"，Docker 日志大量 "Unhandled error: Not allowed by CORS"
- **根因**：v3.0.22-cn.68 的 CORS 修改引入 bug —— 当 `ALLOWED_ORIGINS` 未设置时，production 模式下只允许 Capacitor 的 `localhost` origin，拒绝了正常的网页端 origin
- **修复**：无 `ALLOWED_ORIGINS` + production 时恢复原行为；有白名单时才额外允许 Capacitor 移动端 origin

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

---

## v3.0.22-cn.69 - 2026-06-22

### 变更
将 Android APK 图标替换为 PWA 图标。

#### 1. APK 图标替换
- **问题**：Android APK 使用 Capacitor 默认图标（绿色机器人），用户希望使用 PWA 的图标
- **修复**：
  1. 用 PWA 图标（`icon-512x512.png`）生成 Android 各尺寸的 `ic_launcher.png` 和 `ic_launcher_round.png`（mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi）
  2. 生成 `ic_launcher_foreground.png`（前景图标，居中占 66.67%，符合 adaptive-icon 规范）
  3. 背景色从白色（#FFFFFF）改为 TREK 深色背景（#0f172a），与 PWA 的 `background_color` 一致
  4. 删除旧的 drawable XML 图标文件（grid 背景、Capacitor 前景）

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.68 - 2026-06-22

### 变更
修复移动端 App 无法连接服务器的问题。

#### 1. 移动端 App 连接服务器失败（CORS）
- **问题**：移动端 App 输入正确的服务器地址后点击"连接服务器"，弹出"无法连接到服务器：Failed to fetch"
- **根因**：Capacitor Android 使用 `https://localhost` 作为 origin，但服务器的 CORS 配置使用 `ALLOWED_ORIGINS` 环境变量白名单，`https://localhost` 不在白名单中被拒绝
- **修复**：CORS 和 WebSocket 配置总是允许 Capacitor 移动端的 origin（`https://localhost`、`http://localhost`、`capacitor://localhost`）

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.67 - 2026-06-22

### 变更
修复 GitHub Actions APK 构建失败的问题。

#### 1. Capacitor sync 失败
- **问题**：`build-apk.yml` 工作流在 "Sync Capacitor" 步骤失败，错误信息 `[fatal] The Capacitor CLI requires NodeJS >=22.0.0`
- **根因**：Capacitor CLI 要求 NodeJS >=22.0.0，但 workflow 配置的是 Node 20（已被 GitHub Actions 弃用）
- **修复**：将 `actions/setup-node` 的 `node-version` 从 `'20'` 改为 `'22'`（LTS 版本）

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## v3.0.22-cn.66 - 2026-06-22

### 变更
新增 Capacitor 移动端 App 支持（Android + 鸿蒙），通过 GitHub Actions 自动构建 APK。

#### 1. Capacitor 移动端架构
- **方案**：使用 Capacitor 将现有 PWA 包装为原生 Android APK，鸿蒙系统通过 Android 兼容层直接安装运行
- **优势**：复用现有 Web 代码，一套代码同时支持 Web/iOS/Android/鸿蒙，维护成本低
- **appId**：`com.trek.app`
- **appName**：`TREK`

#### 2. 可配置服务器地址
- **问题**：移动端 App 不像 Web 端有固定的 `window.location.origin`，需要让用户配置 TREK 服务器地址（用户自家 NAS）
- **修复**：
  1. 新增 `client/src/utils/serverConfig.ts`：使用 Capacitor Preferences API 持久化存储服务器地址
  2. 新增 `client/src/components/ServerConfigScreen.tsx`：移动端首次启动时让用户输入服务器地址，测试连通性后保存
  3. `client/src/api/client.ts`：API 客户端支持动态 baseURL，移动端指向用户配置的服务器
  4. `client/src/api/websocket.ts`：WebSocket 连接支持移动端服务器地址
  5. `client/src/App.tsx`：app 入口添加移动端服务器配置逻辑，首次启动显示配置页面

#### 3. Android 权限和网络配置
- `AndroidManifest.xml` 添加权限：INTERNET、ACCESS_NETWORK_STATE、ACCESS_FINE_LOCATION、ACCESS_COARSE_LOCATION、READ_EXTERNAL_STORAGE、WRITE_EXTERNAL_STORAGE
- `network_security_config.xml`：允许明文 HTTP 流量（用户 NAS 可能用 HTTP 而非 HTTPS），信任系统和用户证书

#### 4. GitHub Actions 自动构建 APK
- 新增 `.github/workflows/build-apk.yml`：每次推送到 cn-localized 分支（client/** 或 workflow 文件变更）自动构建 APK
- 构建步骤：Checkout → Setup Node 20 → Setup Java 21 → Setup Android SDK → npm ci → npm run build → npx cap sync android → ./gradlew assembleDebug → Upload artifact
- 触发条件：push to cn-localized + workflow_dispatch（支持手动触发）

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

### APK 文件路径
- GitHub Actions Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk`
- 下载方式：GitHub Actions 运行页面 → Artifacts → 下载 `trek-apk` 压缩包

---

## v3.0.22-cn.65 - 2026-06-22

### 变更
修复地图右键添加地点无分类的问题。

#### 1. 地图右键添加地点无分类（核心根因）
- **问题**：通过地图右键添加的地点全都是无分类，通过搜索结果添加的有的有分类有的没有
- **根因**：地图右键添加地点时，`handleMapContextMenu` 调用逆地理编码 API 获取地点信息，但 `reverseGeocodeAmap` 函数没有从高德 API 返回的 POI 列表中提取 `type`（分类）和 `typecode`（分类编码）字段。前端 `prefillCoords` 也没有传递 `amap_category` 和 `amap_typecode` 字段。`PlaceFormModal` 的 `prefillCoords` 分支也没有设置这些字段。因此服务端自动分类兜底（v3.0.22-cn.64）无法工作
- **修复**：
  1. 后端 `reverseGeocodeAmap` 返回 `poiCategory` 和 `poiTypecode`（从高德逆地理编码 POI 列表的 type/typecode 字段提取）
  2. 前端 `prefillCoords` 类型添加 `amap_category` 和 `amap_typecode`
  3. 前端逆地理编码回调传递 `poiCategory` 和 `poiTypecode`
  4. `PlaceFormModal` 的 `prefillCoords` 分支设置 `amap_category` 和 `amap_typecode`

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

---

## v3.0.22-cn.64 - 2026-06-19

### 变更
添加服务端自动分类兜底机制，彻底解决地点无分类问题。

#### 1. 服务端自动分类兜底（核心修复）
- **问题**：v3.0.22-cn.61~cn.63 多次修复前端分类匹配逻辑，但地点仍然无分类。前端分类匹配不可靠（React 状态更新时序、API 失败、PWA 缓存等），无论怎么修前端都无法保证 100% 正确
- **根因**：分类匹配逻辑只在前端执行，前端各种不可控因素（React 状态批处理、异步竞态、API 失败、PWA 缓存、浏览器兼容性等）导致 category_id 无法可靠设置
- **修复**：在服务端 placeService.createPlace/updatePlace 中添加自动分类兜底。前端传递 `amap_category`（高德分类字符串，如"风景名胜;风景名胜;国家级景点"）和 `amap_typecode`（高德分类编码，如"110200"），服务端使用相同的映射逻辑自动查找或创建分类并设置 category_id
- **优势**：服务端逻辑确定性高，不受前端任何因素影响，保证每个有高德分类信息的地点都能正确分配分类

#### 2. 服务端 amapCategories.ts 映射逻辑
- 新增 `server/src/constants/amapCategories.ts`，包含与前端相同的分类映射表和查找函数
- 新增 `categoryService.findOrCreateCategory()`，根据高德分类信息查找或创建分类

#### 3. 前端传递高德分类信息
- PlaceFormData 添加 `amap_category` 和 `amap_typecode` 字段
- handleSelectMapsResult 存储这些值到 form
- handleSubmit 传递给服务端

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

---

## v3.0.22-cn.63 - 2026-06-19

### 变更
修复 places_details_enabled 禁用时 autocomplete 添加地点无分类的问题。

#### 1. details 被禁用时 handleSelectMapsResult 不被调用（核心根因）
- **问题**：v3.0.22-cn.62 后部分地点仍无分类（如"八达岭长城(瓮城登长城入口)"）
- **根因**：当 `places_details_enabled` 为 false 时，后端 `/maps/details/:placeId` 返回 `{ place: null, disabled: true }`（HTTP 200）。前端 `handleSelectSuggestion` 中 `if (result.place)` 为 false，`handleSelectMapsResult` 不被调用，分类不会被设置，且无任何提示。这解释了"有的无分类"——通过 autocomplete 添加的地点无分类，通过搜索结果列表添加的地点有分类（searchAmap 直接返回 category/typecode）
- **修复**：当 details 返回 null 或失败时，用 `searchAmap` 回退搜索地点名称，取第一个匹配结果的 category 和 typecode 进行分类匹配。合并 suggestion 的基本信息和搜索结果的分类信息后调用 `handleSelectMapsResult`

#### 2. details 失败时也添加 searchAmap 回退
- **问题**：details API 调用失败（网络错误等）时只显示 toast.error，不尝试回退
- **修复**：catch 块中也添加 searchAmap 回退逻辑

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

---

## v3.0.22-cn.62 - 2026-06-19

### 变更
修复高德某些 POI 不返回 type 字段导致地点无分类的问题（如"八达岭长城"）。

#### 1. findAmapCategoryMapping 缺少 typecode 前2位回退（核心根因）
- **问题**：v3.0.22-cn.61 修复后部分地点仍无分类（如"八达岭长城(瓮城登长城入口)"）
- **根因**：高德 API 对某些 POI 不返回 `type` 字段（category 为空），但返回了 `typecode`。原 `findAmapCategoryMapping` 在 category 为空且 typecode 前4位不在 `AMAP_TYPECODE_MAP`（仅9个条目）中时返回 null，导致无分类
- **修复**：添加 `AMAP_TYPECODE_PREFIX2_MAP`（typecode 前2位→一级分类名映射，覆盖全部23个大类），在 category 匹配失败后用 typecode 前2位推断一级分类。如八达岭长城 typecode=110200，前2位"11"→"风景名胜"→"景点"

#### 2. 保存按钮竞态条件
- **问题**：用户通过自动补全选择地点后，details API 还在加载中时保存按钮可点击，导致 category_id 为空的地点被保存
- **修复**：保存按钮 disabled 条件添加 `isSearchingMaps`

#### 3. AMap details 获取失败无提示
- **问题**：handleSelectSuggestion 的 amap 路径中 details API 失败只 console.warn，用户无感知，可能直接保存无分类地点
- **修复**：添加 toast.error 提示"获取地点详情失败，分类可能无法自动匹配，请手动选择分类"

### Docker 镜像
- GHCR: `ghcr.io/your-github-username/trek:cn-localized` (linux/amd64)

---

## v3.0.22-cn.61 - 2026-06-19

### 变更
深入修复地点无分类问题（v3.0.22-cn.60 修复未生效的根因）：

#### 1. PWA Service Worker 缓存导致前端代码未更新（核心根因）
- **问题**：v3.0.22-cn.60 移除了 adminOnly 并添加了 await，但用户更新镜像后问题仍然存在
- **根因**：PWA Service Worker 配置只有 `registerType: 'autoUpdate'`，没有 `skipWaiting` 和 `clientsClaim`。新版本的 Service Worker 会在后台下载安装，但不会立即激活（需要关闭所有标签页再重新打开）。用户浏览器可能仍在使用旧的前端代码缓存（没有 await 的版本）
- **修复**：`client/vite.config.js` 的 PWA workbox 配置添加 `skipWaiting: true` 和 `clientsClaim: true`，让新版本 Service Worker 立即激活并控制所有客户端，清除旧缓存

#### 2. onCategoryCreated 类型签名错误
- **问题**：`onCategoryCreated` 类型签名声明为 `(category: Category) => void`（返回 void），但实际使用 `await onCategoryCreated?.(...)` 期望返回 Promise
- **修复**：改为 `(category: Partial<Category>) => Promise<Category | undefined>`，TripPlannerPage 中改为 `async (cat) => { return await tripActions.addCategory?.(cat) }`

#### 3. Category 接口缺少 color 字段
- **问题**：`Category` 接口没有 `color` 字段，但 `findAmapCategoryMapping` 返回 `{ name, icon, color }`，`onCategoryCreated` 接收 `Partial<Category>`，导致 `color` 字段类型不匹配
- **修复**：`client/src/types.ts` 的 `Category` 接口添加 `color?: string | null`

#### 4. AmapPoi 接口缺少 typecode 字段
- **问题**：`AmapPoi` 接口没有 `typecode` 字段声明，但代码中使用 `poi.typecode`
- **修复**：`server/src/services/mapsService.ts` 的 `AmapPoi` 接口添加 `typecode?: string`

#### 5. Google/OSM 路径和搜索结果列表点击缺少 await
- **问题**：`handleSelectSuggestion` 的 Google/OSM 路径和搜索结果列表的 onClick 没有 `await handleSelectMapsResult`
- **修复**：所有调用 `handleSelectMapsResult` 的路径都添加 `await`

#### 6. 分类创建失败被静默吞掉
- **问题**：`handleSelectMapsResult` 中分类创建失败只 `console.warn`，`TripPlannerPage` 的 useEffect 中 `.catch(() => {})` 完全吞掉错误
- **修复**：
  1. `handleSelectMapsResult` 中分类创建失败改为 `console.error` + `toast.error` 显示错误提示
  2. `TripPlannerPage` 的 useEffect 中 `.catch(err => console.error(...))` 打印错误日志
  3. `handleSelectMapsResult` 添加详细诊断日志（打印 category、typecode、mapping、existingCat、newCat）

### 涉及文件
- `client/vite.config.js`（PWA skipWaiting + clientsClaim）
- `client/src/types.ts`（Category 接口添加 color）
- `client/src/components/Planner/PlaceFormModal.tsx`（类型签名+日志+错误提示+await）
- `client/src/pages/TripPlannerPage.tsx`（async onCategoryCreated+useEffect 错误日志）
- `server/src/services/mapsService.ts`（AmapPoi 接口添加 typecode）

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

## v3.0.22-cn.60 - 2026-06-19

### 变更
修复3个问题：地点无分类根因（权限+竞态）、多边形搜索结果按距离排序、多边形搜索结果导航功能：

#### 1. 地点无分类根因修复 - "八达岭长城(瓮城登长城入口)"等地点添加后依然无分类
- **问题**：v3.0.22-cn.59 已补充分类映射回退逻辑，但实际添加地点后仍然无分类
- **根因**：
  1. **权限限制**：`POST /api/categories` 路由有 `adminOnly` 中间件，非管理员调用返回 403，前端 `onCategoryCreated` 的 Promise 被 catch 静默吞掉，分类创建失败
  2. **竞态条件**：`PlaceFormModal.tsx` 中 `handleSelectMapsResult(result.place)` 未被 `await`，分类创建还未完成就提交了地点表单，地点的 `category_id` 为空
- **修复**：
  1. `/workspace/server/src/routes/categories.ts`：移除 `POST /` 的 `adminOnly` 中间件，所有登录用户都可以创建分类（与项目"用户自管理分类"的设计一致）
  2. `/workspace/client/src/components/Planner/PlaceFormModal.tsx`：`handleSelectMapsResult(result.place)` 前添加 `await`，确保分类创建完成后再继续

#### 2. 多边形搜索结果按距离排序
- **问题**：多边形搜索结果列表无序，用户难以判断哪个最近
- **修复**：在 `handlePerformSearch` 中新增 haversine 距离计算，按距离当前定位由近到远排序
  - 每个结果添加 `_distance` 字段（单位 km）
  - 列表项显示距离（<1km 显示 m，≥1km 显示 km）
  - 信息窗口也显示距离

#### 3. 多边形搜索结果导航功能
- **问题**：搜索结果只能查看，无法直接导航
- **修复**：
  1. 新增 `handleNavigate(place)` 函数，使用高德 URI API 唤起导航：
     `https://uri.amap.com/navigation?to=lng,lat,name&mode=car&src=trek&coordinate=gaode&callnative=1`
  2. 搜索结果列表项新增"导航"按钮（蓝色，`e.stopPropagation()` 防止触发列表项点击）
  3. 信息窗口新增"导航前往"链接
  4. `callnative=1` 会尝试唤起高德地图 App，未安装时在浏览器打开网页版导航

### 涉及文件
- `server/src/routes/categories.ts`（移除 adminOnly）
- `client/src/components/Planner/PlaceFormModal.tsx`（添加 await）
- `client/src/components/Map/MapViewAMap.tsx`（距离排序 + 导航功能）

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

## v3.0.22-cn.59 - 2026-06-19

### 变更
修复4个问题：高德分类映射、多边形搜索地图变白、手机端搜索结果遮挡、地铁图双指缩放：

#### 1. 高德分类映射修复 - 很多地点添加后无分类
- **问题**：添加地点后很多地点无分类
- **根因**：
  1. `AMAP_CATEGORY_MAP` 只覆盖 19/23 个高德一级分类，未覆盖的分类返回 null
  2. `findAmapCategoryMapping` 返回 null 时不创建新分类，地点保持无分类
- **修复**：
  1. 补充高德剩余4个一级分类（事件活动、地名地址、室内设施、通行设施）
  2. `findAmapCategoryMapping` 新增第3层回退：映射不到时使用高德原始分类名作为新分类名创建

#### 2. 多边形搜索点击结果后地图变白
- **问题**：点击搜索结果后 AMap 地图消失变白
- **根因**：`handleResultItemClick` 误将已经是 GCJ-02 的坐标当作 WGS-84 进行二次转换，`wgs84ToGcj02()` 可能产生 NaN，导致 AMap 内部状态损坏
- **修复**：移除 `wgs84ToGcj02` 转换，直接使用后端返回的 GCJ-02 坐标

#### 3. 手机端搜索结果列表被底部 tab 栏遮挡 + 可手动调整高度
- **问题**：搜索结果列表在手机端被底部 tab 栏遮挡，且无法调整高度
- **根因**：`bottom: 64px` 硬编码，但底部 tab 栏实际高度为 `84px + safe-area-inset-bottom`
- **修复**：
  1. 改用 `calc(var(--bottom-nav-h, 84px) + 12px)` 确保在 tab 栏上方
  2. 新增可拖动把手（顶部 6px 灰色条），支持手动上下拖动调整面板高度（120px ~ 70%屏幕高度）

#### 4. 手机端地铁图双指缩放直接跳到最大/最小
- **问题**：双指缩放放大直接到最大，缩小直接到最小，不是无级缩放
- **根因**：缩放范围 [0.3, 1.3] 太窄（总跨度仅 1.0），从默认 1.0 开始只需 30% 张开就到最大
- **修复**：
  1. 扩大缩放范围到 [0.3, 3.0]（总跨度 2.7）
  2. 新增灵敏度阻尼：`Math.pow(rawScale, 0.5)` 压缩缩放比例，使双指缩放更平滑
     - 两指距离翻倍（rawScale=2.0）→ 只放大 41%（dampScale=1.41）
     - 两指距离减半（rawScale=0.5）→ 只缩小 29%（dampScale=0.71）

### 涉及文件
- `client/src/constants/amapCategories.ts`
- `client/src/components/Map/MapViewAMap.tsx`
- `client/src/components/Map/SubwayMapView.tsx`

## v3.0.22-cn.58 - 2026-06-19

### 变更
修复地铁图缩放到最小值时弹跳的问题：

#### 1. 地铁图缩放边界弹跳修复
- **问题**：缩放到最小（0.3）时，继续滚动滚轮地铁图会不断弹跳缩放；缩放到最大（1.3）时正常停止
- **根因**：当 `curZoom` 已到达边界（0.3 或 1.3）时，`Math.max/Math.min` 限制了 `curZoom` 不变，但代码仍然调用 `si.scale(curZoom)`，导致地铁图 API 内部反复执行缩放动画产生弹跳
- **修复**：先计算 `newZoom`，只有当 `newZoom !== curZoom`（即未到达边界）时才更新 `curZoom` 并调用 `si.scale()`。到达边界时不调用 `si.scale()`，保持不动
- **影响范围**：鼠标滚轮缩放（电脑端）和双指 pinch 缩放（手机端）均已修复

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## v3.0.22-cn.57 - 2026-06-19

### 变更
修复公交/地铁路线详情选择短段线路而非完整线路的问题：

#### 1. 公交/地铁路线详情选择错误线路（短段 vs 完整线路）
- **问题**：北京地铁1号线八通线应该是"环球度假区--苹果园"（30+站），但显示"苹果园--福寿岭"（只有2站）
- **根因**：高德 API 对"1号线八通线"的查询返回多条 buslines，其中包含"1号线(苹果园--福寿岭)"这种短段延伸线。之前的评分逻辑中，`queryCore.includes("1号线")` 让所有名称为"1号线"的分段都得 +50 分，短段和完整段评分相同，选了第一条（短段）
- **修复**：将站点数作为最重要的评分因素：
  1. 站点数（busstops 数组长度）是最可靠的线路完整性指标：完整线路 30+ 站，短段只有 2 站
  2. 每个站点加 10 分，这样 30 站的完整线路比 2 站的短段多 280 分
  3. 提高名称匹配的分数权重：精确匹配 +1000，包含匹配 +100，关键词匹配 +50/个，全匹配 +200
  4. 移除之前不可靠的 total_distance 加分（total_distance 可能是整条线路的距离，不是分段的）

### 涉及文件
- `server/src/services/mapsService.ts`

## v3.0.22-cn.56 - 2026-06-19

### 变更
修复公交/地铁路线详情显示错误线路的问题：

#### 1. 公交/地铁路线详情匹配错误线路修复
- **问题**：展开"查看线路"时，有的线路详情是错误的，比如北京的地铁1号线八通线
- **根因**：后端代码总是取 `data.buslines[0]`（第一条结果），但高德 API 对"1号线八通线"的查询可能返回多条线路（1号线、八通线分开），第一条不一定匹配用户查询的线路
- **修复**：新增评分匹配逻辑，从所有返回的 buslines 中找到最佳匹配：
  1. 去掉查询名中的"地铁"/"轨道"前缀，提取核心关键词
  2. 将查询名拆分为线路标识，如 "1号线八通线" → ["1号线", "八通线"]
  3. 评分函数：
     - 精确匹配 +100 分
     - 包含匹配 +50 分
     - 每个关键词匹配 +20 分
     - 所有关键词都匹配且关键词数>1 时 +30 分（优先合并线路）
     - 线路总距离加分（合并线路比单独线路长）
  4. 选评分最高的线路作为结果

### 涉及文件
- `server/src/services/mapsService.ts`

## v3.0.22-cn.55 - 2026-06-19

### 变更
修复公交/地铁路线详情"未找到该线路的详细信息"错误：

#### 1. 公交/地铁路线详情报错修复
- **问题**：展开"查看线路"时，有的线路显示"未找到该线路的详细信息 暂无详细站点信息"
- **根因**：高德 API 返回的 `line.start_time` / `line.end_time` 可能是数字（如 `600`）而非字符串（如 `"0600"`），直接调用 `.replace()` 报错 `TypeError: line.start_time.replace is not a function`，导致整个 `getAmapBusLineInfo` 函数 catch 后返回空结果
- **修复**：
  1. 新增 `fmtTime(t)` 辅助函数，先用 `typeof t === 'string' ? t : String(t)` 转为字符串，再调用 `.replace()` 格式化
  2. 对 `line.via_stops` 也增加 `typeof === 'string'` 类型检查，防止非字符串调用 `.split()` 报错
- **Docker 日志影响**：此错误在 Docker 日志中大量重复出现（每条线路请求都会报错），修复后不再产生这些错误日志

### 涉及文件
- `server/src/services/mapsService.ts`

## v3.0.22-cn.54 - 2026-06-18

### 变更
根据 F12 日志精确修复路线标注 + getLinelist + DataCloneError：

#### 1. 路线标注几号线（根据实际数据结构精确解析）
- **问题**：路线规划完成后无法标注几号线
- **根因**：之前不知道 routeComplete 事件的实际数据结构，解析逻辑不匹配
- **F12 日志揭示的实际数据结构**：
  ```
  d.originalEvent._args.data.buslist[0].segmentlist[i].bus_key_name
  ```
  格式如 `"地铁12号线(南宝线)"`
- **修复**：
  1. 从 `d.originalEvent._args.data.buslist[].segmentlist[].bus_key_name` 提取线路名
  2. 从 `"地铁12号线(南宝线)"` 提取简称 `"12号线(南宝线)"`（去掉"地铁"前缀）
  3. 去掉方向信息括号，如 `"12号线(南宝线)(松岗--左炮台东)"` → `"12号线(南宝线)"`
  4. 保留 DOM 备选方案（opacity 高亮检测）

#### 2. getLinelist 方法修复
- **问题**：`[subway] getLineList err: TypeError: t is not a function`
- **根因**：API 实际方法名是 `getLinelist`（小写 l），且**必须传 callback 函数**。之前代码 `si.getLinelist()` 无参数调用导致 `t is not a function`
- **修复**：改为 `si.getLinelist(function(l){...})` 带回调函数调用

#### 3. DataCloneError 修复
- **问题**：`Uncaught DataCloneError: Failed to execute 'postMessage' on 'Window': Event object could not be cloned.`
- **根因**：routeComplete 事件的 `d` 对象包含 `originalEvent`（Event 对象），无法被 postMessage 的结构化克隆算法克隆
- **修复**：不发送原始 `d` 对象，只发送提取的 `lineNames` 数组和 `info` 字符串

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## v3.0.22-cn.53 - 2026-06-18

### 变更
地铁图居中根因修复（move 叠加问题）+ 路线标注高亮线路提取：

#### 1. 地铁图居中显示（根因修复 - move 叠加问题）
- **问题**：电脑版地铁图还是没有在整个屏幕居中显示
- **根因**：`move(deltaX, deltaY)` 是**相对偏移**，每次调用都会叠加！之前代码在 5 个时间点（100ms、500ms、1000ms、2000ms、3000ms）都调用 `doCenter()`，每次都调用 `si.move()`，导致偏移量叠加 5 次，地铁图被移到了错误的位置
- **修复**：
  1. 添加 `centered` 标志位，`move()` 只调用一次，调用后设置 `centered=true`，后续不再调用
  2. `setFitView()` 传入 SVG DOM 元素（官方文档：参数是"选中的站点或线路的DOM"）
  3. 减少调用时间点到 3 个（500ms、1500ms、3000ms），第一个成功后后续跳过

#### 2. 路线标注几号线（高亮线路提取改进）
- **问题**：DOM 备选方案提取所有含"号线"的文本，会提取所有线路名，不只是路线涉及的线路
- **修复**：路线规划后，路线涉及的线路会被高亮（opacity 较高），未涉及的线路会变暗（opacity 较低）
  1. 遍历 SVG text/tspan 元素及其父级，检查 opacity 属性和 style 中的 opacity
  2. opacity > 0.5 的为高亮线路，opacity <= 0.5 的为变暗线路
  3. 如果同时存在高亮和变暗线路，只取高亮的（即路线涉及的线路）

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## v3.0.22-cn.52 - 2026-06-18

### 变更
地铁图居中用 move() 方法 + 路线标注递归解析：

#### 1. 地铁图居中显示（根因修复）
- **问题**：电脑版地铁图还是没有在整个屏幕居中显示
- **根因**：
  1. `setFitView(obj)` 官方文档参数是"选中的站点或线路的DOM"，无参数调用不生效
  2. `getCenter()` 方法在官方文档中不存在，之前代码 `si.getCenter&&si.getCenter()` 永远返回 undefined
  3. `margin:0 auto` 对绝对定位的 SVG 元素无效
- **修复**：改用官方 `move(deltaX, deltaY)` 方法手动计算偏移量居中
  1. 获取 `#sc` 容器和 SVG 的 `getBoundingClientRect()`
  2. 计算 `deltaX = (容器宽度 - SVG宽度) / 2 - (SVG左边距 - 容器左边距)`
  3. 计算 `deltaY = (容器高度 - SVG高度) / 2 - (SVG上边距 - 容器上边距)`
  4. 调用 `si.move(deltaX, deltaY)` 移动到中心
  5. 只在 SVG 小于容器时才移动，避免大图被错误偏移
  6. 在 5 个时间点调用（100ms、500ms、1000ms、2000ms、3000ms）确保渲染完成后生效

#### 2. 路线标注几号线（递归解析改进）
- **问题**：路线规划完成后仍无法标注几号线
- **修复**：
  1. 改用递归搜索方式解析 routeComplete 数据：深度优先遍历对象，搜索所有含"号线"或以"线"结尾的字符串字段
  2. 检查更多字段名：line、lineName、name、line_title、title、lineName_txt、lname
  3. 保留 DOM 备选方案：从 SVG text/tspan 元素提取线路名
  4. 保留调试日志，打印原始数据

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## v3.0.22-cn.51 - 2026-06-18

### 变更
地铁图缩放修复 + 居中改进 + 路线标注 DOM 备选方案：

#### 1. 缩放失效修复（根因修复）
- **问题**：电脑端和手机端地铁图都不能缩放了
- **根因**：v3.0.22-cn.50 中添加的 CSS `#sc svg{...transform:translate(-50%,-50%)!important}` 和 `#sc>div{...transform:translate(-50%,-50%)!important}` 用 `!important` 覆盖了地铁图 API 内部通过修改 transform 实现的缩放功能
- **修复**：移除所有 `#sc svg` 和 `#sc>div` 的强制 CSS，只保留基本的 `#sc` 容器样式，不干预地铁图 API 内部的 transform

#### 2. 电脑端左半边显示修复
- **问题**：电脑端地铁图只在屏幕左半边显示，右半边空白
- **根因**：同上，强制 CSS 的 `position:absolute` + `left:50%` 导致 SVG 定位错误
- **修复**：移除强制 CSS，改用 `setFitView()` + `setCenter(getCenter())` + JS 手动设置 `margin:0 auto` 居中

#### 3. 居中方案改进
- `setFitView()` 在 `subway.complete` 后分 5 个时间点调用（100ms、500ms、1000ms、2000ms、3000ms）
- 添加 `setCenter(getCenter())` 双重居中
- JS 手动获取 `#sc` 子元素设置 `margin:0 auto` + `display:block`

#### 4. 路线标注 DOM 备选方案
- **问题**：`subway.routeComplete` 事件数据结构未知，之前解析可能失败
- **修复**：当事件数据解析失败时，从 SVG DOM 中提取含"号线"或以"线"结尾的文本作为线路名
- 同时保留调试日志，打印原始数据

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## v3.0.22-cn.50 - 2026-06-18

### 变更
地铁图居中显示 + 路线标注几号线修复：

#### 1. 地铁图居中显示（根因修复）
- **问题**：无论手机还是电脑浏览器，城市地铁图都没有在屏幕居中显示
- **根因**：
  1. CSS flexbox 居中方案被地铁图 API 内部的 SVG 绝对定位覆盖
  2. `setFitView()` 只调用一次，SVG 可能还没完全渲染
- **修复**：
  1. CSS 改为绝对定位 + transform 居中：`#sc svg{position:absolute!important;top:50%!important;left:50%!important;transform:translate(-50%,-50%)!important}`，强制 SVG 在容器中居中
  2. `setFitView()` 在 `subway.complete` 后多次调用（100ms、500ms、1000ms、2000ms），确保 SVG 渲染完成后生效

#### 2. 路线标注几号线（数据结构调试）
- **问题**：路线规划完成后无法标注不同地铁线路是几号线
- **根因**：`subway.routeComplete` 事件数据结构未知，之前解析逻辑可能不匹配
- **修复**：
  1. 扩展路线数据解析逻辑，兼容更多数据结构（数组、segments、route、lines、line_names、info.lines）
  2. 添加 `console.log` 打印原始数据，方便排查
  3. 父页面也添加调试日志，打印 routeComplete 原始数据和提取的 lineNames
  4. 把原始数据 JSON 也通过 postMessage 发送到父页面

#### 3. getLineList 方法名修正
- **问题**：官方文档方法名是 `getLineList(callback)`（大写 L），之前代码优先用 `getLinelist()`（小写 l）可能不生效
- **修复**：改为优先调用 `si.getLineList(callback)`（大写 L，官方文档写法），保留 `getLinelist()` 作为 fallback

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## v3.0.22-cn.49 - 2026-06-18

### 变更
地铁图 JS API 全面修复（站点错误识别+粘鼠标+缩放恢复+去按钮+居中+路线标注）：

#### 1. 站点点击错误识别（根因修复）
- **问题**：点击站点圆圈或空白处总是显示错误站点名（如"苹果园"）；点击"18号线"等线路名文字也弹出站点弹窗
- **根因**：`findStationName` 函数从任意元素遍历 DOM 树找 `<text>`，导致点击圆圈/空白时找到附近无关的 `<text>` 元素
- **修复**：
  1. 新增 `getStationNameFromTarget` 函数：仅当点击目标本身是 `<text>`/`<tspan>` 元素时才提取文本，不再遍历 DOM 树
  2. 新增 `isStationName` 过滤函数：过滤含"号线"的线路名（如"1号线""18号线"），以及以"线"结尾的短线路名（如"大兴线"）
  3. click 和 touchend 事件均改用 `getStationNameFromTarget`

#### 2. 切换城市后地图粘着鼠标（根因修复）
- **问题**：切换城市后点击站点，地铁图像粘着鼠标一样晃动
- **根因**：`si.destroy()` 未完全清理旧实例的事件监听器，新实例与旧实例的事件处理器冲突
- **修复**：切换城市时重建整个 iframe（将 `selectedAdcode` 加入 blob URL useEffect 依赖数组），而非 destroy+recreate 实例。新 iframe 有全新的事件环境，彻底避免旧监听器残留

#### 3. 切换城市后滚轮缩放恢复默认比例（根因修复）
- **问题**：切换城市后滚轮缩放结束，地铁图恢复默认比例
- **根因**：`ci()` 函数中 `curZoom=1.0` 重置了缩放变量，但旧实例的 wheel 事件监听器可能仍在运行
- **修复**：重建 iframe 后，新实例有全新的 wheel 事件监听器，不再有旧实例干扰

#### 4. 去掉缩放按钮
- **问题**：用户要求去掉 +/- 缩放按钮，改用纯鼠标滚轮/双指缩放
- **修复**：移除 `.zm` div 和 `#zi`/`#zo` 按钮及其事件处理器

#### 5. 居中显示改进
- **问题**：地铁图未在屏幕居中显示
- **修复**：
  1. CSS：`#sc` 添加 `display:flex;align-items:center;justify-content:center`，`#sc>div` 添加 `margin:auto !important`
  2. `setFitView()` 延迟从 500ms 增加到 1000ms，确保 SVG 渲染完成

#### 6. 路线规划标注几号线
- **问题**：路线规划完成后应标注不同地铁线路是几号线
- **修复**：
  1. `subway.routeComplete` 事件回调中解析路线数据，提取线路名称（兼容 segments/route/lines/line_names 多种数据格式）
  2. 新增 `routeLines` state 存储线路名称
  3. 路线信息栏显示线路名称（如"1号线 → 2号线 → 4号线"），无线路数据时显示默认提示

#### 7. Docker 日志重复4次
- 代码层面已确认无重复日志（`onListen` 守卫、`auditLog.ts` 单次 console.log、`app.ts` 单次 `res.on('finish')`、无 cluster/worker）
- 问题在 NAS Docker 配置层面：可能是 NAS Docker 管理界面日志驱动叠加，或容器被重复创建

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## v3.0.22-cn.48 - 2026-06-18

### 变更
地铁图 JS API 全面修复（站点点击+无级缩放+居中+手机端遮挡+路线标注）：

#### 1. 站点点击无反应（根因修复）
- **根因**：高德地铁图 API 内部 `triggerStationEvent` 调用 `formatStation` 时崩溃（`Cannot read properties of undefined`），导致 `station.touch` 事件永远不触发
- **修复**：三重站点点击检测方案：
  1. **DOM click 监听**（capture 阶段）：从 SVG 元素查找站点名称（`findStationName` 函数遍历 DOM 树找 `<text>` 元素）
  2. **touchend 手势检测**（手机端）：记录 touchstart 位置和时间，touchend 时判断是否为 tap（移动<15px，时长<500ms），用 `document.elementFromPoint` 获取元素
  3. **stationName.touch 事件**：监听站点名称点击事件（可能不经过 `formatStation`）
- **去重**：`sendStationClick` 函数 1 秒内同名站点只发送一次

#### 2. 无级缩放（电脑端+手机端）
- **电脑端**：添加 `wheel` 事件监听，鼠标滚轮缩放（步长 0.1，范围 0.3~1.3）
- **手机端**：添加 `touchstart`/`touchmove` 双指 pinch 缩放（跟踪两指距离比例，实时调用 `si.scale()`）
- **缩放按钮**：步长从 0.2 改为 0.15，更精细
- **CSS**：`#sc` 添加 `touch-action: none`，阻止浏览器默认手势干扰

#### 3. 居中显示
- `subway.complete` 后延迟 500ms 调用 `si.setFitView()` 自动适配视图
- 再延迟 200ms 调用 `si.setCenter(si.getCenter())` 双重居中

#### 4. 手机端工具栏被遮挡（根因修复）
- **根因**：SubwayMapView 渲染在 `MapViewAMap` 内部，被父级 `position:fixed` 的 stacking context 包裹，z-index 被限制在父级上下文内
- **修复**：用 `createPortal(jsx, document.body)` 将组件渲染到 `document.body`，完全脱离父级 stacking context
- z-index 从 99999 提升到 999999

#### 5. 路线标注几号线
- 监听 `subway.routeComplete` 事件，路线规划完成后显示提示"路线已规划，彩色线段对应不同线路"
- 使用 `theme:"colorful"` 主题，不同线路显示不同颜色

#### 6. getLineList → getLinelist（官方方法名修正）
- 官方文档方法名是 `getLinelist()`（小写 l），之前代码用 `getLineList()` 可能不生效
- 改为优先调用 `si.getLinelist()`（同步返回），保留 `getLineList(callback)` 作为 fallback

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## v3.0.22-cn.47 - 2026-06-18

### 变更
根据高德地铁图 JS API 官方文档修复多项问题：

#### 1. 站点点击无反应（根因修复）
- **根因**：之前用的事件名 `subway.clickStation` 是错误的，官方文档的事件名是 `station.touch`
- **修复**：改用 `si.event.on("station.touch", function(d){...})` 监听站点点击

#### 2. 居中显示
- **修复**：用官方 `si.setFitView()` 自动调整视图到合适的显示范围

#### 3. 缩放
- **根因**：之前用 `setZoom()` 是错误的方法名，官方文档是 `scale(scale)`，范围 0.3~1.3
- **修复**：缩放按钮改用 `si.scale(Math.min(1.3, z+0.2))` / `si.scale(Math.max(0.3, z-0.2))`

#### 4. 手机端工具栏被遮挡
- **修复**：z-index 从 9999 提升到 99999

#### 5. 路线标注几号线
- **修复**：用 `theme:"colorful"` 主题，站点颜色跟随线路颜色；用 `si.route(start, end, {closeBtn:true})` 规划路线，API 自动显示线路颜色

#### 6. 路线规划 API 修正
- **根因**：之前用 `si.setRoute(startId, endId)` 是错误的方法名，官方文档是 `si.route(start, end, opts)`
- **修复**：改用 `si.route(startId, endId, {closeBtn:true})`

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## v3.0.22-cn.46 - 2026-06-18

### 变更
修复地铁图多项问题 + Docker 日志重复4次：

#### 地铁图修复
- **站点点击无反应**：移除 `easy:1` 模式，避免内置 `formatStation`/`openTip` 崩溃导致 `clickStation` 事件不触发
- **不能缩放**：移除 `touch-action: manipulation` CSS，添加自定义缩放按钮（+/−）
- **未居中显示**：`subway.complete` 后延迟 500ms 调用 `setZoom(0.8)` + `setCenter(getCenter())`
- **手机端工具栏被遮挡**：z-index 已为 9999（上版已修复）

#### Docker 日志重复4次修复
- **根因**：`onListen` 回调可能被调用多次（tsx loader 或 NAS Docker 配置导致）
- **修复**：在 `index.ts` 添加 `onListen` 防重复守卫（闭包 `called` 标志，只执行一次）
- **额外**：`docker-compose.yml` 添加 `logging` 配置（`json-file` 驱动，max-size 10m，max-file 3）

#### 其他
- `.gitignore` 添加 `docker-log.txt`

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`
- `server/src/index.ts`
- `docker-compose.yml`
- `.gitignore`

## v3.0.22-cn.45 - 2026-06-18

### 变更
- 修复 GitHub Actions 重复触发工作流问题：`docker-cn.yml` 的 concurrency group 改为 `${{ github.workflow }}-${{ github.ref }}`，`cancel-in-progress: true`，新推送自动取消旧的工作流运行
- 排查 Docker 日志重复 3 次问题：代码层面无重复日志输出（每个 logInfo/logError 只调用一次 console.log），问题在 NAS Docker 配置层面

### Docker 日志重复3次的原因分析
代码层面确认无重复日志（auditLog.ts 中每个日志函数只调用一次 console.log/error/warn），问题在 NAS Docker 配置：
1. **NAS Docker 管理界面日志驱动叠加**：群晖/威联通等 NAS 的 Container Manager 可能同时启用了 `json-file` 和 `journald` 两种日志驱动
2. **容器被重复创建**：如果 NAS 上有多个容器都映射了相同的端口或卷，可能导致日志叠加
3. **dumb-init + su-exec 进程链**：虽然 `dumb-init` → `su-exec` → `node` 是正常进程链，但某些 NAS 的 Docker 日志驱动可能对每个子进程都捕获日志

### 涉及文件
- `.github/workflows/docker-cn.yml`

## v3.0.22-cn.44 - 2026-06-18

### 变更
修复地铁图多项交互问题：
- **站点点击报错**：高德地铁图 API `easy:1` 模式内置弹窗 `formatStation`/`openTip` 崩溃（`Cannot read properties of undefined`），添加 `window.onerror` 捕获错误，改用自定义站点点击弹窗（`subway.clickStation` 事件 + postMessage 通信）
- **自定义起终点选择**：点击站点后显示弹窗（站名 + "设为起点"/"设为终点"按钮），底部显示起终点信息栏 + "规划路线"按钮
- **居中显示**：延迟创建实例（200ms）确保容器完成布局，`subway.complete` 后延迟 300ms 尝试居中
- **缩放支持**：viewport 改为 `user-scalable=yes,maximum-scale=5.0`，CSS 添加 `touch-action:manipulation`
- **手机端工具栏被遮挡**：z-index 从 2000 提升到 9999，确保地铁图覆盖在侧边栏之上
- 城市切换时重置起终点状态
- iframe 内添加 `setStart`/`setEnd`/`setRoute`/`clearRoute` 消息处理

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## v3.0.22-cn.43 - 2026-06-18

### 变更
修复地铁图 Blob URL 方案下 Mixed Content 阻止请求：
- **根因**：Blob URL 文档继承了父页面的 HTTPS origin，地铁图 API 内部用 HTTP 请求 `http://webapi.amap.com/subway/data/citylist.json`，浏览器阻止了 Mixed Content（HTTPS 页面不允许 HTTP XHR 请求）
- **错误日志**：`Mixed Content: The page at 'https://your-domain.example.com:9999/trips/1' was loaded over HTTPS, but requested an insecure XMLHttpRequest endpoint 'http://webapi.amap.com/subway/data/citylist.json'. This request has been blocked.`
- **修复**：在 Blob URL iframe 的 HTML `<head>` 中添加 `<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">`，将所有 HTTP 请求自动升级为 HTTPS

### 变更
修复地铁图 srcdoc 内 JS 语法错误（missing ) after argument list），改用 Blob URL 方案：
- **根因**：srcdoc 方案中，HTML 内容用模板字符串拼接，内嵌 JavaScript 的括号匹配难以调试。v3.0.22-cn.41 的 `getLineList` 回调函数中闭括号 `)` 和 try 块的闭括号 `}` 缺失，导致 `SyntaxError: missing ) after argument list`
- **修复**：
  1. 改用 Blob URL 方案：`URL.createObjectURL(new Blob([html], {type: 'text/html'}))` 创建 blob: URL
  2. HTML 内容用数组 `.join('\n')` 构造，每行独立可读，避免模板字符串内嵌 JS 的语法错误
  3. 动态值用 `JSON.stringify()` 安全转义
  4. 不走网络请求 → PWA Service Worker 无法拦截
  5. 修复 `ci()` 函数中 `cr`（完成标志）未在切换城市时重置的 bug，避免切换城市后超时检测失效

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## v3.0.22-cn.42 - 2026-06-18

### 变更
修复地铁图白屏（ReferenceError: useMemo is not defined）：
- **根因**：SubwayMapView.tsx 使用了 `useMemo` 但未在 import 中导入，导致 React 渲染时报 ReferenceError 白屏
- **修复**：import 语句添加 `useMemo`

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`（import 添加 useMemo）

## v3.0.22-cn.39 - 2026-06-18

### 变更
修复地铁图 iframe 一直显示"正在加载地铁图"（PWA SW 拦截根本方案）：
- **根因**：PWA Service Worker 的 `navigateFallback: 'index.html'` 会拦截所有导航请求（包括 iframe src 加载的 /subway.html），导致加载的是主应用页面而非 subway.html。即使用户更新了代码，旧的 SW 缓存可能仍在使用，navigateFallbackDenylist 配置无法立即生效
- **最终方案**：用 iframe 的 `srcdoc` 属性内嵌 HTML 内容（不走网络请求），完全绕过 PWA Service Worker 的 navigateFallback 拦截
- **srcdoc 方案优势**：
  1. 不经过网络请求，不受 SW 拦截
  2. 不需要用户清除 SW 缓存
  3. 不受 CSP frameSrc 限制（about:srcdoc 是同源上下文）
  4. 不继承父页面 CSP（srcdoc 创建独立文档）
  5. CSS 完全隔离，不影响父页面 tab 栏

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`（重写：srcdoc 替代 src）

## v3.0.22-cn.38 - 2026-06-18

### 变更
修复地铁图 iframe 一直显示"正在加载地铁图"的问题：
1. **根因**：PWA 的 `navigateFallback: 'index.html'` 会把所有导航请求（包括 iframe 加载的 `/subway.html`）回退到 `index.html`，导致 iframe 实际加载的是主应用页面，cbk 回调永远不触发，loading 一直显示
2. **修复**：将 `/subway.html` 添加到 `navigateFallbackDenylist`，让 SW 不拦截 subway.html 的导航请求
3. **改进 subway.html**：
   - `subwayReady` 消息在 `createInstance` 之前发送（确保父页面先标记就绪）
   - 添加详细调试日志（方便排查问题）
   - 改进超时兜底：createInstance 后 10 秒无 complete 事件则报超时；脚本加载 15 秒无 cbk 则报超时

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/vite.config.js`（navigateFallbackDenylist 添加 `/subway\.html`）
- `client/public/subway.html`（改进消息时机 + 调试日志 + 超时兜底）

## v3.0.22-cn.37 - 2026-06-18

### 变更
用 iframe 方案彻底修复地铁图 JS API 的所有 UI 问题：
1. **tab 栏变形**：根因是地铁图脚本注入全局 CSS 污染页面样式，"卸载时清理"不够（显示期间已污染）。修复：用 iframe 加载独立的 subway.html，实现完全的 CSS 隔离
2. **城市切换无反应**：根因是 subway() 函数不支持多次调用。修复：城市切换在 iframe 内部处理（destroy + 重新创建实例），通过 postMessage 通信
3. **路线规划线路名称**：添加线路列表面板，subway.complete 后调用 getLineList() 获取所有线路名称和颜色，点击线路项可高亮该线路（showLine + setCenter）
4. **居中显示**：地铁图 easy 模式加载后自动适配视图
5. **电脑端/手机端适配**：
   - 工具栏：手机端 padding/fontSize 更小
   - 线路面板：手机端 maxHeight 140px，电脑端 240px
   - 底部导航栏：手机端 bottom: var(--bottom-nav-h)，电脑端 bottom: 0
   - 路线提示：手机端字体更小，maxWidth 更窄

### 新增文件
- `client/public/subway.html` - 独立的地铁图页面（iframe 加载）

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/public/subway.html`（新增）
- `client/src/components/Map/SubwayMapView.tsx`

## v3.0.22-cn.36 - 2026-06-18

### 变更
修复地铁图 JS API 多个 UI 问题：
1. **城市切换无反应**：根因是 `setAdcode()` 方法不可靠。修复：保存 `subwayFn` 到 ref，切换城市时 destroy 旧实例 + 用 `subwayFn(id, {adcode, easy:1})` 重新创建（不重新加载脚本）
2. **tab 栏拥挤变形**：根因是地铁图脚本注入了全局 CSS 污染页面样式。修复：挂载时保存 viewport meta / body className / body style / 已有 style 标签，卸载时恢复并移除地铁图注入的 style 标签
3. **路线规划线路名称**：添加线路列表面板，在 `subway.complete` 后调用 `getLineList()` 获取所有线路名称和颜色，用户可对照线路颜色识别是几号线
4. **居中显示**：地铁图加载后由 API 自动适配视图

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## v3.0.22-cn.35 - 2026-06-18

### 变更
修复地铁图 JS API 多个 UI 问题：
1. **城市切换无反应**：根因是每次切换城市都重新加载脚本，浏览器缓存脚本后 cbk 回调不会再次触发。修复：拆分 useEffect，脚本只加载一次，切换城市用 `subway.setAdcode(adcode)` 方法
2. **遮挡顶部菜单和 tab 栏**：地铁图 `position: fixed; top: 0` 全屏覆盖了 Navbar 和 Tab 栏。修复：改为 `top: calc(var(--nav-h) + 44px)`，定位在 Navbar + Tab 栏下方
3. **地铁图未居中**：在 `subway.complete` 事件后尝试调用 `setCenter` 居中
4. **顶部 tab 栏拥挤变形**：因地铁图全屏覆盖导致布局异常，修复布局后 tab 栏恢复正常

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## v3.0.22-cn.34 - 2026-06-18

### 变更
修复地铁图 JS API 加载失败（subway 实例创建失败 - querySelector 选择器无效）：
- 根因：`subway(id, opts)` 第一个参数应为容器的 **id 字符串**，而非 DOM 元素。代码错误传入了 `containerRef.current`（DOM 元素），高德 API 内部做 `'#' + container` 拼接得到 `'#[object HTMLDivElement]'`，导致 `document.querySelector('#[object HTMLDivElement]')` 抛出 SyntaxError
- 修复：
  1. 给容器 div 添加固定 `id="subway-map-container"`
  2. `subway()` 调用改为传入 id 字符串：`subwayFn('subway-map-container', { adcode, easy: 1 })`
  3. 修复超时逻辑闭包 bug：用局部变量 `loadCompleted` 跟踪加载状态，避免闭包里 `loading` 永远为 `true` 导致误报超时
- 官方文档参考：https://lbs.amap.com/api/subway-api/mobility-reference（subway(id,opts) 其中 id 为容器的 id）

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## v3.0.22-cn.33 - 2026-06-17

### 变更
修复地铁图 JS API 加载失败（移除 iframe，改用直接脚本加载 + cbk 回调）：
- 根因：iframe 方案有 sandbox 警告 + about:srcdoc 继承父 CSP 问题
- 修复：移除 iframe，直接在主文档加载地铁图脚本，在 `window.cbk` 回调内创建 subway 实例（subway 全局函数仅在 cbk 回调内可用）
- 配合 v3.0.22-cn.32 的 CSP 修复（connectSrc 添加 http://*.amap.com）

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## v3.0.22-cn.32 - 2026-06-17

### 变更
修复地铁图 JS API 加载失败（CSP 阻止问题）：
- 根因：CSP `connectSrc` 只有 `https://*.amap.com`，但地铁图 API 用 `http://webapi.amap.com/subway/data/citylist.json`（http 协议）被阻止
- 同时 `frameSrc: ["'none'"]` 禁止了 iframe 加载，`upgradeInsecureRequests` 会把 http 升级为 https
- 修复：CSP `connectSrc` 添加 `http://webapi.amap.com` 和 `http://*.amap.com`；`frameSrc` 改为允许 `'self'`；移除 `upgradeInsecureRequests`

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `server/src/app.ts`

## v3.0.22-cn.31 - 2026-06-17

### 变更
修复地铁图 JS API 加载失败问题：
- 根因：高德地铁图 JS API 是 JSONP 风格，`subway` 全局函数仅在 `cbk` 回调内可用，脚本加载后 `window.subway` 不存在
- 修复：改用 iframe 加载完整 HTML 页面，严格遵循官方示例模式，在 `cbk` 回调内创建 subway 实例，通过 postMessage 通知父窗口加载状态

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## v3.0.22-cn.30 - 2026-06-17

### 变更
修复高德新功能第四轮测试反馈问题：
1. 修复公交线路查询500错误（整个函数包裹try-catch，JSON解析异常也返回空结果）
2. 修复地铁图JS API加载失败（使用固定回调名cbk + onload后备 + 15秒超时）
3. 修复多边形搜索结果UI：手机端弹窗定位在底部tab栏上方（bottom:64px），高度限制3个结果
4. 修复多边形搜索点击结果不居中（WGS-84坐标转换为GCJ-02后再定位）

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `server/src/services/mapsService.ts`
- `client/src/components/Map/SubwayMapView.tsx`
- `client/src/components/Map/MapViewAMap.tsx`

## v3.0.22-cn.29 - 2026-06-17

### 变更
修复高德新功能第三轮测试反馈问题：
1. 修复公交线路查询500错误（fetch异常时返回空结果而非抛错）
2. 修复地铁图JS API加载失败（全局对象为subway小写，事件名为subway.complete，adcode为4位）
3. 修复多边形搜索结果UI：改为底部居中弹窗（类似地点详情），手机端限制3个结果高度，电脑端420px宽
4. 修复"风景名胜"分类未归类到景点（重构自动分类逻辑，避免闭包过期问题）

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`
- `client/src/components/Map/MapViewAMap.tsx`
- `client/src/components/Planner/PlaceFormModal.tsx`
- `server/src/services/mapsService.ts`

## v3.0.22-cn.28 - 2026-06-17

### 变更
修复高德新功能第二轮测试反馈问题：
1. 修复点击地点黑屏（website字段非字符串时调用.trim()崩溃）
2. 修复"打开网站"按钮：无网址时不显示（类型安全检查）
3. 完全删除3D地图视图功能（不实用）
4. 修复公交线路查询500错误（线路名去除所有括号方向信息 + 服务端重试机制）
5. 修复公交路线查询500错误（无路线时返回空结果而非抛错）
6. 修复地铁图JS API加载失败（改用独立script标签加载subway.js，非AMap.plugin）
7. 修复多边形区域搜索UI：搜索栏从底部移到顶部（避免被tab栏遮挡），结果面板从右侧移到左侧（避免被添加地点栏遮挡），电脑/手机分别适配

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Planner/PlaceInspector.tsx`
- `client/src/components/Map/MapViewAMap.tsx`
- `client/src/components/Map/SubwayMapView.tsx`
- `client/src/components/Planner/TransitRoutePanel.tsx`
- `server/src/services/mapsService.ts`

## v3.0.22-cn.27 - 2026-06-17

### 变更
修复6项高德新功能的测试反馈问题：
1. 修复"打开网站"按钮无网址时仍显示（增加空字符串/空白检查）
2. 修复URI API导航在HarmonyOS 6.1无法调起高德APP（优先使用androidamap://深度链接，降级到uri.amap.com）
3. 修复3D地图视图不生效（地图初始化添加viewMode:'3D'）+ 按钮被右侧栏遮挡
4. 修复公交首末班时间格式（"0600"→"06:00"）+ 站点列表标注上/下车站 + 北京线路查不到（去掉"市"后缀+去掉方向信息）
5. 修复地铁图JS API加载失败（改用AMap.plugin单独加载+超时兜底+subwayFail事件）
6. 功能按钮从右侧纵向移到顶部居中横向排列（毛玻璃背景+移动端适配）

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Planner/PlaceInspector.tsx`
- `client/src/components/Map/MapViewAMap.tsx`
- `client/src/components/Map/SubwayMapView.tsx`
- `client/src/components/Planner/TransitRoutePanel.tsx`
- `server/src/services/mapsService.ts`

---

## v3.0.22-cn.26 - 2026-06-17

### 变更
新增6项高德地图功能：
1. URI API调起高德地图APP导航（PlaceInspector导航按钮）
2. IP定位（首次打开自动定位当前城市）
3. 3D地图视图（右上角3D切换按钮）
4. 多边形区域搜索（框选区域搜索POI）
5. 公交信息查询（TransitRoutePanel查看完整线路）
6. 地铁图JS API（30城市地铁线路图视图）

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Planner/PlaceInspector.tsx`
- `client/src/components/Map/MapViewAMap.tsx`
- `client/src/components/Map/SubwayMapView.tsx` (新建)
- `client/src/components/Planner/TransitRoutePanel.tsx`
- `client/src/api/client.ts`
- `server/src/services/mapsService.ts`
- `server/src/routes/maps.ts`

---

## v3.0.22-cn.25 - 2026-06-17

### 变更
- 修复网址跳转将http强制改为https的问题，保留原始协议
- 扩展分类映射：新增飞机/火车/船舶/轨道交通分类（基于高德typecode二级分类精确匹配）
- 修复左侧计划栏地点显示分类图标而非图片（assignmentService/dayService缺少osm_id字段）
- mapsService返回完整category字符串（不再截取一级分类）

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Planner/PlaceInspector.tsx`
- `client/src/constants/amapCategories.ts`
- `client/src/components/Planner/PlaceFormModal.tsx`
- `client/src/pages/TripPlannerPage.tsx`
- `server/src/services/mapsService.ts`
- `server/src/services/assignmentService.ts`
- `server/src/services/dayService.ts`
- `server/src/services/queryHelpers.ts`
- `server/src/types.ts`

---

## v3.0.22-cn.24 - 2026-06-17

### 变更
- 修复地点网站跳转打开项目本身网址（添加https://前缀检查）
- 修复详细地址缺少省市区信息（searchAmap统一拼接完整地址）
- 修复高德一级分类未自动创建（TripPlannerPage加载时自动创建缺失分类）
- 提取AMAP_CATEGORY_MAP到共享文件amapCategories.ts
- 清理placeService.ts调试日志

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Planner/PlaceInspector.tsx`
- `server/src/services/mapsService.ts`
- `client/src/constants/amapCategories.ts` (新建)
- `client/src/components/Planner/PlaceFormModal.tsx`
- `client/src/pages/TripPlannerPage.tsx`
- `server/src/services/placeService.ts`

---

## v3.0.22-cn.23 - 2026-06-17

### 变更
- 自动补全选择后异步调用详情接口获取完整信息（website/phone/image_url/category）
- 自动分类匹配：高德一级分类 → 项目分类映射表（20个分类）
- 添加地点时自动匹配已有分类或创建新分类
- 服务端searchAmap/getPlaceDetails新增amap_typecode字段

---

## v3.0.22-cn.22 - 2026-06-17

### 变更
- 修复搜索按钮添加地点报"Failed to create place"（AMap tel字段返回数组导致SQL参数不匹配）
- searchAmap: phone字段添加Array.isArray检查
- createPlace/updatePlace: 添加sanitize()函数做类型安全处理
- 前端handleSelectMapsResult: phone字段添加数组检查

---

## v3.0.22-cn.21 - 2026-06-17

### 变更
- 前端 getApiErrorMessage 显示服务端错误详情（detail字段）
- 服务端 createPlace 入口添加请求体日志

---

## v3.0.22-cn.20 - 2026-06-16

### 变更
- 修复搜索按钮添加地点报"Failed to create place"（数据库列缺失：动态构建SQL + 迁移添加缺失列 + PRAGMA检测列）
- 前端PlaceFormData添加osm_id和phone字段
- handleSelectMapsResult添加image_url映射（AMap photo_url→image_url）

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `server/src/services/placeService.ts`
- `server/src/db/migrations.ts`
- `client/src/components/Planner/PlaceFormModal.tsx`

---

## v3.0.22-cn.19 - 2026-06-16

### 变更
- 修复添加地点报"Internal server error"（osm_id列缺失防御：CREATE TABLE添加osm_id + 运行时列检测）
- 恢复天气温度前的"Ø"符号（气象学平均值符号）

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `server/src/db/schema.ts`
- `server/src/services/placeService.ts`
- `server/src/routes/places.ts`
- `client/src/components/Weather/WeatherWidget.tsx`

---

## v3.0.22-cn.18 - 2026-06-16

### 变更
- 修复天气温度前的"Ø"符号，替换为"≈"（约等于），更直观表示气候平均值
- 修复搜索按钮添加地点报"Internal server error"（添加try-catch和详细错误日志）
- 修复AMap逆地理编码缺少await（async IIFE + await）

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Weather/WeatherWidget.tsx`
- `server/src/routes/places.ts`
- `client/src/pages/TripPlannerPage.tsx`

---

## v3.0.22-cn.17 - 2026-06-16

### 变更
- 修复导出图片全白（回退克隆节点方案，改用height参数覆盖canvas尺寸）
- 临时移除maxHeight获取scrollHeight，立即恢复，用完整尺寸作为toCanvas的width/height参数

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Planner/TransitRoutePanel.tsx`

---

## v3.0.22-cn.16 - 2026-06-16

### 变更
- 修复导出图片底部截断（克隆节点方案：深克隆面板到屏幕外，移除maxHeight/overflow限制，截图后删除克隆，真实DOM不受影响）
- 修复策略按钮文字换行（JSX添加whiteSpace:nowrap+克隆节点上也添加）
- 克隆节点方案同时解决：面板跳动、遮罩残留、底部截断、文字换行

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Planner/TransitRoutePanel.tsx`

---

## v3.0.22-cn.15 - 2026-06-16

### 变更
- 修复导出时面板跳动和遮罩层残留（重写captureCanvas：style选项覆盖克隆节点+filter排除遮罩，不再修改真实DOM的position/display）
- 修复F12控制台fonts.loli.net CSS跨域读取报错（字体link标签添加crossorigin属性）

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Planner/TransitRoutePanel.tsx`
- `client/index.html`

---

## v3.0.22-cn.14 - 2026-06-16

### 变更
- 恢复公交地铁路线导出图片到commit 77b7623完美版本（DOM操作+遮罩隐藏+滚动容器+inline-flex文字居中）
- 修复F12控制台CSP报错（connectSrc添加fonts.loli.net和gstatic.loli.net）

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Planner/TransitRoutePanel.tsx`
- `server/src/app.ts`

---

## v3.0.22-cn.13 - 2026-06-15

### 变更
- 修复导出图片文字溢出背景色块（改用inline-flex+固定高度强制居中，绕过html2canvas的baseline计算bug）

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Planner/TransitRoutePanel.tsx`

---

## v3.0.22-cn.12 - 2026-06-15

### 变更
- 修复导出图片文字溢出背景色块（line-height改为1，彻底解决html2canvas行高计算差异）
- 修复地图右键添加地点只能获取经纬度的关键bug（reverseAmap调用缺少await导致Promise未解析）
- handleMapContextMenu依赖数组补充mapProvider和hasAmapKey
- 逆地理编码结果优先使用poiName（POI名称比地址组件名更有意义）

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Planner/TransitRoutePanel.tsx`
- `client/src/pages/TripPlannerPage.tsx`

---

## v3.0.22-cn.11 - 2026-06-15

### 变更
- AMap逆地理编码改用extensions=all，返回附近POI信息（id/name/photos）
- 右键添加地点现在能获取到POI的google_place_id和image_url
- 导出图片内联computed style到每个元素
- AMap地点图片优先通过POI详情API获取

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `server/src/services/mapsService.ts`
- `client/src/pages/TripPlannerPage.tsx`
- `client/src/components/Planner/PlaceFormModal.tsx`
- `client/src/components/Planner/TransitRoutePanel.tsx`
- `AGENTS.md` (新增 AMap API 参考信息)

---

## v3.0.22-cn.10 - 2026-06-15

### 变更
- 修复导出图片文字溢出背景色块（onclone中内联computed style到每个元素）
- 修复地图右键添加地点慢（先开弹窗再异步逆地理编码）
- 修复PlaceFormModal异步更新prefillCoords时重置表单
- AMap地点图片优先通过POI详情API获取，解决404

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Planner/TransitRoutePanel.tsx`
- `client/src/pages/TripPlannerPage.tsx`
- `client/src/components/Planner/PlaceFormModal.tsx`
- `server/src/services/mapsService.ts`

---

## v3.0.22-cn.9 - 2026-06-15

### 变更
- 修复导出图片文字错位（onclone中注入:root CSS变量定义）
- Google Fonts 替换为国内 CDN fonts.loli.net，解决国内打开慢
- AMap 地点图片优先查中文维基百科，解决 404 问题

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Planner/TransitRoutePanel.tsx`
- `client/index.html`
- `client/src/components/PDF/TripPDF.tsx`
- `client/src/components/PDF/JourneyBookPDF.tsx`
- `server/src/app.ts`
- `server/src/services/mapsService.ts`

---

## v3.0.22-cn.8 - 2026-06-15

### 变更
- 修复导出图片底部被截断（onclone中清除maxHeight/overflow）
- 修复地图右键添加地点只能获取经纬度（先逆地理编码再开弹窗）
- AMap 搜索接口超时从 8s 提升到 15s
- 修复导出图片含菜单弹窗（等待DOM更新后截图）

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/pages/TripPlannerPage.tsx`
- `client/src/components/Planner/TransitRoutePanel.tsx`
- `client/src/api/client.ts`
- `client/src/components/Files/FileManager.tsx`

---

## v3.0.22-cn.7 - 2026-06-15

### 变更
- 修复导出图片包含导出菜单弹窗（等待 DOM 更新后再截图）
- AMap 搜索接口超时从 8 秒提升到 15 秒，减少搜索失败
- 修复导出图片全白问题（position:fixed → relative）
- 修复手机端图片拖动 passive 报错

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/api/client.ts`
- `client/src/components/Planner/TransitRoutePanel.tsx`
- `client/src/components/Files/FileManager.tsx`

---

## v3.0.22-cn.6 - 2026-06-15

### 变更
- 修复公交地铁路线导出图片几乎全白问题（position:fixed 导致 html2canvas 无法渲染）
- 导出图片现在包含完整面板（标题栏+策略标签+内容区）
- 修复手机端图片拖动时控制台大量 passive event listener 报错

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Planner/TransitRoutePanel.tsx`
- `client/src/components/Files/FileManager.tsx`

---

## v3.0.22-cn.5 - 2026-06-15

### 变更
- 修复公交地铁路线导出图片缺少标题栏和策略选择标签的问题
- 修复手机端图片拖动时控制台大量 "Unable to preventDefault inside passive event listener" 报错
- 修复公交地铁路线导出图片文字和背景色块错位问题（html2canvas CSS变量解析）

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Planner/TransitRoutePanel.tsx`
- `client/src/components/Files/FileManager.tsx`

---

## v3.0.22-cn.4 - 2026-06-15

### 变更
- 修复手机端图片拖动时控制台大量 "Unable to preventDefault inside passive event listener" 报错
- 修复公交地铁路线导出图片文字和背景色块错位问题（html2canvas CSS变量解析）

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Files/FileManager.tsx`
- `client/src/components/Planner/TransitRoutePanel.tsx`

---

## v3.0.22-cn.3 - 2026-06-15

### 变更
- 文件图片预览：手机端最大缩放从 10x 提升到 15x
- 照片预览（PhotoLightbox）新增缩放功能：双指/双击/滚轮/拖拽/键盘
- 照片预览手机端最大缩放 15x，桌面端 10x

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Files/FileManager.tsx`
- `client/src/components/Photos/PhotoLightbox.tsx`

---

## v3.0.22-cn.2 - 2026-06-15

### 变更
- 修复手机端点击"公交/地铁"按钮白屏问题 (TypeError: number is not iterable)
- 修复桌面端公交面板内容截断无法滚动问题
- 修复方案选中边框不跟随切换
- 增加多层坐标数据清洗防御
- 公交面板UI升级：时间线式导航布局+可折叠方案卡片
- 新增导出为图片功能（保存本地/添加到旅行文件）
- 新增图片预览缩放功能（滚轮/双指/双击/拖拽/键盘）
- 去掉模拟占位数据和金额显示

### Docker 镜像
- `ghcr.io/your-github-username/trek:cn-localized`
- `ghcr.io/your-github-username/trek:cn-<sha>`

### 涉及文件
- `client/src/pages/TripPlannerPage.tsx`
- `client/src/components/Planner/DayPlanSidebar.tsx`
- `client/src/components/Planner/TransitRoutePanel.tsx`
- `client/src/components/Map/MapViewAMap.tsx`
- `client/src/components/Map/MapViewGL.tsx`
- `client/src/components/Files/FileManager.tsx`
- `.github/workflows/docker-cn.yml`
