# Version

## cn-localized-latest
- **版本号**: cn-localized-latest
- **发布日期**: 2026-06-12
- **Docker 镜像**: `ghcr.io/ouosavey/trek:cn-localized` (linux/amd64)
- **包含变更**:
  - 修复旅行计划页面点击天气地图灰掉/NaN 问题
  - 修复旅程页面地图不显示问题
  - 移除高德天气 API，统一使用 Open-Meteo
  - AMap 地图组件 NaN 防护体系（LngLat/Pixel monkey-patch + 坐标安全包装 + 健康监控 + setBounds/resize 后验证）
