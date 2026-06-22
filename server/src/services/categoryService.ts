import { db } from '../db/database';
import { findAmapCategoryMapping } from '../constants/amapCategories';

export function listCategories() {
  return db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
}

export function createCategory(userId: number, name: string, color?: string, icon?: string) {
  const result = db.prepare(
    'INSERT INTO categories (name, color, icon, user_id) VALUES (?, ?, ?, ?)'
  ).run(name, color || '#6366f1', icon || '\uD83D\uDCCD', userId);
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
}

export function getCategoryById(categoryId: number | string) {
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
}

export function updateCategory(categoryId: number | string, name?: string, color?: string, icon?: string) {
  db.prepare(`
    UPDATE categories SET
      name = COALESCE(?, name),
      color = COALESCE(?, color),
      icon = COALESCE(?, icon)
    WHERE id = ?
  `).run(name || null, color || null, icon || null, categoryId);
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
}

export function deleteCategory(categoryId: number | string) {
  db.prepare('DELETE FROM categories WHERE id = ?').run(categoryId);
}

/**
 * 根据高德分类信息自动查找或创建分类，返回 category_id
 * 服务端兜底逻辑：即使前端分类匹配失败，服务端也能正确分配分类
 */
export function findOrCreateCategory(userId: number, amapCategory: string | null | undefined, amapTypecode: string | null | undefined): number | null {
  const mapping = findAmapCategoryMapping(amapCategory, amapTypecode);
  if (!mapping) return null;

  // 1. 查找已有分类（按名称精确匹配）
  const existing = db.prepare('SELECT * FROM categories WHERE name = ?').get(mapping.name) as { id: number } | undefined;
  if (existing) {
    console.log('[categoryService] Found existing category:', mapping.name, 'id:', existing.id);
    return existing.id;
  }

  // 2. 创建新分类
  try {
    const result = db.prepare(
      'INSERT INTO categories (name, color, icon, user_id) VALUES (?, ?, ?, ?)'
    ).run(mapping.name, mapping.color, '📍', userId);
    const newId = Number(result.lastInsertRowid);
    console.log('[categoryService] Created new category:', mapping.name, 'id:', newId);
    return newId;
  } catch (err) {
    console.error('[categoryService] Failed to create category:', mapping.name, err);
    return null;
  }
}
