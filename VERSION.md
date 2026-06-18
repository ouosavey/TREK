# VERSION

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
- **错误日志**：`Mixed Content: The page at 'https://trekcn.689894.xyz:9999/trips/1' was loaded over HTTPS, but requested an insecure XMLHttpRequest endpoint 'http://webapi.amap.com/subway/data/citylist.json'. This request has been blocked.`
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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## v3.0.22-cn.42 - 2026-06-18

### 变更
修复地铁图白屏（ReferenceError: useMemo is not defined）：
- **根因**：SubwayMapView.tsx 使用了 `useMemo` 但未在 import 中导入，导致 React 渲染时报 ReferenceError 白屏
- **修复**：import 语句添加 `useMemo`

### Docker 镜像
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## v3.0.22-cn.33 - 2026-06-17

### 变更
修复地铁图 JS API 加载失败（移除 iframe，改用直接脚本加载 + cbk 回调）：
- 根因：iframe 方案有 sandbox 警告 + about:srcdoc 继承父 CSP 问题
- 修复：移除 iframe，直接在主文档加载地铁图脚本，在 `window.cbk` 回调内创建 subway 实例（subway 全局函数仅在 cbk 回调内可用）
- 配合 v3.0.22-cn.32 的 CSP 修复（connectSrc 添加 http://*.amap.com）

### Docker 镜像
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## v3.0.22-cn.32 - 2026-06-17

### 变更
修复地铁图 JS API 加载失败（CSP 阻止问题）：
- 根因：CSP `connectSrc` 只有 `https://*.amap.com`，但地铁图 API 用 `http://webapi.amap.com/subway/data/citylist.json`（http 协议）被阻止
- 同时 `frameSrc: ["'none'"]` 禁止了 iframe 加载，`upgradeInsecureRequests` 会把 http 升级为 https
- 修复：CSP `connectSrc` 添加 `http://webapi.amap.com` 和 `http://*.amap.com`；`frameSrc` 改为允许 `'self'`；移除 `upgradeInsecureRequests`

### Docker 镜像
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

### 涉及文件
- `server/src/app.ts`

## v3.0.22-cn.31 - 2026-06-17

### 变更
修复地铁图 JS API 加载失败问题：
- 根因：高德地铁图 JS API 是 JSONP 风格，`subway` 全局函数仅在 `cbk` 回调内可用，脚本加载后 `window.subway` 不存在
- 修复：改用 iframe 加载完整 HTML 页面，严格遵循官方示例模式，在 `cbk` 回调内创建 subway 实例，通过 postMessage 通知父窗口加载状态

### Docker 镜像
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Planner/TransitRoutePanel.tsx`

---

## v3.0.22-cn.16 - 2026-06-16

### 变更
- 修复导出图片底部截断（克隆节点方案：深克隆面板到屏幕外，移除maxHeight/overflow限制，截图后删除克隆，真实DOM不受影响）
- 修复策略按钮文字换行（JSX添加whiteSpace:nowrap+克隆节点上也添加）
- 克隆节点方案同时解决：面板跳动、遮罩残留、底部截断、文字换行

### Docker 镜像
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Planner/TransitRoutePanel.tsx`

---

## v3.0.22-cn.15 - 2026-06-16

### 变更
- 修复导出时面板跳动和遮罩层残留（重写captureCanvas：style选项覆盖克隆节点+filter排除遮罩，不再修改真实DOM的position/display）
- 修复F12控制台fonts.loli.net CSS跨域读取报错（字体link标签添加crossorigin属性）

### Docker 镜像
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Planner/TransitRoutePanel.tsx`
- `client/index.html`

---

## v3.0.22-cn.14 - 2026-06-16

### 变更
- 恢复公交地铁路线导出图片到commit 77b7623完美版本（DOM操作+遮罩隐藏+滚动容器+inline-flex文字居中）
- 修复F12控制台CSP报错（connectSrc添加fonts.loli.net和gstatic.loli.net）

### Docker 镜像
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Planner/TransitRoutePanel.tsx`
- `server/src/app.ts`

---

## v3.0.22-cn.13 - 2026-06-15

### 变更
- 修复导出图片文字溢出背景色块（改用inline-flex+固定高度强制居中，绕过html2canvas的baseline计算bug）

### Docker 镜像
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

### 涉及文件
- `client/src/components/Planner/TransitRoutePanel.tsx`
- `client/src/components/Files/FileManager.tsx`

---

## v3.0.22-cn.4 - 2026-06-15

### 变更
- 修复手机端图片拖动时控制台大量 "Unable to preventDefault inside passive event listener" 报错
- 修复公交地铁路线导出图片文字和背景色块错位问题（html2canvas CSS变量解析）

### Docker 镜像
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

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
- `ghcr.io/ouosavey/trek:cn-localized`
- `ghcr.io/ouosavey/trek:cn-<sha>`

### 涉及文件
- `client/src/pages/TripPlannerPage.tsx`
- `client/src/components/Planner/DayPlanSidebar.tsx`
- `client/src/components/Planner/TransitRoutePanel.tsx`
- `client/src/components/Map/MapViewAMap.tsx`
- `client/src/components/Map/MapViewGL.tsx`
- `client/src/components/Files/FileManager.tsx`
- `.github/workflows/docker-cn.yml`
