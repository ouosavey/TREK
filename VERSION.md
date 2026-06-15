# VERSION

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
