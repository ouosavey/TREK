# CHANGELOG

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
