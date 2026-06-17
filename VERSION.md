# VERSION

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
