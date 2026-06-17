// 高德一级分类 → 项目分类映射表（方案C：预置映射）
// 高德共23个一级分类，这里映射旅行相关的分类
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
}
