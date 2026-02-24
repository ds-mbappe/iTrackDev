// src/frontend/helpers/accordion.js
// Shared small helpers for accordion state, ordering and UI input payloads.

export function sortByOrder(items) {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function nextOrder(items) {
  const max = items.reduce((m, it) => Math.max(m, Number(it.order || 0)), 0);
  return max + 10;
}

/**
 * Reorders items using the same source/destination index semantics as
 * Atlassian rank events, then rewrites `order` with stable 10-step spacing.
 * This keeps backend sorting deterministic and leaves space for future inserts.
 */
export function reorderByIndex(items, sourceIndex, destinationIndex) {
  const ordered = sortByOrder(items);
  const count = ordered.length;

  if (!count) return ordered;

  const from = Number(sourceIndex);
  const to = Number(destinationIndex);

  if (
    Number.isNaN(from) ||
    Number.isNaN(to) ||
    from < 0 ||
    to < 0 ||
    from >= count ||
    to > count
  ) {
    return ordered;
  }

  if (from === to) return ordered;

  const next = [...ordered];
  const [moved] = next.splice(from, 1);
  const safeTargetIndex = Math.max(0, Math.min(to, next.length));
  next.splice(safeTargetIndex, 0, moved);

  return next.map((item, index) => ({
    ...item,
    order: (index + 1) * 10,
  }));
}

export function uuidLike() {
  // Good enough for UI-only ids in this panel context.
  return `acc_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

/**
 * Forge UI Kit text inputs often provide serializable InputEvent payloads.
 * Some components/examples emit a raw string. We normalize both shapes.
 */
export function inputValueFromChangePayload(payload) {
  if (typeof payload === 'string') return payload;
  if (payload == null) return '';
  if (typeof payload === 'object' && payload.target && payload.target.value != null) {
    return String(payload.target.value);
  }
  return String(payload);
}
