# CHANGELOG

## 2026-06-16 修复导出图片全白（回退克隆方案，改用height参数）v3.0.22-cn.17

### Bug修复

#### 1. 修复导出图片全白
- **问题**: 克隆节点方案导致导出图片全白
- **根因**: html-to-image内部也会cloneNode，双重克隆+离屏定位(position:absolute;top:-9999px)导致SVG foreignObject渲染失败
- **修复**: 回退到直接在原面板上调用toCanvas（commit 2071584方案），但增加height/width参数：
  - 临时移除maxHeight获取scrollHeight（完整内容高度）
  - 立即恢复maxHeight（面板跳动极短，几乎不可见）
  - 将获取的完整尺寸作为width/height参数传给toCanvas
  - style选项覆盖克隆节点渲染，filter排除遮罩层
- **涉及文件**: `client/src/components/Planner/TransitRoutePanel.tsx`

## 2026-06-16 修复导出图片截断+策略按钮换行（克隆节点方案）v3.0.22-cn.16

### Bug修复

#### 1. 修复导出图片底部截断
- **问题**: 导出图片下部被截断，内容不完整
- **根因**: html-to-image的`style`选项只应用到克隆根节点，但`getImageSize`在style应用前就计算了尺寸（基于原始DOM的maxHeight:85vh），导致图片尺寸不够
- **修复**: 采用克隆节点方案——深克隆面板节点到屏幕外（position:absolute;top:-9999px），在克隆上移除maxHeight/overflow限制，截图后删除克隆。真实DOM完全不受影响

#### 2. 修复策略按钮文字换行
- **问题**: 导出图片中"最省钱""少步行"等策略按钮文字换行
- **根因**: 按钮缺少whiteSpace:nowrap，SVG foreignObject中宽度受限时文字换行
- **修复**: JSX中策略按钮添加whiteSpace:'nowrap'（永久修复），同时在克隆节点上也添加

#### 3. 克隆节点方案同时解决了之前的所有问题
- 面板跳动：不修改真实DOM的position
- 遮罩残留：不修改真实DOM的display
- 底部截断：克隆节点无maxHeight限制，getImageSize获取正确尺寸
- 文字换行：克隆节点上添加whiteSpace:nowrap
- **涉及文件**: `client/src/components/Planner/TransitRoutePanel.tsx`

## 2026-06-16 修复导出面板跳动+遮罩残留+控制台报错 v3.0.22-cn.15

### Bug修复

#### 1. 修复导出时面板跳动和遮罩层残留
- **问题**: 点击导出后，面板先跳到左侧再跳回中间，灰色半透明遮罩不消失
- **根因**: 旧方案直接修改真实DOM的position(display:none等)，导致面板位置变化和遮罩状态异常
- **修复**: 重写captureCanvas函数，核心策略变更：
  - 外层容器定位：不再修改真实DOM，改用html-to-image的`style`选项覆盖克隆节点
  - 遮罩层：不再修改display属性，改用`filter`回调排除（data-transit-overlay属性匹配）
  - 内部滚动容器：仍需临时修改真实DOM（移除overflow限制），但不影响面板位置
  - 移除所有inline-flex文字微调代码（之前多次验证在SVG foreignObject中导致全白）
- **涉及文件**: `client/src/components/Planner/TransitRoutePanel.tsx`

#### 2. 修复F12控制台fonts.loli.net CSS跨域读取报错
- **问题**: "Error inlining remote css file SecurityError: Failed to read the 'cssRules' property from 'CSSStyleSheet': Cannot access rules"
- **根因**: 字体CSS的`<link>`标签缺少`crossorigin`属性，浏览器以no-cors模式加载，JS无法读取跨域样式表的cssRules
- **修复**: 在`<link>`标签添加`crossorigin`属性，浏览器以CORS模式加载，fonts.loli.net CDN会返回Access-Control-Allow-Origin头
- **涉及文件**: `client/index.html`

#### 3. CSP connectSrc已添加fonts.loli.net（上一版本）
- 上一版本(v3.0.22-cn.14)已在CSP connectSrc中添加`https://fonts.loli.net`和`https://gstatic.loli.net`

## 2026-06-16 恢复完美导出图片 + 修复CSP控制台报错 v3.0.22-cn.14

### Bug修复

#### 1. 恢复公交地铁路线导出图片到完美版本
- **问题**: 导出图片顶部文字和截图不完整（回退到2071584版本后丢失了DOM操作逻辑）
- **根因**: 2071584版本只使用style选项，无法解决内部滚动容器截断和遮罩层问题
- **修复**: 恢复到commit 77b7623版本的captureCanvas函数，该版本导出图片完美：
  - 操作真实DOM：移除position:fixed→relative、移除maxHeight/overflow限制
  - 隐藏遮罩层（通过data-transit-overlay属性精确定位）
  - 内部滚动容器移除溢出隐藏
  - inline-flex微调文字位置（强制垂直居中+防止换行）
  - finally块恢复所有原始样式
- **涉及文件**: `client/src/components/Planner/TransitRoutePanel.tsx`

#### 2. 修复F12控制台CSP报错
- **问题**: 点击导出后控制台报错 "Connecting to 'https://fonts.loli.net' violates Content Security Policy directive: connect-src"
- **根因**: CSP的connectSrc缺少fonts.loli.net和gstatic.loli.net，html-to-image截图时尝试fetch远程CSS字体被阻止
- **修复**: 在CSP connectSrc中添加 `https://fonts.loli.net` 和 `https://gstatic.loli.net`
- **涉及文件**: `server/src/app.ts`

## 2026-06-15 修复导出图片文字溢出(inline-flex方案) v3.0.22-cn.13

### Bug修复

#### 1. 导出图片文字溢出背景色块（inline-flex 强制居中方案）
- **问题**: `line-height: 1` 仍然不够，html2canvas 对 inline 元素的 baseline/行高计算与浏览器根本性不同
- **根因**: html2canvas 内部使用自己的文本渲染引擎，不遵循浏览器 inline 元素的基线对齐规则
- **修复**: 对有背景色的元素改用 `display: inline-flex` + `align-items: center` + `justify-content: center` + 固定 `height = fontSize + paddingTop + paddingBottom`，完全绕过 line-height / baseline 计算
- **涉及文件**: `TransitRoutePanel.tsx`

## 2026-06-15 修复导出图片文字溢出(line-height:1) + 右键添加地点await缺失bug

### Bug修复

#### 1. 导出图片文字溢出背景色块（最终修复）
- **问题**: 导出图片中有背景色块的文字（如线路名标签"地铁2号线"）下移溢出色块
- **根因**: html2canvas 的 line-height 计算与浏览器不同，之前尝试 `lineHeight = fontSize + 'px'` 仍然偏大
- **修复**: 对所有有 background-color 的元素强制设置 `line-height: 1`，让行高等于字体大小，配合已有 padding 实现垂直居中。两处修复：内联 computed style 循环 + finalFixWalker 兜底遍历
- **涉及文件**: `TransitRoutePanel.tsx`

#### 2. 地图右键添加地点只能获取经纬度（关键 bug 修复）
- **问题**: 右键地图后弹窗只能填入经纬度，名称/地址/图片等均为空
- **根因**: `handleMapContextMenu` 中 AMap 分支的 IIFE 缺少 `await`——`mapsApi.reverseAmap()` 返回 Promise 但未被 await，导致 `data` 是 Promise 对象而非解析结果，`data.name`/`data.address` 始终为 undefined
- **修复**:
  - IIFE 改为 async IIFE 并加上 `await`
  - 条件判断增加 `data.poiName`（POI 名称比 addressComponent 更有意义）
  - 依赖数组补充 `mapProvider` 和 `hasAmapKey`
  - catch 中输出 warning 日志便于排查
- **涉及文件**: `TripPlannerPage.tsx`

## 2026-06-15 修复导出图片文字溢出 + 右键添加地点 + AMap图片

### Bug修复

#### 1. 导出图片文字溢出背景色块
- **问题**: 导出图片中有背景色块的文字下移溢出色块，与实际界面不一致
- **根因**: `:root` CSS 变量注入方案不够——html2canvas 在解析 Tailwind class 中的 `var()` 时仍无法正确计算 lineHeight/padding 等属性组合
- **修复**: 改用最可靠的方案——在 onclone 中遍历原始 DOM 和克隆 DOM，将每个元素的 **computed style 内联**到克隆元素上，html2canvas 直接读取内联样式
- **涉及文件**: `TransitRoutePanel.tsx`

#### 2. 地图右键添加地点慢且只能获取经纬度
- **问题**: 右键地图后弹窗打开慢，且名称/地址为空
- **根因**: 上一版改为先等逆地理编码再开弹窗，导致用户等待；且 PlaceFormModal 的 useEffect 在 prefillCoords 更新时会重置整个表单
- **修复**:
  - 改回先开弹窗再异步获取逆地理编码
  - PlaceFormModal useEffect 改为 `setForm(prev => ...)`，只在用户未输入时才填充 name/address
- **涉及文件**: `TripPlannerPage.tsx`, `PlaceFormModal.tsx`

#### 3. AMap 地点图片 404
- **问题**: `place-photo/amap:xxx` 仍返回 404
- **根因**: 中文维基百科对中国小地名覆盖率低
- **修复**: AMap 地点优先通过 AMap POI 详情 API (`/v3/place/detail`) 直接获取图片 URL，再 fallback 到中文维基 → 英文维基 → Wikimedia Commons
- **涉及文件**: `mapsService.ts`

## 2026-06-15 修复导出图片样式 + Google Fonts 国内可访问 + AMap 地点图片

### Bug修复

#### 1. 导出图片文字错位
- **问题**: html2canvas 导出的图片中文字位置偏移，与实际面板显示不一致
- **根因**: 之前只替换 inline style 中的 CSS 变量，但大部分样式来自 Tailwind class 中的 CSS 变量引用，html2canvas 解析 class 时无法解析 `var()`
- **修复**: 改用在 `onclone` 中向克隆文档注入 `:root { --var: value }` 样式块，让 html2canvas 在解析 class 时能正确解析所有 CSS 变量
- **涉及文件**: `TransitRoutePanel.tsx`

#### 2. 网页在国内打开很慢
- **问题**: Google Fonts (`fonts.googleapis.com`) 在国内被墙，导致页面加载超时
- **修复**: 将所有 Google Fonts 引用替换为国内 CDN `fonts.loli.net`：
  - `index.html` (MuseoModerno 字体)
  - `TripPDF.tsx` (Poppins 字体)
  - `JourneyBookPDF.tsx` (Inter 字体)
  - 服务端 CSP 头添加 `fonts.loli.net` 和 `gstatic.loli.net`
- **涉及文件**: `index.html`, `TripPDF.tsx`, `JourneyBookPDF.tsx`, `app.ts`

#### 3. AMap 地点图片获取失败 (404)
- **问题**: `place-photo/amap:xxx` 和 `place-photo/coords:xxx` 返回 404
- **根因**: `getPlacePhoto` 对 `amap:` 前缀走 Wikimedia 路径，但 `fetchWikimediaPhoto` 只查英文维基百科，对中国地名效果极差
- **修复**: AMap 地点优先查中文维基百科 (`zh.wikipedia.org`)，再 fallback 到英文维基和 Wikimedia Commons
- **涉及文件**: `mapsService.ts`

## 2026-06-15 修复导出图片截断 + 地图右键地点详情丢失

### Bug修复

#### 1. 导出图片底部被截断
- **问题**: 导出的图片下面被截断了很多内容（第3、4个方案看不到）
- **根因**: 面板有 `maxHeight: 90vh` + `overflow: hidden`，onclone 中改为 relative 后这些约束仍然截断内容
- **修复**: 在 onclone 中同时清除 `maxHeight`、`height`、`overflow` 属性
- **涉及文件**: `TransitRoutePanel.tsx`

#### 2. 地图右键点击添加地点只能获取经纬度
- **问题**: 右键地图弹出添加地点弹窗后，名称、地址、图片等详细信息都为空，只有经纬度
- **根因**: 原代码先调用 `setShowPlaceForm(true)` 打开弹窗（此时只有 lat/lng），再异步做逆地理编码。如果编码失败或慢了，弹窗已经用空数据初始化完毕，后续更新不生效
- **修复**: 改为先完成逆地理编码获取完整信息（name/address），再一次性设置 prefillCoords 并打开弹窗
- **涉及文件**: `TripPlannerPage.tsx`

## 2026-06-15 修复导出图片含菜单弹窗 + 搜索超时

### Bug修复

#### 1. 导出图片包含导出菜单弹窗
- **问题**: 截图中出现了"保存图片到本地"/"添加到旅行文件"的菜单弹窗
- **根因**: `setShowExportMenu(false)` 是 React 异步状态更新，html2canvas 在 DOM 实际更新前就执行了截图
- **修复**: 在隐藏菜单后增加双帧 `requestAnimationFrame` 等待，确保 DOM 更新完成后再截图
- **涉及文件**: `TransitRoutePanel.tsx`

#### 2. 地点搜索经常超时失败
- **问题**: 搜索"北京火神殿"等地点时，AMap autocomplete 反复报 `timeout of 8000ms exceeded`
- **根因**: AMap 接口需要经服务器代理到高德 API（中国服务器），8 秒超时在网络波动时不够
- **修复**: 将所有 AMap 相关接口的超时从 8000ms 提升到 15000ms
- **涉及文件**: `client.ts`, `TransitRoutePanel.tsx`

## 2026-06-15 修复导出图片全白问题

### Bug修复

#### 1. 公交地铁路线导出图片几乎全白
- **问题**: 导出图片几乎全白，只有右下角露出一小块内容
- **根因**: 面板使用 `position: fixed`，html2canvas 无法正确渲染固定定位元素（元素被定位到视口坐标，超出克隆文档范围）
- **修复**: 在 html2canvas 的 `onclone` 回调中：
  - 通过 `data-transit-export` 属性找到克隆的面板元素
  - 将 `position: fixed` 改为 `position: relative`
  - 清除 top/left/right/bottom/transform/zIndex 等定位属性
  - 隐藏遮罩层避免干扰截图
  - 内联所有 CSS 变量为实际值
- **涉及文件**: `TransitRoutePanel.tsx`

## 2026-06-15 修复导出图片缺少标题栏和策略标签

### Bug修复

#### 1. 公交地铁路线导出图片内容不完整
- **问题**: 导出的图片缺少标题栏（"公交/地铁路线"、时间标签、导出按钮）和策略选择标签（最快/最省钱/最少换乘/少步行），只截取了内部滚动区域
- **根因**: `contentRef` 放在了内部滚动内容区的 div 上，html2canvas 只截取了该 ref 包裹的部分
- **修复**: 将 `contentRef` 移到面板主体 div 上，使导出包含完整的标题栏 + 策略标签 + 内容区
- **涉及文件**: `TransitRoutePanel.tsx`

## 2026-06-15 修复图片拖动报错 + 导出图片样式错位

### Bug修复

#### 1. 手机端图片拖动时控制台大量报错
- **问题**: 拖动/缩放图片时，F12 控制台刷屏 "Unable to preventDefault inside passive event listener invocation"
- **根因**: React 的 `onTouchMove` 合成事件默认注册为 `passive: true`，但代码中调用了 `e.preventDefault()`
- **修复**: 将 touchmove 从 React 合成事件改为原生 `addEventListener('touchmove', fn, { passive: false })`
- **涉及文件**: `FileManager.tsx`

#### 2. 公交地铁路线导出图片与浮窗显示不一致
- **问题**: html2canvas 导出的图片中文字和背景色块错位，与面板实际显示不同
- **根因**: 面板组件大量使用 CSS 变量（`var(--bg-tertiary)` 等），html2canvas 无法解析这些变量值
- **修复**: 在 html2canvas 的 `onclone` 回调中遍历所有元素，将 CSS 变量替换为从 `getComputedStyle` 获取的实际颜色值
- **涉及文件**: `TransitRoutePanel.tsx`

## 2026-06-15 图片缩放最大倍数提升 + 照片预览缩放功能

### 功能增强

#### 1. 文件图片预览缩放倍数提升
- **手机端最大缩放从 10x 提升到 15x**，放大后可以看到更多细节
- 桌面端保持 10x 不变
- **涉及文件**: `FileManager.tsx`

#### 2. 照片预览（PhotoLightbox）新增缩放功能
- 之前照片预览不支持缩放，现在与文件图片预览功能一致
- 双指捏合缩放（手机端最大 15x，桌面端 10x）
- 双击放大到 3x / 再双击恢复
- 滚轮缩放、鼠标/触摸拖拽平移
- 键盘 +/- 缩放、0 重置
- 缩放时显示百分比指示和 1:1 重置按钮
- 未缩放时显示操作提示
- 左右滑动切换图片（未缩放时）
- 切换图片自动重置缩放
- **涉及文件**: `PhotoLightbox.tsx`

## 2026-06-15 图片预览缩放功能

### 新功能

#### 1. 文件图片预览支持缩放
- **鼠标滚轮缩放**: 滚轮上下滚动放大/缩小（0.5x ~ 8x）
- **双指捏合缩放**: 手机端双指手势缩放
- **双击切换**: 双击图片在 1x 和 3x 之间切换
- **拖拽平移**: 缩放后可拖拽移动图片（鼠标/单指触摸）
- **键盘快捷键**: `+` 放大、`-` 缩小、`0` 重置
- **缩放比例指示**: 放大时标题栏显示当前百分比（如 200%）
- **重置按钮**: 放大时标题栏出现 `1:1` 按钮，一键重置
- **底部提示**: 未缩放时显示操作提示文字
- 切换图片时自动重置缩放
- **涉及文件**: `FileManager.tsx`

## 2026-06-15 方案选中边框修复 + 导出图片功能

### Bug修复

#### 1. 方案选中边框不跟随切换
- **问题**: 点击方案2/3时，黑色边框始终停留在方案1上
- **根因**: `OptionCard` 的点击事件只触发了 `onToggle`（展开/收起），没有触发 `onSelect`（更新选中索引）
- **修复**: 点击方案时同时调用 `onSelect()` + `onToggle()`，边框随选中状态动态变化

### 新功能

#### 2. 导出为图片功能（弹窗选择）
- 标题栏新增绿色相机图标按钮
- 点击弹出选择菜单，两个选项：
  - **保存图片到本地** — 下载 PNG 到设备
  - **添加到旅行文件** — 上传到本次旅行的"文件"区域
- 使用 html2canvas 截图 (2x 分辨率)
- 文件名格式：`公交路线_YYYYMMDD_HHMM.png`
- 导出中按钮显示 loading 动画并禁用重复点击
- 点击遮罩层关闭菜单
- **涉及文件**: `TransitRoutePanel.tsx`, `DayPlanSidebar.tsx`, 新增依赖 `html2canvas`

## 2026-06-15 公交面板UI升级 + 精简调整

### 功能增强

#### 1. 时间线式导航布局
- 绿色"起"标记 + 红色"终"标记 + 彩色时间轴
- 地铁/公交段用线路颜色，步行段用灰色

#### 2. 方案卡片可折叠
- 标题栏简洁显示：序号 + 时长 + 步行距离 + "地铁N条，公交N条"
- 默认所有方案折叠，点击展开查看时间线详情
- 展开后显示：上车站 → 线路标签+方向 → N站 → 下车站 → 时长/距离

#### 3. 去掉模拟/占位数据
- 移除：列车到站时间预估、拥挤度、强冷弱冷提示、首末班时间、票价估算
- 这些数据高德API不提供，之前是模拟数据，已全部移除

#### 4. 去掉金额显示
- 顶部标题栏不再显示总金额
- 方案卡片不再显示票价

## 2026-06-15 修复手机端白屏 + 桌面端内容截断

### Bug修复

#### 1. 手机端点击"公交/地铁"按钮白屏 (根因修复)
- **根因**: `TripPlannerPage.tsx` 移动端 `onRouteCalculated` 回调中 `setRoute(r.coordinates)` 传了 `[number, number][]`，但 `setRoute` 期望 `[number, number][][]`。当地图组件渲染路线时，`seg.map(([lat, lng]) => ...)` 对单个数字做解构，抛出 `TypeError: number 30.61357263686864 is not iterable`
- **修复**: 移动端 `setRoute(r.coordinates)` → `setRoute([clean])`，桌面端同样增加坐标验证 + try-catch
- **涉及文件**: `client/src/pages/TripPlannerPage.tsx`

#### 2. 坐标数据清洗防御 (多层防护)
- 在3处 `allCoords` 收集点增加逐元素验证
- **涉及文件**: `client/src/components/Planner/DayPlanSidebar.tsx`

#### 3. 地图渲染防御性检查
- `MapViewAMap.tsx` 和 `MapViewGL.tsx` 路线渲染增加坐标清洗
- **涉及文件**: `client/src/components/Map/MapViewAMap.tsx`, `client/src/components/Map/MapViewGL.tsx`

#### 4. 桌面端公交面板内容截断
- 重构面板布局为 flex 三段式（标题固定 + 内容区独立滚动）
- **涉及文件**: `client/src/components/Planner/TransitRoutePanel.tsx`
