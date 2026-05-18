import { desc, eq } from 'drizzle-orm';
import { db } from '../index';
import { knowledgeEdges, knowledgeNodes } from '../schema';

export const knowledgeRepository = {
  async listNodes(userId: string) {
    return db
      .select()
      .from(knowledgeNodes)
      .where(eq(knowledgeNodes.userId, userId))
      .orderBy(desc(knowledgeNodes.updatedAt));
  },

  async createNode(data: {
    userId: string;
    resumeId?: string | null;
    type: string;
    label: string;
    content?: string;
    metadata?: unknown;
  }) {
    const id = crypto.randomUUID();
    await db.insert(knowledgeNodes).values({
      id,
      userId: data.userId,
      resumeId: data.resumeId || null,
      type: data.type,
      label: data.label,
      content: data.content || '',
      metadata: data.metadata || {},
    });
    const rows = await db.select().from(knowledgeNodes).where(eq(knowledgeNodes.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async listEdges(userId: string) {
    return db
      .select()
      .from(knowledgeEdges)
      .where(eq(knowledgeEdges.userId, userId))
      .orderBy(desc(knowledgeEdges.createdAt));
  },

  async createEdge(data: {
    userId: string;
    fromNodeId: string;
    toNodeId: string;
    relation?: string;
    metadata?: unknown;
  }) {
    const id = crypto.randomUUID();
    await db.insert(knowledgeEdges).values({
      id,
      userId: data.userId,
      fromNodeId: data.fromNodeId,
      toNodeId: data.toNodeId,
      relation: data.relation || 'related',
      metadata: data.metadata || {},
    });
    const rows = await db.select().from(knowledgeEdges).where(eq(knowledgeEdges.id, id)).limit(1);
    return rows[0] ?? null;
  },
};
