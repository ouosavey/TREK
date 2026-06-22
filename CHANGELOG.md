# CHANGELOG

## 2026-06-19 修复details禁用时autocomplete添加地点无分类 v3.0.22-cn.63

### Bug修复

#### 1. details 被禁用时 handleSelectMapsResult 不被调用（核心根因）
- **问题**：v3.0.22-cn.62 后部分地点仍无分类（如"八达岭长城(瓮城登长城入口)"）
- **根因**：当 `places_details_enabled` 为 false 时，后端 `/maps/details/:placeId` 返回 `{ place: null, disabled: true }`（HTTP 200）。前端 `handleSelectSuggestion` 中 `if (result.place)` 为 false，`handleSelectMapsResult` 不被调用，分类不会被设置，且无任何提示。这解释了"有的无分类"——通过 autocomplete 添加的地点无分类（details 被禁用），通过搜索结果列表添加的地点有分类（searchAmap 直接返回 category/typecode）
- **修复**：当 details 返回 null 或失败时，用 `searchAmap` 回退搜索地点名称，取第一个匹配结果的 category 和 typecode 进行分类匹配
- **涉及文件**：`client/src/components/Planner/PlaceFormModal.tsx`

#### 2. details 失败时也添加 searchAmap 回退
- **问题**：details API 调用失败（网络错误等）时只显示 toast.error，不尝试回退
- **修复**：catch 块中也添加 searchAmap 回退逻辑
- **涉及文件**：`client/src/components/Planner/PlaceFormModal.tsx`

---

## 2026-06-19 修复高德POI无type字段导致无分类+保存竞态 v3.0.22-cn.62

### Bug修复

#### 1. findAmapCategoryMapping 缺少 typecode 前2位回退（核心根因）
- **问题**：v3.0.22-cn.61 修复后部分地点仍无分类（如"八达岭长城(瓮城登长城入口)"）
- **根因**：高德 API 对某些 POI 不返回 `type` 字段（category 为空），但返回了 `typecode`。原 `findAmapCategoryMapping` 在 category 为空且 typecode 前4位不在 `AMAP_TYPECODE_MAP`（仅9个条目）中时返回 null，导致地点无分类
- **修复**：添加 `AMAP_TYPECODE_PREFIX2_MAP`（typecode 前2位→一级分类名映射，覆盖全部23个大类），在 category 匹配失败后用 typecode 前2位推断一级分类
- **示例**：八达岭长城 typecode=110200，前2位"11"→"风景名胜"→"景点"
- **涉及文件**：`client/src/constants/amapCategories.ts`

#### 2. 保存按钮竞态条件
- **问题**：用户通过自动补全选择地点后，details API 还在加载中时保存按钮可点击，导致 category_id 为空的地点被保存
- **修复**：保存按钮 disabled 条件添加 `isSearchingMaps`
- **涉及文件**：`client/src/components/Planner/PlaceFormModal.tsx`

#### 3. AMap details 获取失败无提示
- **问题**：handleSelectSuggestion 的 amap 路径中 details API 失败只 console.warn，用户无感知
- **修复**：添加 toast.error 提示用户分类可能无法自动匹配
- **涉及文件**：`client/src/components/Planner/PlaceFormModal.tsx`

---

## 2026-06-19 深入修复地点无分类（PWA缓存+类型签名+接口缺失） v3.0.22-cn.61

### Bug修复

#### 1. PWA Service Worker 缓存导致前端代码未更新（核心根因）
- **问题**：v3.0.22-cn.60 移除了 adminOnly 并添加了 await，但用户更新镜像后问题仍然存在
- **根因**：PWA Service Worker 配置只有 `registerType: 'autoUpdate'`，没有 `skipWaiting` 和 `clientsClaim`。新版本 Service Worker 会在后台下载安装但不立即激活，用户浏览器仍在使用旧前端代码缓存（没有 await 的版本）
- **修复**：`client/vite.config.js` 的 PWA workbox 配置添加 `skipWaiting: true` 和 `clientsClaim: true`，新版本 Service Worker 立即激活并控制所有客户端

#### 2. onCategoryCreated 类型签名错误
- **问题**：类型签名声明为 `(category: Category) => void`（返回 void），但实际使用 `await onCategoryCreated?.(...)` 期望返回 Promise
- **修复**：改为 `(category: Partial<Category>) => Promise<Category | undefined>`，TripPlannerPage 中改为 `async (cat) => { return await tripActions.addCategory?.(cat) }`

#### 3. Category 接口缺少 color 字段
- **问题**：`Category` 接口没有 `color` 字段，但 `findAmapCategoryMapping` 返回 `{ name, icon, color }`，导致类型不匹配
- **修复**：`client/src/types.ts` 的 `Category` 接口添加 `color?: string | null`

#### 4. AmapPoi 接口缺少 typecode 字段
- **问题**：`AmapPoi` 接口没有 `typecode` 字段声明，但代码中使用 `poi.typecode`
- **修复**：`server/src/services/mapsService.ts` 的 `AmapPoi` 接口添加 `typecode?: string`

#### 5. Google/OSM 路径和搜索结果列表点击缺少 await
- **修复**：所有调用 `handleSelectMapsResult` 的路径都添加 `await`

#### 6. 分类创建失败被静默吞掉
- **修复**：
  1. `handleSelectMapsResult` 中分类创建失败改为 `console.error` + `toast.error` 显示错误提示
  2. `TripPlannerPage` 的 useEffect 中 `.catch(err => console.error(...))` 打印错误日志
  3. `handleSelectMapsResult` 添加详细诊断日志

### 涉及文件
- `client/vite.config.js`（PWA skipWaiting + clientsClaim）
- `client/src/types.ts`（Category 接口添加 color）
- `client/src/components/Planner/PlaceFormModal.tsx`（类型签名+日志+错误提示+await）
- `client/src/pages/TripPlannerPage.tsx`（async onCategoryCreated+useEffect 错误日志）
- `server/src/services/mapsService.ts`（AmapPoi 接口添加 typecode）

## 2026-06-19 修复地点无分类根因+多边形搜索距离排序+导航功能 v3.0.22-cn.60

### Bug修复

#### 1. 地点无分类根因修复（权限限制 + 竞态条件）
- **问题**：v3.0.22-cn.59 已补充分类映射回退逻辑，但"八达岭长城(瓮城登长城入口)"等地点添加后依然无分类
- **根因1 - 权限限制**：`POST /api/categories` 路由有 `adminOnly` 中间件，非管理员调用返回 403。前端 `onCategoryCreated` 的 Promise 被 catch 静默吞掉，分类创建失败但用户无感知
- **根因2 - 竞态条件**：`PlaceFormModal.tsx` 中 `handleSelectMapsResult(result.place)` 未被 `await`，分类创建还未完成就提交了地点表单，地点的 `category_id` 为空
- **修复**：
  1. `server/src/routes/categories.ts`：移除 `POST /` 的 `adminOnly` 中间件，所有登录用户都可以创建分类
  2. `client/src/components/Planner/PlaceFormModal.tsx`：`handleSelectMapsResult(result.place)` 前添加 `await`

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

## 2026-06-19 修复分类映射+多边形搜索变白+手机端遮挡+地铁图缩放 v3.0.22-cn.59

### Bug修复

#### 1. 高德分类映射修复 - 很多地点添加后无分类
- **根因**：映射表只覆盖 19/23 个高德分类，映射不到时不创建新分类
- **修复**：补充剩余4个分类 + 映射不到时用高德原始分类名创建新分类

#### 2. 多边形搜索点击结果后地图变白
- **根因**：`handleResultItemClick` 误将 GCJ-02 坐标当作 WGS-84 二次转换，产生 NaN
- **修复**：移除 `wgs84ToGcj02` 转换，直接使用后端返回的 GCJ-02 坐标

#### 3. 手机端搜索结果列表被底部 tab 栏遮挡 + 可手动调整高度
- **根因**：`bottom: 64px` 硬编码，实际 tab 栏高 84px+
- **修复**：改用 `calc(var(--bottom-nav-h, 84px) + 12px)` + 新增可拖动把手调整高度

#### 4. 手机端地铁图双指缩放直接跳到最大/最小
- **根因**：缩放范围 [0.3, 1.3] 太窄，30% 张开就到最大
- **修复**：扩大到 [0.3, 3.0] + 灵敏度阻尼 `pow(rawScale, 0.5)`

### 涉及文件
- `client/src/constants/amapCategories.ts`
- `client/src/components/Map/MapViewAMap.tsx`
- `client/src/components/Map/SubwayMapView.tsx`

## 2026-06-19 修复地铁图缩放边界弹跳 v3.0.22-cn.58

### Bug修复

#### 1. 地铁图缩放到最小值时弹跳修复
- **问题**：缩放到最小（0.3）时继续滚动滚轮，地铁图不断弹跳缩放
- **根因**：curZoom 到达边界后仍调用 si.scale()，导致 API 内部反复执行缩放动画
- **修复**：先计算 newZoom，只有 newZoom !== curZoom 时才调用 si.scale()，到达边界保持不动
- **影响范围**：鼠标滚轮（电脑端）+ 双指 pinch（手机端）均已修复

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## 2026-06-19 修复公交/地铁路线详情选择短段线路 v3.0.22-cn.57

### Bug修复

#### 1. 公交/地铁路线详情选择错误线路（短段 vs 完整线路）
- **问题**：北京地铁1号线八通线应该是"环球度假区--苹果园"（30+站），但显示"苹果园--福寿岭"（只有2站）
- **根因**：高德 API 返回多条 buslines 含短段延伸线，之前评分逻辑让短段和完整段评分相同
- **修复**：将站点数作为最重要的评分因素，每个站点加 10 分（30站比2站多280分），确保选择完整线路

### 涉及文件
- `server/src/services/mapsService.ts`

## 2026-06-19 修复公交/地铁路线详情匹配错误线路 v3.0.22-cn.56

### Bug修复

#### 1. 公交/地铁路线详情匹配错误线路修复
- **问题**：展开"查看线路"时，有的线路详情是错误的，比如北京的地铁1号线八通线
- **根因**：后端代码总是取 `data.buslines[0]`（第一条结果），但高德 API 对"1号线八通线"的查询可能返回多条线路（1号线、八通线分开），第一条不一定匹配
- **修复**：新增评分匹配逻辑，从所有返回的 buslines 中找到最佳匹配：
  1. 将查询名拆分为线路标识，如 "1号线八通线" → ["1号线", "八通线"]
  2. 评分：精确匹配 +100，包含匹配 +50，每个关键词匹配 +20，所有关键词都匹配 +30，线路总距离加分
  3. 选评分最高的线路

### 涉及文件
- `server/src/services/mapsService.ts`

## 2026-06-19 修复公交/地铁路线详情报错 v3.0.22-cn.55

### Bug修复

#### 1. 公交/地铁路线详情"未找到该线路的详细信息"修复
- **问题**：展开"查看线路"时，有的线路显示"未找到该线路的详细信息 暂无详细站点信息"
- **根因**：高德 API 返回的 `line.start_time` / `line.end_time` 可能是数字而非字符串，直接调用 `.replace()` 报错 `TypeError: line.start_time.replace is not a function`，导致 `getAmapBusLineInfo` 函数 catch 后返回空结果
- **修复**：
  1. 新增 `fmtTime(t)` 辅助函数，先转为字符串再格式化
  2. 对 `line.via_stops` 增加 `typeof === 'string'` 类型检查
- **Docker 日志影响**：此错误在 Docker 日志中大量重复出现，修复后不再产生

### 涉及文件
- `server/src/services/mapsService.ts`

## 2026-06-18 根据 F12 日志精确修复路线标注+getLinelist+DataCloneError v3.0.22-cn.54

### Bug修复

#### 1. 路线标注几号线（根据实际数据结构精确解析）
- **问题**：路线规划完成后无法标注几号线
- **根因**：之前不知道 routeComplete 事件的实际数据结构
- **F12 日志揭示的实际数据结构**：`d.originalEvent._args.data.buslist[0].segmentlist[i].bus_key_name`，格式如 `"地铁12号线(南宝线)"`
- **修复**：
  1. 从 `bus_key_name` 提取线路名，去掉"地铁"前缀和方向信息括号
  2. 显示格式如 `"12号线(南宝线)"`
  3. 保留 DOM 备选方案

#### 2. getLinelist 方法修复
- **问题**：`TypeError: t is not a function`
- **根因**：API 方法名是 `getLinelist`（小写 l），必须传 callback 函数，之前无参数调用
- **修复**：改为 `si.getLinelist(function(l){...})`

#### 3. DataCloneError 修复
- **问题**：`Event object could not be cloned`
- **根因**：routeComplete 的 `d` 对象含 `originalEvent`（Event 对象），无法被 postMessage 克隆
- **修复**：不发送原始 `d` 对象，只发送提取的 `lineNames` 和 `info`

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## 2026-06-18 地铁图居中根因修复（move叠加）+ 路线标注高亮提取 v3.0.22-cn.53

### Bug修复

#### 1. 地铁图居中显示（根因修复 - move 叠加问题）
- **问题**：电脑版地铁图还是没有在整个屏幕居中显示
- **根因**：`move(deltaX, deltaY)` 是**相对偏移**，每次调用都会叠加！之前代码在 5 个时间点都调用 `doCenter()`，每次都调用 `si.move()`，导致偏移量叠加 5 次
- **修复**：
  1. 添加 `centered` 标志位，`move()` 只调用一次
  2. `setFitView()` 传入 SVG DOM 元素（官方文档用法）
  3. 减少调用时间点到 3 个（500ms、1500ms、3000ms），第一个成功后后续跳过

#### 2. 路线标注几号线（高亮线路提取改进）
- **问题**：DOM 备选方案提取所有含"号线"的文本，会提取所有线路名
- **修复**：路线规划后，路线涉及的线路会被高亮（opacity 较高），未涉及的会变暗
  1. 遍历 SVG text/tspan 元素及其父级，检查 opacity
  2. opacity > 0.5 的为高亮线路，只取这些作为路线涉及的线路

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## 2026-06-18 地铁图居中用 move() 方法 + 路线标注递归解析 v3.0.22-cn.52

### Bug修复

#### 1. 地铁图居中显示（根因修复）
- **问题**：电脑版地铁图还是没有在整个屏幕居中显示
- **根因**：`setFitView(obj)` 无参数调用不生效；`getCenter()` 方法官方文档不存在；`margin:0 auto` 对绝对定位 SVG 无效
- **修复**：改用官方 `move(deltaX, deltaY)` 方法手动计算偏移量居中
  1. 获取容器和 SVG 的 `getBoundingClientRect()`
  2. 计算偏移量让 SVG 中心对齐容器中心
  3. 调用 `si.move(deltaX, deltaY)` 移动到中心
  4. 只在 SVG 小于容器时才移动，避免大图被错误偏移

#### 2. 路线标注几号线（递归解析改进）
- **问题**：路线规划完成后仍无法标注几号线
- **修复**：
  1. 改用递归搜索方式解析 routeComplete 数据：深度优先遍历对象，搜索所有含"号线"或以"线"结尾的字符串字段
  2. 检查更多字段名：line、lineName、name、line_title、title、lineName_txt、lname
  3. 保留 DOM 备选方案

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## 2026-06-18 地铁图缩放修复 + 居中改进 + 路线标注 DOM 备选 v3.0.22-cn.51

### Bug修复

#### 1. 缩放失效修复（根因修复）
- **问题**：电脑端和手机端地铁图都不能缩放了
- **根因**：v3.0.22-cn.50 中添加的 CSS `#sc svg{...transform:translate(-50%,-50%)!important}` 用 `!important` 覆盖了地铁图 API 内部通过修改 transform 实现的缩放功能
- **修复**：移除所有 `#sc svg` 和 `#sc>div` 的强制 CSS，不干预地铁图 API 内部的 transform

#### 2. 电脑端左半边显示修复
- **问题**：电脑端地铁图只在屏幕左半边显示，右半边空白
- **根因**：同上，强制 CSS 的 `position:absolute` + `left:50%` 导致 SVG 定位错误
- **修复**：移除强制 CSS，改用 `setFitView()` + `setCenter(getCenter())` + JS 手动设置 `margin:0 auto` 居中

#### 3. 居中方案改进
- `setFitView()` 在 `subway.complete` 后分 5 个时间点调用（100ms、500ms、1000ms、2000ms、3000ms）
- 添加 `setCenter(getCenter())` 双重居中
- JS 手动获取 `#sc` 子元素设置 `margin:0 auto` + `display:block`

#### 4. 路线标注 DOM 备选方案
- 当 `subway.routeComplete` 事件数据解析失败时，从 SVG DOM 中提取含"号线"或以"线"结尾的文本作为线路名

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## 2026-06-18 地铁图居中显示 + 路线标注修复 v3.0.22-cn.50

### Bug修复

#### 1. 地铁图居中显示（根因修复）
- **问题**：无论手机还是电脑浏览器，城市地铁图都没有在屏幕居中显示
- **根因**：CSS flexbox 居中方案被地铁图 API 内部的 SVG 绝对定位覆盖；`setFitView()` 只调用一次，SVG 可能还没完全渲染
- **修复**：
  1. CSS 改为绝对定位 + transform 居中：`#sc svg{position:absolute!important;top:50%!important;left:50%!important;transform:translate(-50%,-50%)!important}`
  2. `setFitView()` 在 `subway.complete` 后多次调用（100ms、500ms、1000ms、2000ms）

#### 2. 路线标注几号线（数据结构调试）
- **问题**：路线规划完成后无法标注不同地铁线路是几号线
- **修复**：
  1. 扩展路线数据解析逻辑，兼容更多数据结构（数组、segments、route、lines、line_names、info.lines）
  2. 添加调试日志打印原始数据
  3. 把原始数据 JSON 通过 postMessage 发送到父页面

#### 3. getLineList 方法名修正
- 官方文档方法名是 `getLineList(callback)`（大写 L），改为优先调用此方法

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## 2026-06-18 地铁图全面修复（站点错误识别+粘鼠标+缩放恢复+去按钮+居中+路线标注）v3.0.22-cn.49

### Bug修复

#### 1. 站点点击错误识别（根因修复）
- **问题**：点击站点圆圈或空白处总是显示错误站点名（如"苹果园"）；点击"18号线"等线路名文字也弹出站点弹窗
- **根因**：`findStationName` 函数从任意元素遍历 DOM 树找 `<text>`，导致点击圆圈/空白时找到附近无关的 `<text>` 元素
- **修复**：
  1. 新增 `getStationNameFromTarget` 函数：仅当点击目标本身是 `<text>`/`<tspan>` 元素时才提取文本，不再遍历 DOM 树
  2. 新增 `isStationName` 过滤函数：过滤含"号线"的线路名（如"1号线""18号线"），以及以"线"结尾的短线路名（如"大兴线"）

#### 2. 切换城市后地图粘着鼠标（根因修复）
- **问题**：切换城市后点击站点，地铁图像粘着鼠标一样晃动
- **根因**：`si.destroy()` 未完全清理旧实例的事件监听器，新实例与旧实例的事件处理器冲突
- **修复**：切换城市时重建整个 iframe（将 `selectedAdcode` 加入 blob URL useEffect 依赖数组），而非 destroy+recreate 实例

#### 3. 切换城市后滚轮缩放恢复默认比例（根因修复）
- **问题**：切换城市后滚轮缩放结束，地铁图恢复默认比例
- **根因**：`ci()` 函数中 `curZoom=1.0` 重置了缩放变量，但旧实例的 wheel 事件监听器可能仍在运行
- **修复**：重建 iframe 后，新实例有全新的 wheel 事件监听器，不再有旧实例干扰

#### 4. 去掉缩放按钮
- 移除 `.zm` div 和 `#zi`/`#zo` 按钮及其事件处理器，只保留鼠标滚轮和双指缩放

#### 5. 居中显示改进
- CSS：`#sc` 添加 flexbox 居中，`#sc>div` 添加 `margin:auto !important`
- `setFitView()` 延迟从 500ms 增加到 1000ms

#### 6. 路线规划标注几号线
- `subway.routeComplete` 事件回调中解析路线数据，提取线路名称（兼容多种数据格式）
- 新增 `routeLines` state，路线信息栏显示线路名称（如"1号线 → 2号线 → 4号线"）

#### 7. Docker 日志重复4次
- 代码层面已确认无重复日志，问题在 NAS Docker 配置层面

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## 2026-06-18 地铁图全面修复（站点点击+无级缩放+居中+手机端遮挡+路线标注）v3.0.22-cn.48

### Bug修复

#### 1. 站点点击无反应（根因修复）
- **根因**：高德地铁图 API 内部 `triggerStationEvent` 调用 `formatStation` 时崩溃（`Cannot read properties of undefined`），导致 `station.touch` 事件永远不触发
- **修复**：三重站点点击检测方案：
  1. DOM click 监听（capture 阶段）：从 SVG 元素查找站点名称
  2. touchend 手势检测（手机端）：判断 tap 手势，用 `document.elementFromPoint` 获取元素
  3. stationName.touch 事件：监听站点名称点击事件

#### 2. 无级缩放（电脑端+手机端）
- 电脑端：鼠标滚轮 wheel 事件缩放（步长 0.1，范围 0.3~1.3）
- 手机端：双指 pinch 缩放（跟踪两指距离比例，实时调用 `si.scale()`）
- 缩放按钮步长从 0.2 改为 0.15

#### 3. 居中显示
- `subway.complete` 后 `setFitView()` + `setCenter(getCenter())` 双重居中

#### 4. 手机端工具栏被遮挡（根因修复）
- **根因**：SubwayMapView 被父级 stacking context 包裹，z-index 被限制
- **修复**：用 `createPortal` 渲染到 `document.body`，脱离父级 stacking context

#### 5. 路线标注
- 监听 `subway.routeComplete` 事件，显示路线完成提示
- `theme:"colorful"` 主题，不同线路显示不同颜色

#### 6. getLineList → getLinelist
- 官方方法名是 `getLinelist()`（小写 l），改为同步调用

## 2026-06-18 根据官方文档修复地铁图多项问题 v3.0.22-cn.47

### Bug修复

#### 1. 站点点击无反应（根因修复）
- **根因**：之前用的事件名 `subway.clickStation` 是错误的，官方文档（https://lbs.amap.com/api/subway-api/mobility-reference）的事件名是 `station.touch`
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

## 2026-06-18 修复地铁图交互+Docker日志重复4次 v3.0.22-cn.46

### Bug修复

#### 1. 地铁图站点点击无反应（切换城市后）
- **根因**：`easy:1` 模式内置 `formatStation`/`openTip` 崩溃（`Cannot read properties of undefined`），错误在 `clickStation` 事件触发前发生，导致事件永远不触发
- **修复**：移除 `easy:1` 模式，不再使用内置弹窗，改用自定义 `clickStation` 事件处理

#### 2. 地铁图不能缩放
- **根因**：CSS `touch-action: manipulation` 阻止了缩放手势
- **修复**：移除 `touch-action: manipulation`，添加自定义缩放按钮（+/−）

#### 3. 地铁图未居中显示
- **修复**：`subway.complete` 后延迟 500ms 调用 `setZoom(0.8)` + `setCenter(getCenter())`

#### 4. Docker 日志重复4次
- **根因**：`onListen` 回调可能被调用多次（tsx loader 或 NAS Docker 配置导致）
- **修复**：
  1. `index.ts` 添加 `onListen` 防重复守卫（闭包 `called` 标志）
  2. `docker-compose.yml` 添加 `logging` 配置（`json-file` 驱动）

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`
- `server/src/index.ts`
- `docker-compose.yml`
- `.gitignore`

## 2026-06-18 修复GitHub Actions重复工作流 + 排查Docker日志重复 v3.0.22-cn.45

### Bug修复

#### GitHub Actions 重复触发工作流
- **根因**：`docker-cn.yml` 的 concurrency group 为固定字符串 `cn-localized-build`，`cancel-in-progress: false`。当有多余推送（如 `feat: 优化手机端图片缩放体验`）时，会触发额外的工作流运行，且不会取消旧的
- **修复**：
  1. concurrency group 改为 `${{ github.workflow }}-${{ github.ref }}`，确保同一分支同一工作流只有一个运行
  2. `cancel-in-progress: true`，新推送自动取消旧的运行

### 排查

#### Docker 日志重复 3 次
- **代码层面确认无重复日志**：
  - `auditLog.ts` 中每个日志函数（`logInfo`/`logError`/`logWarn`/`logDebug`）只调用一次 `console.log`/`console.error`/`console.warn`
  - 请求日志中间件只有一处 `res.on('finish')` 监听
  - scheduler 有防重复机制（`if (currentTask) { currentTask.stop() }`）
  - 无 winston/pino/morgan 等第三方日志库
  - 无 cluster/worker/child_process 多进程
- **可能原因（NAS Docker 配置层面）**：
  1. NAS Docker 管理界面（群晖 Container Manager 等）可能同时启用了多种日志驱动
  2. 容器被重复创建或端口/卷被多次映射
  3. 某些 NAS 的 Docker 日志驱动对 dumb-init → su-exec → node 进程链的每个子进程都捕获日志
- **建议排查**：
  1. 在 NAS 上执行 `docker inspect trek --format='{{.HostConfig.LogConfig}}'` 检查日志驱动
  2. 检查 NAS 上是否有多个 trek 容器在运行：`docker ps | grep trek`
  3. 尝试在 docker-compose.yml 中显式指定日志驱动：
     ```yaml
     logging:
       driver: json-file
       options:
         max-size: "10m"
         max-file: "3"
     ```

### 涉及文件
- `.github/workflows/docker-cn.yml`

## 2026-06-18 修复地铁图多项交互问题 v3.0.22-cn.44

### Bug修复

#### 1. 站点点击报错 - API 内部 formatStation/openTip 崩溃
- **错误日志**：
  ```
  main?v=1.0&version=1.0.13:8 Uncaught TypeError: Cannot read properties of undefined (reading 'r')
  l.formatStation @ main?v=1.0&version=1.0.13:8
  A.fn.triggerStationEvent @ main?v=1.0&version=1.0.13:2
  main?v=1.0&version=1.0.13:8 Uncaught TypeError: Cannot read properties of undefined (reading 'n')
  m.fn.openTip @ main?v=1.0&version=1.0.13:8
  ```
- **根因**：高德地铁图 API `easy:1` 模式内置弹窗机制有 bug，点击站点时 `formatStation` 和 `openTip` 访问未定义的属性导致崩溃
- **修复**：
  1. 添加 `window.onerror` 全局错误处理器，捕获 API 内部错误防止崩溃
  2. 监听 `subway.clickStation` 事件获取站点数据
  3. 通过 postMessage 将站点数据发送给父页面
  4. 父页面显示自定义弹窗（站名 + "设为起点"/"设为终点"按钮）
  5. 选择后通过 postMessage 发送 `setStart`/`setEnd`/`setRoute` 消息给 iframe
  6. iframe 调用 `si.setStart(id)`/`si.setEnd(id)`/`si.setRoute(startId, endId)` 设置路线

#### 2. 地铁图未居中显示
- **修复**：
  1. `cbk` 回调中延迟 200ms 创建实例，确保容器完成布局
  2. `subway.complete` 后延迟 300ms 调用 `getSelectedLineCenter` + `setCenter` 居中

#### 3. 地铁图不能缩放
- **修复**：
  1. viewport 改为 `user-scalable=yes,maximum-scale=5.0,minimum-scale=0.5`
  2. CSS 添加 `touch-action:manipulation` 允许缩放手势

#### 4. 手机端工具栏被遮挡
- **根因**：地铁图覆盖层 z-index 为 2000，被侧边栏（"计划"/"地点"）遮挡
- **修复**：z-index 从 2000 提升到 9999

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## 2026-06-18 修复地铁图Mixed Content阻止请求 v3.0.22-cn.43

### Bug修复

#### 地铁图加载超时 - Mixed Content 阻止 HTTP 请求
- **错误日志**：
  ```
  [subway] cbk invoked
  [subway] creating instance adcode: 1100
  Mixed Content: The page at 'https://trekcn.689894.xyz:9999/trips/1' was loaded over HTTPS,
  but requested an insecure XMLHttpRequest endpoint 'http://webapi.amap.com/subway/data/citylist.json'.
  This request has been blocked; the content must be served over HTTPS.
  main?v=1.0&version=1.0.13:8 Uncaught ReferenceError: error is not defined
  ```
- **根因**：Blob URL 文档继承了父页面的 HTTPS origin（`https://trekcn.689894.xyz:9999`）。高德地铁图 JS API 内部用 XMLHttpRequest 请求 `http://webapi.amap.com/subway/data/citylist.json`（HTTP 协议），浏览器阻止了 Mixed Content（HTTPS 页面不允许 HTTP XHR 请求）。请求被阻止后，地铁图数据无法加载，`subway.complete` 事件永远不触发，10 秒后超时
- **修复**：在 Blob URL iframe 的 HTML `<head>` 中添加：
  ```html
  <meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">
  ```
  此 CSP 指令让浏览器在发起请求前，自动将所有 HTTP URL 升级为 HTTPS。地铁图 API 的 `http://webapi.amap.com/...` 请求会被升级为 `https://webapi.amap.com/...`，避免 Mixed Content 阻止

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## 2026-06-18 修复地铁图srcdoc内JS语法错误（改用Blob URL方案） v3.0.22-cn.42

### Bug修复

#### 地铁图一直显示"正在加载地铁图…" - srcdoc 内 JS SyntaxError（最终方案）
- **错误日志**：
  ```
  VM3047 about:srcdoc:18 Uncaught SyntaxError: missing ) after argument list (at VM3047 about:srcdoc:18:110)
  VM3058 about:srcdoc:18 Uncaught SyntaxError: missing ) after argument list (at VM3058 about:srcdoc:110)
  ```
- **根因**：v3.0.22-cn.41 的 srcdoc 方案中，HTML 内容用模板字符串拼接，内嵌 JavaScript 的括号匹配难以调试。`getLineList` 回调函数中闭括号 `)` 和 try 块的闭括号 `}` 缺失，导致 `SyntaxError: missing ) after argument list`。iframe 内脚本执行失败，cbk 回调永远不被调用，loading 一直显示
- **修复**：改用 **Blob URL** 方案，彻底解决 srcdoc 内嵌 JS 语法错误问题：
  1. `URL.createObjectURL(new Blob([html], {type: 'text/html'}))` 创建 blob: URL
  2. HTML 内容用数组 `.join('\n')` 构造，每行独立可读，避免模板字符串内嵌 JS 的语法错误
  3. 动态值用 `JSON.stringify()` 安全转义
  4. 不走网络请求 → PWA Service Worker 无法拦截（SW 只拦截 HTTP 请求）
  5. CSS 完全隔离 → 地铁图注入的 CSS 不影响父页面 tab 栏
  6. frameSrc 已允许 `blob:` → CSP 不会阻止
  7. Blob 文档无 CSP 限制 → 地铁图 API 可自由加载
- **额外修复**：`ci()` 函数中 `cr`（完成标志）未在切换城市时重置的 bug。首次加载成功后 `cr=true`，切换城市时 `cr` 未重置为 `false`，导致超时检测 `if(!cr)` 永远不触发，切换城市后如果加载失败会永远显示 loading

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

### 方案演进历史（供参考）
| 版本 | 方案 | 问题 |
|------|------|------|
| cn.29~cn.32 | 直接脚本加载 | CSP 阻止 / sandbox 警告 |
| cn.33 | iframe+srcdoc | CSP 继承问题 |
| cn.34~cn.36 | 直接脚本加载 | querySelector 错误 / tab 栏变形 |
| cn.37 | iframe+src (subway.html) | PWA SW navigateFallback 拦截 |
| cn.38 | iframe+src + denylist | 旧 SW 缓存仍在使用 |
| cn.39~cn.41 | iframe+srcdoc | JS 语法错误难以调试 |
| **cn.42** | **iframe+Blob URL** | **最终方案：每行独立+安全转义+不走网络** |

## 2026-06-18 修复地铁图srcdoc内JS语法错误 v3.0.22-cn.41

### Bug修复

#### 地铁图一直显示"正在加载" - srcdoc 内 JS SyntaxError
- **错误日志**：
  ```
  VM2978 about:srcdoc:18 Uncaught SyntaxError: missing ) after argument list (at VM2978 about:srcdoc:18:110)
  ```
- **根因**：v3.0.22-cn.39 的 srcdoc 方案中，用模板字符串直接拼接变量到 JavaScript 代码：
  ```javascript
  var key='${amapKey}';                                    // 第108行
  window._AMapSecurityConfig = { securityJsCode: '${amapSecurityCode}' };  // 第95行
  var adcode='${selectedAdcode}';                           // 第110行
  ```
  如果 `amapKey`、`amapSecurityCode` 或 `selectedAdcode` 中包含单引号 `'`、反斜杠 `\`、换行符等特殊字符，会破坏 JS 字符串的语法，导致 iframe 内脚本执行失败（SyntaxError），cbk 回调永远不被调用
- **修复**：用 `JSON.stringify()` 安全转义所有动态值：
  ```javascript
  var key=${JSON.stringify(amapKey)};           // → '95361b0f...'
  var adcode=${JSON.stringify(selectedAdcode)};  // → '1100'
  ```

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## 2026-06-18 修复地铁图白屏（useMemo未导入） v3.0.22-cn.40

### Bug修复

#### 地铁图白屏 - ReferenceError: useMemo is not defined
- **错误日志**：
  ```
  ReferenceError: useMemo is not defined
      at $Te (index-BfJz7q7M.js:11349:9013)
  Uncaught ReferenceError: useMemo is not defined
      at $Te (index-BfJz7q7M.js:11349:9013)
  ```
- **根因**：v3.0.22-cn.39 重写 SubwayMapView.tsx 时使用了 `useMemo` 构造 srcdoc HTML，但 import 语句中只导入了 `{ useEffect, useRef, useState, useCallback }`，漏掉了 `useMemo`
- **修复**：import 语句添加 `useMemo`

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`（import 添加 useMemo）

## 2026-06-18 用srcdoc方案彻底解决地铁图一直加载 v3.0.22-cn.39

### Bug修复

#### 地铁图 iframe 一直显示"正在加载地铁图"（最终方案）
- **现象**：点击地铁图按钮后，出现白色半透明遮罩并一直显示"正在加载地铁图…"
- **F12 控制台**：完全没有 `[subway.html]` 日志，只有主应用的 `index-xxx.js` 日志
  → 这证明 iframe 加载的是 index.html（主应用），不是 subway.html
- **根因链**：
  1. PWA Service Worker 配置了 `navigateFallback: 'index.html'`
  2. SW 会把所有导航请求（包括 iframe src 加载的 `/subway.html`）回退到 `index.html`
  3. 即使用户更新到 v3.0.22-cn.38（添加了 navigateFallbackDenylist），**旧的 SW 缓存可能仍在使用**
  4. SW 更新是异步的，用户无法立即让新配置生效
  5. iframe 实际加载的是主应用页面，cbk 回调永远不触发

- **最终方案：iframe srcdoc**
  - **原理**：将 subway.html 的内容作为字符串嵌入 React 组件中，用 iframe 的 `srcdoc` 属性直接注入 HTML
  - **为什么能彻底解决**：
    1. **不走网络请求**：srcdoc 是浏览器内部创建文档，不经过 HTTP 请求
    2. **不受 SW 拦截**：SW 只拦截网络请求，srcdoc 不经过网络
    3. **不需要用户清除缓存**：不依赖 SW 配置更新
    4. **CSS 隔离**：srcdoc 创建独立文档，地铁图注入的 CSS 不影响父页面
    5. **CSP 兼容**：about:srcdoc 协议在同源上下文中运行，不受 frameSrc 限制

- **实现细节**：
  - `useMemo` 构造包含 amapKey、securityCode、adcode 的完整 HTML 字符串
  - `<iframe srcDoc={subwayDoc}>` 替代 `<iframe src={url}>`
  - postMessage 通信逻辑保持不变（与之前 iframe 方案相同）
  - 城市切换通过 postMessage 发送 `switchCity` 消息，iframe 内部 destroy + 重建实例

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`（重写：srcdoc 替代 src）

### 方案演进历史（供参考）
| 版本 | 方案 | 问题 |
|------|------|------|
| cn.29~cn.32 | 直接脚本加载 | CSP 阻止 / sandbox 警告 |
| cn.33 | iframe+srcdoc | CSP 继承问题 |
| cn.34~cn.36 | 直接脚本加载 | querySelector 错误 / tab 栏变形 |
| cn.37 | iframe+src (subway.html) | PWA SW navigateFallback 拦截 |
| cn.38 | iframe+src + denylist | 旧 SW 缓存仍在使用 |
| **cn.39** | **iframe+srcdoc** | **完全绕过 SW，最终方案** |

## 2026-06-18 修复地铁图iframe一直显示"正在加载" v3.0.22-cn.38

### Bug修复

#### 地铁图 iframe 一直显示"正在加载地铁图"
- **现象**：点击地铁图按钮后，出现白色半透明遮罩并一直显示"正在加载地铁图…"，F12 控制台无 cbk 回调日志
- **根因**：PWA（vite-plugin-pwa）的 `navigateFallback: 'index.html'` 配置会把所有导航请求（包括 iframe 加载的 `/subway.html`）回退到 `index.html`。这导致 iframe 实际加载的是主应用页面（React SPA），而不是独立的 subway.html，因此：
  1. `window.cbk` 回调函数永远不会被定义（因为 subway.html 的脚本没执行）
  2. 高德地铁图脚本加载后调用 `cbk()` 会报错或静默失败
  3. 父页面永远收不到 `subwayComplete` 消息，loading 一直显示
- **修复**：在 `client/vite.config.js` 的 `navigateFallbackDenylist` 中添加 `/^\/subway\.html/`，让 Service Worker 不拦截 subway.html 的导航请求
- **官方文档**：https://vite-pwa-org.netlify.app/  Workbox 配置 - navigateFallbackDenylist

#### 改进 subway.html
1. **消息时机**：`subwayReady` 消息在 `createInstance` 之前发送，确保父页面先标记 iframe 就绪，能正确处理后续的 `subwayComplete` 消息
2. **调试日志**：添加详细的 `console.log` 日志（iframe 加载、参数、cbk 调用、subway.complete 事件等），方便排查问题
3. **超时兜底改进**：
   - createInstance 后 10 秒内没收到 `subway.complete` 事件 → 报超时
   - 脚本加载后 15 秒内 `cbk` 没被调用 → 报超时
   - 收到 complete/fail/error 后清除超时定时器

### 涉及文件
- `client/vite.config.js`（navigateFallbackDenylist 添加 `/subway\.html`）
- `client/public/subway.html`（改进消息时机 + 调试日志 + 超时兜底）

## 2026-06-18 用iframe方案彻底修复地铁图所有UI问题 v3.0.22-cn.37

### 背景
前几轮修复（v3.0.22-cn.35、cn.36）尝试用"卸载时清理 CSS"和"销毁重建实例"方案，但问题仍然存在：
1. tab 栏在地铁图显示期间就已经变形（CSS 污染在显示期间发生，不是卸载后才需要清理）
2. 城市切换仍然无反应（subway() 函数可能不支持多次调用）

### 解决方案：iframe 完全隔离

#### 1. 新增 client/public/subway.html
独立的地铁图页面，由 iframe 加载，实现完全的 CSS 隔离：
- 接收 URL 参数：key, securityCode, adcode
- 加载地铁图脚本 `https://webapi.amap.com/subway?v=1.0&key=xxx&callback=cbk`
- 在 cbk 回调内创建实例：`subway('subway-container', {adcode, easy:1})`
- 通过 postMessage 与父页面通信：
  - `subwayReady` - iframe 脚本加载完成
  - `subwayComplete` - 地铁图加载完成
  - `subwayLoading` - 正在加载
  - `subwayFail/Error/Timeout` - 错误
  - `subwayLineList` - 线路列表数据
- 接收父页面的消息：
  - `switchCity` - 切换城市（destroy 旧实例 + 重新创建）
  - `showLine` - 高亮指定线路（showLine + getSelectedLineCenter + setCenter）

#### 2. 重写 client/src/components/Map/SubwayMapView.tsx
用 iframe 加载 subway.html，通过 postMessage 通信：
- **iframe src**：`/subway.html?key=xxx&securityCode=xxx&adcode=xxx`（只在 amapKey 变化时重新加载）
- **城市切换**：通过 postMessage 发送 `switchCity` 消息，iframe 内部 destroy + 重新创建实例
- **线路列表**：接收 iframe 的 `subwayLineList` 消息，在工具栏下方显示线路列表面板
- **点击线路**：通过 postMessage 发送 `showLine` 消息，iframe 内部高亮该线路并居中

#### 3. 电脑端/手机端适配
- **工具栏**：手机端 padding 6px 10px / fontSize 12px，电脑端 8px 14px / 13px
- **城市选择器**：手机端 minWidth 90px / maxWidth 110px，电脑端 minWidth 120px
- **线路面板**：手机端 maxHeight 140px，电脑端 240px
- **底部导航栏**：手机端 bottom: var(--bottom-nav-h)（84px），电脑端 bottom: 0（--bottom-nav-h 为 0px）
- **路线提示**：手机端 fontSize 10px / maxWidth 160px，电脑端 11px / 220px
- **关闭按钮**：手机端 28x28px，电脑端 32x32px

### 为什么 iframe 方案能彻底解决问题
1. **tab 栏变形**：iframe 有独立的 DOM 和 CSS 上下文，地铁图注入的 CSS 完全不影响父页面
2. **城市切换**：iframe 内部可以自由 destroy + 重新创建实例，不受父页面 React 生命周期影响
3. **CSP 兼容**：frameSrc 已允许 'self'，scriptSrc 已允许 https://webapi.amap.com，connectSrc 已允许 http://*.amap.com
4. **PWA 兼容**：subway.html 会被 service worker 缓存，registerType: 'autoUpdate' 会自动更新

### 涉及文件
- `client/public/subway.html`（新增）
- `client/src/components/Map/SubwayMapView.tsx`（重写）

## 2026-06-18 修复地铁图城市切换+tab栏变形+线路名称 v3.0.22-cn.36

### Bug修复

#### 1. 城市切换点击无反应
- **根因**: 上一版（v3.0.22-cn.35）使用 `subway.setAdcode(adcode)` 方法切换城市，但该方法不可靠——可能不触发 `subway.complete` 事件，导致 loading 一直显示
- **修复**: 改用销毁重建方案：
  1. 在 cbk 回调里保存 `subwayFn`（全局函数）到 `subwayFnRef`
  2. 抽取 `createSubwayInstance(adcode)` 函数（用 `useCallback` 稳定引用）
  3. 切换城市时：destroy 旧实例 → 清空容器 → 用 `subwayFnRef.current(id, {adcode, easy:1})` 重新创建实例
  4. 不重新加载脚本，避免浏览器缓存导致 cbk 不触发
- **涉及**: `createSubwayInstance` 函数 + 副 useEffect（依赖 `selectedAdcode`）

#### 2. tab 栏拥挤变形
- **根因**: 地铁图脚本 `https://webapi.amap.com/subway?v=1.0` 加载后，在 `document.head` 注入了全局 CSS 样式（可能包含 `body { margin:0; overflow:hidden }` 等），污染了页面的 tab 栏布局
- **修复**: 在主 useEffect 中添加全局状态保存与恢复：
  1. 挂载时保存：viewport meta content、body className、body style.cssText、已有 style 标签集合
  2. 卸载时恢复：viewport meta content、body className、body style.cssText
  3. 卸载时移除新增的 style 标签（只移除 textContent 包含 `amap`/`subway`/`BMap` 关键词的）

#### 3. 路线规划线路名称标注
- **需求**: 用户在地铁图上设置起点和终点后，需要知道是几号线才方便搭乘
- **限制**: easy 模式下路线规划结果由 API 自动渲染，无法直接获取路线经过的线路名称
- **方案**: 添加线路列表面板：
  1. 在 `subway.complete` 事件后调用 `subway.getLineList(callback)` 获取当前城市所有线路
  2. 顶部工具栏添加"线路"按钮，点击展开/收起线路列表面板
  3. 面板显示每条线路的名称和颜色色块，用户可对照路线颜色识别是几号线

#### 4. 居中显示
- 地铁图加载后由 API 自动适配视图，无需额外处理

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## 2026-06-18 修复地铁图UI问题（城市切换+布局+居中） v3.0.22-cn.35

### Bug修复

#### 1. 城市切换点击无反应
- **根因**: 每次切换城市都重新加载地铁图脚本（`https://webapi.amap.com/subway?v=1.0&key=xxx&callback=cbk`），但浏览器缓存了脚本后，`cbk` 回调不会再次触发，导致切换城市后地铁图不更新
- **修复**: 拆分 useEffect 为两个：
  1. 主 useEffect（依赖 `amapKey, amapSecurityCode`）：只加载一次脚本和创建实例
  2. 副 useEffect（依赖 `selectedAdcode`）：用 `subway.setAdcode(adcode)` 方法切换城市，不重新加载脚本
- **API 参考**: `setAdcode(adcode)` - 设置 adcode（城市编码），参考手册 https://lbs.amap.com/api/subway-api/mobility-reference

#### 2. 地铁图遮挡顶部菜单和 tab 栏
- **根因**: 地铁图组件用 `position: fixed; top: 0; bottom: 0; z-index: 2000` 全屏覆盖，遮住了 Navbar（高度 `var(--nav-h)`）和 Tab 栏（高度 44px）
- **修复**: 改为 `top: calc(var(--nav-h) + 44px)`，定位在 Navbar + Tab 栏下方，顶部菜单和 tab 栏保持不变
- **布局参考**: TripPlannerPage 的内容区也是 `top: calc(var(--nav-h) + 44px)`

#### 3. 地铁图未居中显示
- **修复**: 在 `subway.complete` 事件后，尝试调用 `subway.getSelectedLineCenter()` 获取中心点并 `setCenter()` 居中

#### 4. 顶部 tab 栏拥挤变形
- **根因**: 地铁图全屏覆盖导致布局异常
- **修复**: 修复布局后（不再覆盖 tab 栏），tab 栏恢复正常

### 涉及文件
- `client/src/components/Map/SubwayMapView.tsx`

## 2026-06-18 修复地铁图subway实例创建失败 v3.0.22-cn.34

### Bug修复

#### 地铁图 JS API 实例创建失败（querySelector 选择器无效）
- **错误日志**:
  ```
  [SubwayMapView] Failed to create subway instance: SyntaxError: Failed to execute 'querySelector' on 'Document': '#[object HTMLDivElement]' is not a valid selector.
      at qs (main?v=1.0&version=1.0.13:7:26024)
      at new A (main?v=1.0&version=1.0.13:2:3453)
      at s (main?v=1.0&version=1.0.13:1:430)
      at window.cbk (index-C6vai1VR.js:11349:9303)
  ```
- **根因**: 高德地铁图 JS API 的 `subway(id, opts)` 构造函数，第一个参数应为容器的 **id 字符串**（如 `"mysubway"`），而非 DOM 元素。代码错误传入了 `containerRef.current`（DOM 元素），高德 API 内部做 `'#' + container` 拼接得到 `'#[object HTMLDivElement]'`，导致 `document.querySelector('#[object HTMLDivElement]')` 抛出 SyntaxError
- **官方文档**: https://lbs.amap.com/api/subway-api/mobility-reference
  > subway(id,opts) 其中 id 为容器的 id
- **官方示例**: `var mysubway = subway("mysubway", {easy: 1});`
- **修复**:
  1. 给容器 div 添加固定 `id="subway-map-container"`（常量 `SUBWAY_CONTAINER_ID`）
  2. `subway()` 调用改为传入 id 字符串：`subwayFn(SUBWAY_CONTAINER_ID, { adcode, easy: 1 })`
  3. 修复超时逻辑闭包 bug：用局部变量 `loadCompleted` 跟踪加载状态，避免闭包里 `loading` 永远为 `true`（React setState 是异步的，闭包捕获的值不会更新）导致 15 秒后误报超时
- **涉及文件**: `client/src/components/Map/SubwayMapView.tsx`

## 2026-06-17 修复地铁图加载失败（移除iframe+直接脚本加载） v3.0.22-cn.33

### Bug修复

#### 地铁图 JS API 加载失败（iframe 方案问题）
- **根因**: 上一版使用 iframe 加载地铁图，存在两个问题：
  1. iframe `sandbox="allow-scripts allow-same-origin"` 触发安全警告
  2. `about:srcdoc` 文档继承父页面 CSP，地铁图 API 的 `http://webapi.amap.com` 请求仍被阻止
- **修复**: 移除 iframe，改用直接在主文档加载地铁图脚本：
  1. 定义 `window.cbk` 回调函数（脚本加载完成后调用）
  2. 在 `cbk` 回调内创建 `subway(container, {adcode, easy:1})` 实例（subway 全局函数仅在 cbk 回调内可用）
  3. 通过 `subway.event.on('subway.complete', ...)` 监听加载完成
  4. 组件卸载时清理 cbk 回调、subway 实例和 script 标签
- **配合**: 需要 v3.0.22-cn.32 的 CSP 修复（connectSrc 添加 `http://*.amap.com`，移除 `upgradeInsecureRequests`）
- **涉及文件**: `client/src/components/Map/SubwayMapView.tsx`

## 2026-06-17 修复地铁图CSP阻止问题 v3.0.22-cn.32

### Bug修复

#### 地铁图 JS API 加载失败（CSP 阻止）
- **根因**: 三个 CSP 策略问题导致地铁图无法加载：
  1. `connectSrc` 只有 `https://*.amap.com`，但地铁图 API 用 `http://webapi.amap.com/subway/data/citylist.json`（http 协议）被 CSP 阻止
  2. `frameSrc: ["'none'"]` 禁止了所有 iframe 加载（地铁图组件用 iframe 实现）
  3. `upgradeInsecureRequests` 会把 http 请求自动升级为 https，但地铁图 API 不支持 https
- **修复**: 
  1. `connectSrc` 添加 `http://webapi.amap.com` 和 `http://*.amap.com`
  2. `frameSrc` 从 `["'none'"]` 改为 `["'self'", "blob:", "data:"]`
  3. `upgradeInsecureRequests` 设为 `null`（禁用 http→https 自动升级）
- **涉及文件**: `server/src/app.ts`

## 2026-06-17 修复地铁图JS API加载失败 v3.0.22-cn.31

### Bug修复

#### 地铁图JS API加载失败（"subway global not found"）
- **根因**: 高德地铁图 JS API 是 JSONP 风格脚本，`subway` 全局函数仅在 `cbk` 回调函数内可用。脚本 `onload` 触发后 `window.subway` 并不存在，导致 "subway global not found" 错误
- **修复**: 完全重写 `SubwayMapView.tsx`，改用 iframe 加载完整 HTML 页面：
  1. 严格遵循官方示例模式：在 `window.cbk` 回调内创建 `subway("mysubway", {adcode, easy:1})` 实例
  2. 通过 `postMessage` 通知父窗口加载状态（`subway_ready`/`subway_complete`/`subway_fail`/`subway_error`）
  3. iframe 隔离全局变量，避免与主应用的 AMap JS API 2.0 冲突
  4. 15秒超时兜底
- **涉及文件**: `client/src/components/Map/SubwayMapView.tsx`

## 2026-06-17 修复高德新功能第四轮测试反馈 v3.0.22-cn.30

### Bug修复

#### 1. 公交线路查询500错误（彻底修复）
- **根因**: 上一版只包裹了fetch异常，但 `response.json()` 解析异常（AMap返回非JSON时）仍会抛错导致500
- **修复**: 整个 `getAmapBusLineInfo` 函数体包裹 try-catch，JSON解析也单独 try-catch，任何异常都返回空结果
- **涉及文件**: `server/src/services/mapsService.ts`

#### 2. 地铁图JS API加载失败
- **根因**: 使用动态回调名 `__subway_cb_<timestamp>`，高德地铁图脚本可能不支持任意回调名
- **修复**: 使用官方示例的固定回调名 `cbk`，同时添加 `script.onload` 作为后备触发机制，超时延长至15秒
- **涉及文件**: `client/src/components/Map/SubwayMapView.tsx`

#### 3. 多边形搜索结果被底部tab栏遮挡
- **根因**: 手机端弹窗 `bottom: 12px` 被底部tab栏（约56px高）遮挡
- **修复**: 手机端弹窗 `bottom: 64px`（tab栏上方），最大高度170px（约3个结果）
- **涉及文件**: `client/src/components/Map/MapViewAMap.tsx`

#### 4. 多边形搜索点击结果不居中
- **根因**: 搜索结果是WGS-84坐标，直接传给高德地图 `setZoomAndCenter` 会有偏移
- **修复**: 点击结果时先用 `wgs84ToGcj02` 转换坐标，再定位地图
- **涉及文件**: `client/src/components/Map/MapViewAMap.tsx`

## 2026-06-17 修复高德新功能第三轮测试反馈 v3.0.22-cn.29

### Bug修复

#### 1. 公交线路查询500错误
- **根因**: `getAmapBusLineInfo` 中 `if (!response.ok) throw new Error()` 导致路由catch后返回500
- **修复**: fetch异常和HTTP错误时返回空结果（`{ stops: [], basicStops: [], ... }`）而非抛错，重试也加try-catch
- **涉及文件**: `server/src/services/mapsService.ts`

#### 2. 地铁图JS API加载失败（"地铁图组件未就绪"）
- **根因**: 三个错误：
  1. 全局对象是 `subway`（小写），不是 `Subway` 或 `AMap.Subway`
  2. 事件名是 `subway.complete`（带点），不是 `subwayComplete`
  3. adcode 是4位（如北京 `1100`），不是6位（`110000`）
- **修复**: 重写 `SubwayMapView.tsx`，使用正确的全局对象 `window.subway`、事件名 `subway.complete`、4位adcode
- **涉及文件**: `client/src/components/Map/SubwayMapView.tsx`

#### 3. 多边形搜索结果UI遮挡问题
- **根因**: 上一版将结果面板移到左侧，但仍被左边栏遮挡；手机端高度过大
- **修复**: 改为底部居中弹窗（类似地点详情弹窗）：
  - 手机端：宽度 `calc(100% - 24px)`，最大高度180px（约3个结果）
  - 电脑端：宽度420px，最大高度360px（约6个结果）
  - 添加毛玻璃背景效果
- **涉及文件**: `client/src/components/Map/MapViewAMap.tsx`

#### 4. "风景名胜"分类未归类到景点
- **根因**: `handleSelectMapsResult` 中 `if (!form.category_id)` 使用闭包值，可能过期；异步创建分类时序问题
- **修复**: 重构自动分类逻辑：
  1. 在 `setForm` 之前先计算映射和查找已有分类
  2. 同步设置已有分类的 `category_id`
  3. 异步创建新分类后再 `setForm` 更新
- **涉及文件**: `client/src/components/Planner/PlaceFormModal.tsx`

## 2026-06-17 修复高德新功能第二轮测试反馈 v3.0.22-cn.28

### Bug修复

#### 1. 点击地点黑屏（严重）
- **根因**: `place.website` 字段可能为 `null`/`undefined`/数字等非字符串类型，调用 `.trim()` 时抛出 `TypeError: Ie.website.trim is not a function`，导致整个组件树崩溃、页面全黑
- **修复**: 使用 `typeof rawWebsite === 'string'` 类型检查后再调用 `.trim()`，非字符串类型直接返回空
- **涉及文件**: `client/src/components/Planner/PlaceInspector.tsx`

#### 2. "打开网站"按钮无网址时仍显示
- **根因**: 与黑屏问题同源，website 字段类型不确定
- **修复**: 统一使用类型安全的 IIFE 模式，非字符串或空字符串时不渲染按钮
- **涉及文件**: `client/src/components/Planner/PlaceInspector.tsx`

#### 3. 删除3D地图视图功能
- **原因**: 用户反馈不实用，且按钮位置容易遮挡其他功能
- **修复**: 移除 `is3D` 状态、`setPitch` useEffect、3D按钮、`viewMode:'3D'` 初始化参数、`Box` 图标导入
- **涉及文件**: `client/src/components/Map/MapViewAMap.tsx`

#### 4. 公交线路查询500错误
- **根因**: 线路名包含方向信息如 `轨道3号线(沌阳大道--宏图大道)`，高德 `/v3/bus/linename` API 无法匹配
- **修复**:
  - 前端：去除所有括号内容及破折号方向描述（`/\([^)]*\)/g` + `/--.*$/`）
  - 后端：第一次查询失败后自动用清理后的线路名重试
- **涉及文件**: `client/src/components/Planner/TransitRoutePanel.tsx`, `server/src/services/mapsService.ts`

#### 5. 公交路线查询500错误
- **根因**: `calculateAmapTransitRoute` 在高德API返回无路线时 `throw new Error()`，被路由catch后返回500
- **修复**: 改为返回空 `options` 数组，让前端优雅处理"无路线"情况
- **涉及文件**: `server/src/services/mapsService.ts`

#### 6. 地铁图JS API加载失败
- **根因**: `AMap.Subway` 不是通过 `AMap.plugin('AMap.Subway')` 加载的插件，而是需要独立加载 `https://webapi.amap.com/subway?v=1.0&key=xxx&callback=xxx` 脚本，全局对象为 `Subway`（非 `AMap.Subway`）
- **修复**: 重写 `SubwayMapView.tsx`，使用动态 `<script>` 标签加载地铁图JS，通过 callback 回调通知加载完成，全局状态管理避免重复加载
- **涉及文件**: `client/src/components/Map/SubwayMapView.tsx`

#### 7. 多边形区域搜索UI遮挡问题
- **根因**:
  - 手机端：搜索栏在 `bottom: 20` 被底部tab栏遮挡
  - 电脑端：结果面板在 `right: 12` 被添加地点右边栏遮挡
- **修复**:
  - 搜索栏从底部移到顶部（按钮栏下方，`top: 48/56`）
  - 结果面板从右侧移到左侧（`left: 8/12`），避免被右侧栏遮挡
  - 手机端宽度 `calc(100% - 16px)`，桌面端固定 280px
  - 所有字体/间距按 `isMobile` 分别适配
- **涉及文件**: `client/src/components/Map/MapViewAMap.tsx`

## 2026-06-17 修复高德新功能测试反馈 v3.0.22-cn.27

### Bug修复

#### 1. "打开网站"按钮无网址时仍显示
- **根因**: `googleDetails?.website` 可能为空字符串，条件判断 `place.website || googleDetails?.website` 对空字符串为 truthy
- **修复**: 增加 `.trim()` 检查，确保空字符串和纯空白字符串不触发按钮显示
- **涉及文件**: `client/src/components/Planner/PlaceInspector.tsx`

#### 2. URI API导航在HarmonyOS 6.1无法调起高德APP
- **根因**: `https://uri.amap.com/navigation?callnative=1` 在 HarmonyOS 浏览器中无法调起高德APP
- **修复**: 移动端优先使用 `androidamap://route/plan/` 深度链接，1.5秒后若未跳转则降级到 uri.amap.com 网页版
- **涉及文件**: `client/src/components/Planner/PlaceInspector.tsx`

#### 3. 3D地图视图不生效 + 按钮被遮挡
- **根因1**: AMap `setPitch()` 需要 `viewMode: '3D'` 初始化参数才能生效
- **修复1**: 地图初始化时添加 `viewMode: '3D'`
- **根因2**: 3个功能按钮在右侧纵向排列，被添加地点右边栏遮挡
- **修复2**: 按钮移到顶部居中横向排列，毛玻璃背景，移动端适配（按钮32x32，桌面36x36）
- **涉及文件**: `client/src/components/Map/MapViewAMap.tsx`

#### 4. 公交信息查询多项修复
- **首末班时间格式**: AMap返回"0600"格式，正则替换为"06:00"
- **站点列表标注**: 本段行程的上车站/下车站用绿色/红色圆点+"上车"/"下车"标签特别标注
- **北京线路查不到**: 逆地理编码返回"北京市"但API需要"北京"（去掉"市"后缀）+ 线路名去掉方向信息如"地铁1号线(四惠东方向)"
- **涉及文件**: `server/src/services/mapsService.ts`, `client/src/components/Planner/TransitRoutePanel.tsx`

#### 5. 地铁图JS API加载失败
- **根因**: `AMap.Subway` 是独立插件，不能通过 `AMapLoader.load({plugins: ['AMap.Subway']})` 加载
- **修复**: 先加载AMap主库，再用 `AMap.plugin('AMap.Subway', callback)` 单独加载插件
- **增强**: 添加10秒超时兜底 + `subwayFail` 事件监听 + try-catch异常捕获
- **涉及文件**: `client/src/components/Map/SubwayMapView.tsx`

#### 6. 功能按钮布局优化
- 按钮从右侧纵向排列改为顶部居中横向排列
- 毛玻璃背景效果（`backdropFilter: 'blur(8px)'`）
- 移动端适配：按钮32x32，图标16px；桌面端36x36，图标18px
- **涉及文件**: `client/src/components/Map/MapViewAMap.tsx`

---

## 2026-06-17 新增6项高德地图功能 v3.0.22-cn.26

### 新功能

#### 1. 功能8：URI API（调起高德地图APP导航）
- 在地点弹窗中添加"导航"按钮，点击后调起高德地图APP或网页版进行导航
- 使用高德URI API `https://uri.amap.com/navigation`，支持 `callnative=1` 调起原生APP
- 自动将WGS-84坐标转换为GCJ-02坐标
- **涉及文件**: `client/src/components/Planner/PlaceInspector.tsx`

#### 2. 功能3：IP 定位（首次打开自动定位当前城市）
- 地图首次加载时（默认中心为巴黎），自动调用高德IP定位API获取用户当前城市
- 获取到位置后自动将地图中心移动到用户所在城市，zoom设为12
- IP定位返回GCJ-02坐标，可直接用于AMap
- **涉及文件**: `server/src/services/mapsService.ts`（新增`ipLocateAmap`函数）, `server/src/routes/maps.ts`（新增路由）, `client/src/api/client.ts`, `client/src/components/Map/MapViewAMap.tsx`

#### 3. 功能12：3D 地图视图
- 在地图右上角添加3D切换按钮（Box图标）
- 点击切换2D/3D视图，3D模式下地图pitch设为55度
- 使用AMap的`setPitch()`API实现平滑切换
- **涉及文件**: `client/src/components/Map/MapViewAMap.tsx`

#### 4. 功能4：多边形区域搜索（框选区域搜索POI）
- 在地图右上角添加区域搜索按钮（Search图标）
- 点击后进入绘制模式，用户在地图上点击添加多边形顶点
- 实时显示多边形轮廓和顶点标记
- 完成绘制后输入搜索关键词（如"餐厅"、"酒店"），搜索区域内POI
- 搜索结果用蓝色圆点标记显示，可点击查看详情
- 支持结果列表面板，点击列表项可定位到地图标记
- **涉及文件**: `server/src/services/mapsService.ts`（新增`searchAmapPolygon`函数）, `server/src/routes/maps.ts`, `client/src/api/client.ts`, `client/src/components/Map/MapViewAMap.tsx`

#### 5. 功能5：公交信息查询（站点/线路详情）
- 在TransitRoutePanel中，每条公交/地铁线路段旁添加"查看线路"按钮
- 点击后调用高德公交线路API获取完整线路信息
- 显示线路名称、总站数、总距离、首末班时间
- 完整站点列表（可滚动），首站绿色、末站红色高亮
- 城市信息从线路坐标反查获取
- **涉及文件**: `server/src/services/mapsService.ts`（新增`getAmapBusLineInfo`函数）, `server/src/routes/maps.ts`, `client/src/api/client.ts`, `client/src/components/Planner/TransitRoutePanel.tsx`

#### 6. 功能6：地铁图 JS API（独立地铁线路图视图）
- 新建`SubwayMapView`组件，使用高德`AMap.Subway`插件
- 支持30个城市地铁图（北京、上海、广州、深圳、成都、杭州等）
- 顶部城市选择器，选择后加载该城市地铁线路图
- 全屏覆盖层显示，右上角关闭按钮
- 加载状态和错误提示
- 在地图右上角添加地铁图切换按钮（Train图标）
- **涉及文件**: `client/src/components/Map/SubwayMapView.tsx`（新建）, `client/src/components/Map/MapViewAMap.tsx`

## 2026-06-17 修复网址协议+扩展分类映射+修复左侧图片 v3.0.22-cn.25

### Bug修复

#### 1. 修复网址跳转将http强制改为https的问题
- **问题**: 黄鹤楼等网站的网址是http://，项目强制改为https://导致无法打开
- **修复**: 保留原始协议，只在完全没有协议前缀时才添加http://
- **涉及文件**: `client/src/components/Planner/PlaceInspector.tsx`

#### 2. 扩展分类映射（二级分类精确匹配）
- **需求**: 飞机场→飞机、火车站→火车、码头→船舶、汽车站→汽车、地铁→轨道交通
- **实现**:
  - 新增`AMAP_TYPECODE_MAP`二级分类映射表，基于高德typecode前4位精确匹配
  - 新增`findAmapCategoryMapping()`函数，优先按typecode匹配，回退到一级分类
  - mapsService返回完整category字符串（不再截取一级分类），保留二级分类信息
- **新增分类**: 飞机、火车、船舶、轨道交通
- **涉及文件**: `client/src/constants/amapCategories.ts`, `client/src/components/Planner/PlaceFormModal.tsx`, `server/src/services/mapsService.ts`, `client/src/pages/TripPlannerPage.tsx`

#### 3. 修复左侧计划栏地点显示分类图标而非图片
- **根因**: `assignmentService.ts`和`dayService.ts`的SQL查询和返回对象缺少`osm_id`字段
- **影响**: 左侧DayPlanSidebar中的PlaceAvatar无法通过photoService获取AMap地点图片（因为缺少`amap:BVXXX`格式的osm_id）
- **修复**: 在所有返回assignment.place的SQL查询和格式化函数中添加osm_id字段
- **涉及文件**: `server/src/services/assignmentService.ts`, `server/src/services/dayService.ts`, `server/src/services/queryHelpers.ts`, `server/src/types.ts`

## 2026-06-17 修复网址跳转+地址省市区+分类自动创建 v3.0.22-cn.24

### Bug修复

#### 1. 修复地点网站跳转打开的是项目本身网址
- **问题**: 点击地点弹窗中的"打开网站"按钮，跳转到项目网址后面拼接地点网址（相对路径）
- **根因**: AMap返回的website字段缺少`http://`前缀，浏览器当作相对路径处理
- **修复**: `PlaceInspector.tsx`中`window.open`前添加URL协议前缀检查，缺少`https://`时自动补全
- **涉及文件**: `client/src/components/Planner/PlaceInspector.tsx`

#### 2. 修复详细地址缺少省市区信息
- **问题**: 两种搜索方式选择地点后，详细地址都缺少省市区信息
- **根因**: `searchAmap`中address字段使用`poi.address || poi.pname + poi.cityname + poi.adname + poi.address`，当`poi.address`存在时跳过了省市区前缀
- **修复**: 统一改为`[poi.pname, poi.cityname, poi.adname, poi.address].filter(Boolean).join('')`，始终拼接完整地址
- **涉及文件**: `server/src/services/mapsService.ts`

#### 3. 修复高德一级分类未自动创建
- **问题**: 方案C只在添加地点时触发分类创建，用户期望更新后就能看到分类里自动创建了高德的一级分类
- **修复**:
  - 将`AMAP_CATEGORY_MAP`从`PlaceFormModal.tsx`提取到共享文件`client/src/constants/amapCategories.ts`
  - 在`TripPlannerPage.tsx`中添加`useEffect`，在分类列表加载后自动检查并创建缺失的映射分类
  - 使用`useRef`确保只初始化一次，避免重复创建
- **涉及文件**: `client/src/constants/amapCategories.ts`(新建), `client/src/components/Planner/PlaceFormModal.tsx`, `client/src/pages/TripPlannerPage.tsx`

#### 4. 清理调试日志
- 移除`placeService.ts`中`createPlace`入口的`console.log`调试日志

### 关于左侧计划栏地点图片
- 方案B修复后，新添加的地点会有`image_url`（AMap照片URL）
- 旧数据没有`image_url`，`PlaceAvatar`会通过`photoService`异步获取（通过`amap:`前缀的osm_id调用服务端`getPlacePhoto`）
- 如果AMap照片URL因CORS/防盗链无法直接加载，`PlaceAvatar`的`onError`会自动回退到`photoService`代理获取
- 新添加的地点应该能正常显示图片，旧地点可能需要重新添加

## 2026-06-17 自动补全获取完整信息+自动分类匹配 v3.0.22-cn.23

### 新功能

#### 1. 自动补全选择后获取完整信息（方案B）
- **问题**: 自动补全（输入文字下拉建议）选择地点后只填充基本信息（名称/地址/坐标），缺少 website/phone/image_url 等
- **修复**: 选择 AMap 建议后，先用建议数据快速填充基本信息，再异步调用 `/v3/place/detail` 获取完整信息（website/phone/image_url/category 等），用 `handleSelectMapsResult` 补全缺失字段
- **效果**: 两种搜索方式现在都能获取到完整信息，包括网址、电话、图片
- **涉及文件**: `client/src/components/Planner/PlaceFormModal.tsx`

#### 2. 自动分类匹配（方案C：预置映射表）
- **功能**: 添加地点时，根据高德返回的一级分类自动匹配或创建项目分类
- **映射表**: 20个高德一级分类 → 项目分类映射（餐饮/住宿/景点/购物/交通/生活/休闲/医疗/文化/教育/金融/汽车/商务/政府/公司/设施/宗教/自然）
- **逻辑**:
  1. 先在已有分类中查找名称匹配的 → 自动选中
  2. 没有匹配 → 自动创建新分类（名称/图标/颜色按映射表）→ 自动选中
  3. 仅在用户未手动选择分类时自动填充
- **服务端**: `searchAmap` 和 `getPlaceDetails` 新增返回 `amap_typecode` 字段
- **涉及文件**: `client/src/components/Planner/PlaceFormModal.tsx`, `server/src/services/mapsService.ts`

## 2026-06-17 修复搜索按钮添加地点报Failed to create place（phone字段为数组）v3.0.22-cn.22

### Bug修复

#### 1. 修复搜索按钮添加地点报"Failed to create place"
- **根因**: AMap搜索API返回的`poi.tel`字段可能是空数组`[]`，`[] || null` = `[]`（空数组是truthy），导致：
  - 前端发送`phone: []`到服务端
  - `better-sqlite3`无法正确处理数组参数，导致`RangeError: Too few parameter values were provided`
- **修复**:
  - `searchAmap`函数：`phone`字段添加`Array.isArray`检查，数组转为逗号分隔字符串
  - `createPlace`/`updatePlace`：添加`sanitize()`函数，对所有值做类型安全处理（数组→字符串，空字符串→null）
  - 前端`handleSelectMapsResult`：`phone`字段添加数组检查
- **涉及文件**: `server/src/services/mapsService.ts`, `server/src/services/placeService.ts`, `client/src/components/Planner/PlaceFormModal.tsx`

## 2026-06-17 添加搜索按钮添加地点错误详情显示 v3.0.22-cn.21

### 调试改进
- 前端 `getApiErrorMessage` 现在会显示服务端返回的 `detail` 字段，方便定位根因
- 服务端 `createPlace` 入口添加请求体日志，便于排查

## 2026-06-16 修复搜索按钮添加地点报Failed to create place（数据库列缺失）v3.0.22-cn.20

### Bug修复

#### 1. 修复搜索按钮添加地点报"Failed to create place"
- **问题**: 自动补全选择后添加地点成功，但搜索按钮（放大镜）搜索结果选择后添加报"Failed to create place"
- **根因**: 数据库中可能缺少`google_place_id`、`website`、`phone`列（这些列只在CREATE TABLE中定义，没有对应的ALTER TABLE迁移）。`createPlace`的SQL包含这些列，如果列不存在则SQLite报错。自动补全路径恰好不触发是因为之前的`hasOsmIdColumn()`只检查`osm_id`列，当`osm_id`存在时使用包含所有列的SQL，但其他列可能不存在
- **修复**:
  - 将`hasOsmIdColumn()`替换为`placesHasColumn(col)`，使用`PRAGMA table_info(places)`检测所有列
  - `createPlace`和`updatePlace`动态构建SQL，只包含数据库中实际存在的列
  - 添加迁移确保`google_place_id`、`website`、`phone`列存在
  - `createPlace`添加try-catch和详细错误日志（SQL、参数、可用列）
  - 前端`PlaceFormData`接口添加`osm_id`和`phone`字段
  - `handleSelectMapsResult`添加`image_url`映射（AMap的`photo_url`→`image_url`）
- **涉及文件**: `server/src/services/placeService.ts`, `server/src/db/migrations.ts`, `client/src/components/Planner/PlaceFormModal.tsx`

## 2026-06-16 修复添加地点Internal server error（osm_id列缺失防御）v3.0.22-cn.19

### Bug修复

#### 1. 修复添加地点报"Internal server error"/"Failed to create place"
- **问题**: 自动补全选择后添加报"Failed to create place"，搜索按钮选择后添加报"Internal server error"
- **根因**: `createPlace`和`updatePlace`的SQL包含`osm_id`列，但数据库CREATE TABLE中未定义该列（仅通过迁移添加），如果迁移未成功运行，INSERT/UPDATE会因列不存在而失败
- **修复**:
  - 在CREATE TABLE中添加`osm_id TEXT`列定义（确保新数据库包含它）
  - `createPlace`和`updatePlace`添加防御性检查：运行时检测`osm_id`列是否存在，不存在则使用不含`osm_id`的SQL
  - 服务器端路由添加try-catch和详细错误日志
- **涉及文件**: `server/src/db/schema.ts`, `server/src/services/placeService.ts`, `server/src/routes/places.ts`

#### 2. 恢复天气温度前的"Ø"符号
- **问题**: 上一版本将"Ø"替换为"≈"，用户希望恢复
- **说明**: "Ø"是气象学中表示平均值的符号，用于区分气候数据(climate)和实时预报(forecast)
- **涉及文件**: `client/src/components/Weather/WeatherWidget.tsx`

## 2026-06-16 修复天气Ø符号+搜索添加地点报错+逆地理编码await v3.0.22-cn.18

### Bug修复

#### 1. 修复天气温度前的"Ø"符号
- **问题**: 天气温度前显示"Ø"符号，不直观
- **根因**: "Ø"是气象学中表示平均值的符号，用于区分气候数据(climate)和实时预报(forecast)
- **修复**: 将"Ø"替换为"≈"（约等于），更直观地表示气候平均值
- **涉及文件**: `client/src/components/Weather/WeatherWidget.tsx`

#### 2. 修复搜索按钮添加地点报"Internal server error"
- **问题**: 通过搜索按钮搜索地点后选择添加，报"Internal server error"
- **根因**: 服务器端createPlace缺少try-catch，SQL错误直接返回500，无法定位具体原因
- **修复**: 添加try-catch和详细错误日志，返回具体错误信息而非笼统的500
- **涉及文件**: `server/src/routes/places.ts`

#### 3. 修复AMap逆地理编码缺少await
- **问题**: handleSavePlace中AMap逆地理编码调用缺少await，导致reverseData是Promise对象
- **根因**: IIFE返回Promise但未await
- **修复**: 改为async IIFE + await
- **涉及文件**: `client/src/pages/TripPlannerPage.tsx`

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
