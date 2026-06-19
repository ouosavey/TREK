// 高德一级分类 → 项目分类映射表（方案C：预置映射）
// 高德共23个一级分类，这里映射全部分类
export const AMAP_CATEGORY_MAP: Record<string, { name: string; icon: string; color: string }> = {
  '餐饮服务': { name: '餐饮', icon: 'UtensilsCrossed', color: '#f97316' },
  '住宿服务': { name: '住宿', icon: 'BedDouble', color: '#8b5cf6' },
  '风景名胜': { name: '景点', icon: 'Landmark', color: '#eab308' },
  '购物服务': { name: '购物', icon: 'ShoppingBag', color: '#ec4899' },
  '交通设施服务': { name: '交通', icon: 'Bus', color: '#3b82f6' },
  '生活服务': { name: '生活', icon: 'Home', color: '#14b8a6' },
  '体育休闲服务': { name: '休闲', icon: 'Activity', color: '#22c55e' },
  '医疗保健服务': { name: '医疗', icon: 'Cross', color: '#ef4444' },
  '文化体育服务': { name: '文化', icon: 'Theater', color: '#a855f7' },
  '科教文化服务': { name: '教育', icon: 'Library', color: '#6366f1' },
  '金融保险服务': { name: '金融', icon: 'CreditCard', color: '#0ea5e9' },
  '汽车服务': { name: '汽车', icon: 'Car', color: '#64748b' },
  '汽车维修': { name: '汽车', icon: 'Car', color: '#64748b' },
  '汽车销售': { name: '汽车', icon: 'Car', color: '#64748b' },
  '商务住宅': { name: '商务', icon: 'Building2', color: '#475569' },
  '政府机构及社会团体': { name: '政府', icon: 'Flag', color: '#78716c' },
  '公司企业': { name: '公司', icon: 'Building2', color: '#475569' },
  '公共设施': { name: '设施', icon: 'MapPin', color: '#94a3b8' },
  '宗教': { name: '宗教', icon: 'Church', color: '#a16207' },
  '自然地物': { name: '自然', icon: 'TreePine', color: '#16a34a' },
  // 补充高德剩余一级分类
  '事件活动': { name: '活动', icon: 'Calendar', color: '#f59e0b' },
  '地名地址': { name: '地址', icon: 'MapPin', color: '#94a3b8' },
  '室内设施': { name: '设施', icon: 'MapPin', color: '#94a3b8' },
  '通行设施': { name: '交通', icon: 'Bus', color: '#3b82f6' },
}

// 高德二级分类（typecode前4位）→ 项目分类映射表
// 优先级高于一级分类映射，用于更精确的分类匹配
// typecode 6位结构：前2位=一级大类，中间2位=二级中类，后2位=三级细类
export const AMAP_TYPECODE_MAP: Record<string, { name: string; icon: string; color: string }> = {
  // 交通设施服务(15)的二级分类
  '1501': { name: '飞机', icon: 'Plane', color: '#3b82f6' },       // 机场相关（飞机场、候机室等）
  '1502': { name: '火车', icon: 'Train', color: '#8b5cf6' },       // 火车站（高铁站、火车站等）
  '1503': { name: '汽车', icon: 'Car', color: '#64748b' },         // 长途汽车站
  '1504': { name: '汽车', icon: 'Car', color: '#64748b' },         // 汽车租赁
  '1505': { name: '船舶', icon: 'Ship', color: '#0ea5e9' },        // 港口码头
  '1506': { name: '交通', icon: 'Bus', color: '#3b82f6' },         // 停车场
  '1507': { name: '交通', icon: 'Bus', color: '#3b82f6' },         // 路侧服务区
  // 地铁站属于"交通设施服务"但typecode前2位是03（不是15）
  '0301': { name: '轨道交通', icon: 'Train', color: '#22c55e' },    // 地铁站
  // 汽车服务(01)中的汽车租赁
  '0109': { name: '汽车', icon: 'Car', color: '#64748b' },         // 汽车租赁
}

// 根据 category 和 typecode 查找最佳分类映射
// 优先使用 typecode 前缀匹配（更精确），回退到一级分类匹配
// 如果都不匹配，使用高德原始分类名创建新分类（确保每个地点都有分类）
export function findAmapCategoryMapping(
  category: string | null | undefined,
  typecode: string | null | undefined,
): { name: string; icon: string; color: string } | null {
  // 1. 优先用 typecode 前缀匹配（前4位=二级分类）
  if (typecode && typecode.length >= 4) {
    const prefix4 = typecode.slice(0, 4)
    if (AMAP_TYPECODE_MAP[prefix4]) {
      return AMAP_TYPECODE_MAP[prefix4]
    }
  }

  // 2. 回退到一级分类匹配
  const primaryCategory = category ? category.split(';')[0] : null
  if (primaryCategory && AMAP_CATEGORY_MAP[primaryCategory]) {
    return AMAP_CATEGORY_MAP[primaryCategory]
  }

  // 3. 都不匹配时，使用高德原始分类名作为新分类名（确保每个地点都有分类）
  if (primaryCategory) {
    return { name: primaryCategory, icon: 'MapPin', color: '#6366f1' }
  }

  return null
}
