# CHANGELOG

## 2026-06-15 修复手机端白屏 + 桌面端内容截断

### Bug修复

#### 1. 手机端点击"公交/地铁"按钮白屏 (根因修复)
- **根因**: `TripPlannerPage.tsx` 移动端 `onRouteCalculated` 回调中 `setRoute(r.coordinates)` 传了 `[number, number][]`，但 `setRoute` 期望 `[number, number][][]`。当地图组件渲染路线时，`seg.map(([lat, lng]) => ...)` 对单个数字做解构，抛出 `TypeError: number 30.61357263686864 is not iterable`
- **修复**: 
  - `TripPlannerPage.tsx` 移动端: `setRoute(r.coordinates)` → `setRoute([clean])` (包裹为二维数组)
  - `TripPlannerPage.tsx` 桌面端: `setRoute([r.coordinates])` → `setRoute([clean])` (增加坐标清洗)
  - 两端 `onRouteCalculated` 回调均增加坐标验证过滤 + try-catch 防御
- **涉及文件**: `client/src/pages/TripPlannerPage.tsx`

#### 2. 坐标数据清洗防御 (多层防护)
- **问题**: `DayPlanSidebar.tsx` 中 `allCoords.push(...seg.coordinates)` 如果 `seg.coordinates` 包含非 `[number, number]` 格式的元素（如扁平化数字），会导致异常数据传入地图组件
- **修复**: 在3处 `allCoords` 收集点增加逐元素验证：
  - `handleCalculateTransit`: 验证 `seg.coordinates` 中每个元素是 `[number, number]`
  - `handleTransitSelectOption`: 同上
  - `handleTransitStrategyChange`: 同上
- **涉及文件**: `client/src/components/Planner/DayPlanSidebar.tsx`

#### 3. 地图渲染防御性检查
- **修复**: `MapViewAMap.tsx` 和 `MapViewGL.tsx` 的路线渲染代码增加坐标清洗，过滤掉非 `[number, number]` 格式的坐标，防止解构崩溃
- **涉及文件**: `client/src/components/Map/MapViewAMap.tsx`, `client/src/components/Map/MapViewGL.tsx`

#### 4. 桌面端公交面板内容截断
- **问题**: 面板使用 `overflowY: auto` + `maxHeight: 80vh`，但内容超出时滚动不生效
- **修复**: 重构面板布局为 flex 三段式：
  - 外层容器: `display: flex; flexDirection: column; overflow: hidden`
  - 标题栏 + 策略选择器: `flexShrink: 0` (固定不滚动)
  - 内容区: `flex: 1; overflowY: auto; minHeight: 0` (独立滚动)
- **涉及文件**: `client/src/components/Planner/TransitRoutePanel.tsx`

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

