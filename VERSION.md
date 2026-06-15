# VERSION

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
