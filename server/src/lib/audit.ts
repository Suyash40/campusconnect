import { AuditLog } from '../models/index.js';

/** Records important actions. Never pass passwords, tokens or full personal records in `meta`. */
export async function audit(actorId: string | null, action: string, target = '', meta: Record<string, unknown> = {}) {
  await AuditLog.create({ actor: actorId, action, target, meta });
}
