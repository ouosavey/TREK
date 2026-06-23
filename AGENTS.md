## 强制规则：每次修复后必须更新记录文件

### 1. 关键决策记录 (CHANGELOG.md)
**位置**: `放到项目的根目录`

每次完成以下操作时，必须更新此文件：
- 修复任何 bug（记录根因、修复方案、涉及文件）
- 修改数据模型或 API 接口
- 添加新功能
- 部署服务器镜像
- 构建 APK 新版本
- 每次记录的内容标题包含记录的具体时间，这样方便区分

### 2. 版本号记录 (VERSION.md)
**位置**: `放到项目的根目录`

记录每个版本的：
- 版本号
- 发布日期
- 包含的变更
- 对应的 Docker 镜像 tag
- APK 文件路径

### 3. 压缩前检查清单
当检测到即将发生上下文压缩时，必须先执行：
```
1. 读取 CHANGELOG.md 获取所有历史决策
2. 读取 VERSION.md 获取当前版本状态
3. 将当前未完成的任务写入 CHANGELOG.md 的 "待处理" 部分
4. 确保所有关键代码片段已记录在 CHANGELOG.md 中
```

### 4. github推送
每次完成修改后，进行github推送：
```
1. 修改请推送到cn-localized分支
2. github上的workflow里现在的自动构建请把本次修复的内容写上去
3. 只构建GHCR (ghcr.io)的amd64镜像
4.每次都要将根目录下的VERSION.md、CHANGELOG.md、AGENTS.md文件一起推送
```

### 5. AMap API 参考信息

#### 地图 JS API 2.0
- 开发指南: https://lbs.amap.com/api/javascript-api-v2
- 教程: https://lbs.amap.com/api/jsapi-v2/guide/abc/prepare
- 参考手册: https://lbs.amap.com/api/jsapi-v2/documentation
- 示例中心: https://lbs.amap.com/demo-center/jsapi-v2
- DTS 类型声明: https://www.npmjs.com/package/@amap/amap-jsapi-types
- 坐标转换: JS API 提供 `AMap.convertFrom()` 方法，支持 GPS(WGS84)→高德(GCJ02)、百度→高德
- 右键菜单: `AMap.ContextMenu`
- 搜索服务: `AMap.Autocomplete`(输入提示)、`AMap.PlaceSearch`(POI搜索)
- 路线规划: `AMap.Driving`/`AMap.Walking`/`AMap.Riding`/`AMap.Transfer`(公交)
- 地理编码: `AMap.Geocoder`

#### Web 服务 API
- 开发指南: https://lbs.amap.com/api/webservice
- 搜索POI: https://lbs.amap.com/api/webservice/guide/api-advanced/search
  - 关键字搜索: `GET /v3/place/text?keywords=xxx&key=xxx`
  - 周边搜索: `GET /v3/place/around?location=lng,lat&keywords=xxx&key=xxx`
  - ID查询: `GET /v3/place/detail?id=xxx&key=xxx` (extensions=all 返回 photos)
- 输入提示: `GET /v3/assistant/inputtips?keywords=xxx&key=xxx`
- 地理/逆地理编码: https://lbs.amap.com/api/webservice/guide/api/georegeo
  - 逆地理编码: `GET /v3/geocode/regeo?location=lng,lat&key=xxx&extensions=all`
  - **重要**: `extensions=all` 返回附近 POI 列表（含 id、name、photos），`extensions=base` 只返回基础地址
- 路径规划: `GET /v3/direction/driving` / `/transit/integrated` / `/walking` / `/riding`
- 坐标转换: `GET /v3/assistant/coordinate/convert?locations=lng,lat&coordsys=gps`
- 坐标系: AMap 使用 GCJ-02（火星坐标系），前端地图返回 WGS-84 需要转换
- Key 类型: 需要【Web服务API】密钥（不是JS API的Key）
- 调用量限制: 个人认证 3000次/日，企业认证 30000次/日