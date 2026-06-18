import { asc, eq } from 'drizzle-orm';
import { db } from '../index';
import { aiChannels } from '../schema';

export interface AIChannelRecord {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  openAIEndpoint: string;
  weight: number;
  enabled: boolean;
  lastUsedAt?: Date | string | number | null;
  failureCount: number;
  createdAt?: Date | string | number;
  updatedAt?: Date | string | number;
}

export const aiChannelRepository = {
  async list(): Promise<AIChannelRecord[]> {
    return db.select().from(aiChannels).orderBy(asc(aiChannels.createdAt)) as Promise<AIChannelRecord[]>;
  },

  async listEnabled() {
    const rows = await this.list();
    return rows.filter((row) => row.enabled);
  },

  async findById(id: string) {
    const rows = await db.select().from(aiChannels).where(eq(aiChannels.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async create(data: {
    name: string;
    provider: string;
    apiKey: string;
    baseUrl: string;
    model: string;
    openAIEndpoint?: string;
    weight?: number;
    enabled?: boolean;
  }) {
    const id = crypto.randomUUID();
    await db.insert(aiChannels).values({
      id,
      name: data.name,
      provider: data.provider,
      apiKey: data.apiKey,
      baseUrl: data.baseUrl,
      model: data.model,
      openAIEndpoint: data.openAIEndpoint || 'chat',
      weight: data.weight ?? 1,
      enabled: data.enabled ?? true,
    });
    return this.findById(id);
  },

  async update(id: string, data: Partial<{
    name: string;
    provider: string;
    apiKey: string;
    baseUrl: string;
    model: string;
    openAIEndpoint: string;
    weight: number;
    enabled: boolean;
    failureCount: number;
    lastUsedAt: Date | null;
  }>) {
    await db.update(aiChannels).set({ ...data, updatedAt: new Date() }).where(eq(aiChannels.id, id));
    return this.findById(id);
  },

  async delete(id: string) {
    await db.delete(aiChannels).where(eq(aiChannels.id, id));
  },

  async selectForRequest() {
    const channels = await this.listEnabled();
    if (channels.length === 0) return null;

    const expanded = channels.flatMap((channel) => {
      const weight = Math.max(1, Math.min(20, Number(channel.weight) || 1));
      return Array.from({ length: weight }, () => channel);
    });

    expanded.sort((a, b) => {
      const aTime = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
      const bTime = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
      if (aTime !== bTime) return aTime - bTime;
      return (Number(a.failureCount) || 0) - (Number(b.failureCount) || 0);
    });

    const selected = expanded[0];
    await this.update(selected.id, { lastUsedAt: new Date() });
    return selected;
  },
};
