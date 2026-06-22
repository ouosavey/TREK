// 服务端高德分类映射逻辑（与前端 client/src/constants/amapCategories.ts 保持同步）
// 用于在创建/更新地点时自动分配分类

// 高德一级分类 → 项目分类映射表
const AMAP_CATEGORY_MAP: Record<string, { name: string; color: string }> = {
  '餐饮服务': { name: '餐饮', color: '#f97316' },
  '住宿服务': { name: '住宿', color: '#8b5cf6' },
  '风景名胜': { name: '景点', color: '#eab308' },
  '购物服务': { name: '购物', color: '#ec4899' },
  '交通设施服务': { name: '交通', color: '#3b82f6' },
  '生活服务': { name: '生活', color: '#14b8a6' },
  '体育休闲服务': { name: '休闲', color: '#22c55e' },
  '医疗保健服务': { name: '医疗', color: '#ef4444' },
  '文化体育服务': { name: '文化', color: '#a855f7' },
  '科教文化服务': { name: '教育', color: '#6366f1' },
  '金融保险服务': { name: '金融', color: '#0ea5e9' },
  '汽车服务': { name: '汽车', color: '#64748b' },
  '汽车维修': { name: '汽车', color: '#64748b' },
  '汽车销售': { name: '汽车', color: '#64748b' },
  '商务住宅': { name: '商务', color: '#475569' },
  '政府机构及社会团体': { name: '政府', color: '#78716c' },
  '公司企业': { name: '公司', color: '#475569' },
  '公共设施': { name: '设施', color: '#94a3b8' },
  '宗教': { name: '宗教', color: '#a16207' },
  '自然地物': { name: '自然', color: '#16a34a' },
  '事件活动': { name: '活动', color: '#f59e0b' },
  '地名地址': { name: '地址', color: '#94a3b8' },
  '室内设施': { name: '设施', color: '#94a3b8' },
  '通行设施': { name: '交通', color: '#3b82f6' },
}

// 高德二级分类（typecode前4位）→ 项目分类映射表
const AMAP_TYPECODE_MAP: Record<string, { name: string; color: string }> = {
  '1501': { name: '飞机', color: '#3b82f6' },
  '1502': { name: '火车', color: '#8b5cf6' },
  '1503': { name: '汽车', color: '#64748b' },
  '1504': { name: '汽车', color: '#64748b' },
  '1505': { name: '船舶', color: '#0ea5e9' },
  '1506': { name: '交通', color: '#3b82f6' },
  '1507': { name: '交通', color: '#3b82f6' },
  '0301': { name: '轨道交通', color: '#22c55e' },
  '0109': { name: '汽车', color: '#64748b' },
}

// typecode 前2位 → 高德一级分类名
const AMAP_TYPECODE_PREFIX2_MAP: Record<string, string> = {
  '01': '汽车服务',
  '02': '汽车销售',
  '03': '汽车维修',
  '05': '餐饮服务',
  '06': '购物服务',
  '07': '生活服务',
  '08': '体育休闲服务',
  '09': '医疗保健服务',
  '10': '住宿服务',
  '11': '风景名胜',
  '12': '商务住宅',
  '13': '政府机构及社会团体',
  '14': '科教文化服务',
  '15': '交通设施服务',
  '16': '金融保险服务',
  '17': '公司企业',
  '18': '公共设施',
  '19': '事件活动',
  '20': '室内设施',
  '21': '通行设施',
  '22': '地名地址',
  '23': '自然地物',
}

/**
 * 根据高德 category 和 typecode 查找最佳分类映射
 * 优先级：typecode前4位(二级) > 一级分类名 > typecode前2位(一级大类) > 高德原始分类名
 */
export function findAmapCategoryMapping(
  category: string | null | undefined,
  typecode: string | null | undefined,
): { name: string; color: string } | null {
  // 1. typecode 前4位匹配（二级分类）
  if (typecode && typecode.length >= 4) {
    const prefix4 = typecode.slice(0, 4)
    if (AMAP_TYPECODE_MAP[prefix4]) {
      return AMAP_TYPECODE_MAP[prefix4]
    }
  }

  // 2. 一级分类名匹配
  const primaryCategory = category ? category.split(';')[0] : null
  if (primaryCategory && AMAP_CATEGORY_MAP[primaryCategory]) {
    return AMAP_CATEGORY_MAP[primaryCategory]
  }

  // 3. typecode 前2位推断一级分类
  if (typecode && typecode.length >= 2) {
    const prefix2 = typecode.slice(0, 2)
    const primaryName = AMAP_TYPECODE_PREFIX2_MAP[prefix2]
    if (primaryName && AMAP_CATEGORY_MAP[primaryName]) {
      return AMAP_CATEGORY_MAP[primaryName]
    }
  }

  // 4. 使用高德原始分类名作为新分类名
  if (primaryCategory) {
    return { name: primaryCategory, color: '#6366f1' }
  }

  return null
}
