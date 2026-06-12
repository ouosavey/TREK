# Changelog

## 2026-06-12 — AMap 地图灰掉/NaN 错误修复

### Bug1: 旅行计划页面点击天气地图灰掉
- **根因**: AMap SDK 的 `setBounds()` 和 `resize()` 在特定条件下会破坏地图内部坐标系统，产生 NaN center/zoom，导致地图瓦片无法加载（灰掉），鼠标交互触发大量 NaN 报错
- **触发条件**: 点击天数卡片天气 → `onSelectDay` + `onDayDetail` → `fitKey` 递增 → fitKey effect 调用 `map.setBounds()` → AMap 内部坐标计算产生 NaN
- **修复方案**:
  1. `setBounds` 后验证 center/zoom 有效性，NaN 时回滚到之前的状态
  2. 所有 `map.resize()` 调用后添加 NaN 验证和自动恢复
  3. mousemove/健康监控中不再调用 `resize()` 恢复 NaN，改为直接 `setCenter`/`setZoom`（resize 本身可能触发更多 NaN）
  4. 地图容器添加 `isolation:isolate` + `transform:translateZ(0)` 强制独立合成层，防止 DayDetailPanel 的 `backdrop-filter` 干扰 canvas 渲染
- **涉及文件**: `client/src/components/Map/MapViewAMap.tsx`

### Bug2: 旅程页面地图不显示（大量 NaN 报错）
- **根因**: JourneyMapAMap 的地图初始化 useEffect 依赖 `[entries, stableTrail, amapKey, ...]`，每次 entries 变化都销毁重建整个地图，重建过程中触发大量 NaN 错误
- **修复方案**: 参考 MapViewAMap 模式重构 — 地图只初始化一次（依赖 `[amapKey, amapSecurityCode]`），标记/折线/边界在单独 effect 中根据 `[items, stableTrail, paddingBottom]` 更新
- **涉及文件**: `client/src/components/Journey/JourneyMapAMap.tsx`

### 其他修复
- 移除高德天气 API，统一使用 Open-Meteo（不同日期格式不一致导致面板大小差异）
- DayDetailPanel 使用 `position:fixed` 不改变地图容器尺寸，删除 overlay resize effect
- JourneyMapAMap 的 `invalidateSize` 从 toggle display 改为 `map.resize()`
- JourneyMapAMap 添加 ResizeObserver 监听容器尺寸变化

### 待处理
- AMap SDK 内部仍有少量 NaN 错误无法完全消除（SDK 内部代码路径绕过 monkey-patch）
- 如果 NaN 防护仍不够，可能需要考虑在 AMap 初始化时使用不同配置
