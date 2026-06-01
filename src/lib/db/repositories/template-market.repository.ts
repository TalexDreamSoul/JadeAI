import { and, desc, eq, or } from 'drizzle-orm';
import { db } from '../index';
import { templateMarketItems } from '../schema';

export const templateMarketRepository = {
  async listVisible(userId?: string | null) {
    const predicate = userId
      ? or(eq(templateMarketItems.isPublic, true), eq(templateMarketItems.ownerUserId, userId))
      : eq(templateMarketItems.isPublic, true);

    return db
      .select()
      .from(templateMarketItems)
      .where(predicate)
      .orderBy(desc(templateMarketItems.updatedAt));
  },

  async findById(id: string) {
    const rows = await db.select().from(templateMarketItems).where(eq(templateMarketItems.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async findByOwnerAndName(ownerUserId: string, name: string) {
    const rows = await db
      .select()
      .from(templateMarketItems)
      .where(and(eq(templateMarketItems.ownerUserId, ownerUserId), eq(templateMarketItems.name, name)))
      .limit(1);
    return rows[0] ?? null;
  },

  async upsertSystemTemplate(data: {
    ownerUserId: string;
    name: string;
    description?: string;
    baseTemplate?: string;
    themeConfig?: unknown;
    customCss?: string;
    isPublic?: boolean;
  }) {
    const existing = await this.findByOwnerAndName(data.ownerUserId, data.name);
    if (existing) {
      await db
        .update(templateMarketItems)
        .set({
          description: data.description || existing.description,
          baseTemplate: data.baseTemplate || existing.baseTemplate,
          themeConfig: data.themeConfig || existing.themeConfig || {},
          customCss: data.customCss ?? existing.customCss,
          isPublic: data.isPublic ?? existing.isPublic,
          updatedAt: new Date(),
        })
        .where(eq(templateMarketItems.id, existing.id));
      return this.findById(existing.id);
    }

    return this.create(data);
  },

  async create(data: {
    ownerUserId: string;
    name: string;
    description?: string;
    baseTemplate?: string;
    themeConfig?: unknown;
    customCss?: string;
    isPublic?: boolean;
  }) {
    const id = crypto.randomUUID();
    await db.insert(templateMarketItems).values({
      id,
      ownerUserId: data.ownerUserId,
      name: data.name,
      description: data.description || '',
      baseTemplate: data.baseTemplate || 'touch-pure',
      themeConfig: data.themeConfig || {},
      customCss: data.customCss || '',
      isPublic: data.isPublic ?? false,
    });
    return this.findById(id);
  },

  async update(id: string, data: Partial<{
    name: string;
    description: string;
    baseTemplate: string;
    themeConfig: unknown;
    customCss: string;
    isPublic: boolean;
  }>) {
    await db
      .update(templateMarketItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(templateMarketItems.id, id));
    return this.findById(id);
  },

  async incrementInstallCount(id: string) {
    const item = await this.findById(id);
    if (!item) return null;
    await db
      .update(templateMarketItems)
      .set({ installCount: (Number(item.installCount) || 0) + 1, updatedAt: new Date() })
      .where(eq(templateMarketItems.id, id));
    return this.findById(id);
  },
};
