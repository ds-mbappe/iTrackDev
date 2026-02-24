// src/frontend/helpers/adf.js
// Centralized ADF helpers used across editor/read-only rendering paths.

/**
 * Minimal ADF converter: plain text => paragraphs.
 * We keep this helper because some fallback flows still need an empty/initial doc.
 */
export function plainTextToAdf(text) {
  const safe = (text ?? '').toString();
  const lines = safe.split(/\r?\n/);

  const content = lines.map((line) => ({
    type: 'paragraph',
    content: line.length ? [{ type: 'text', text: line }] : [],
  }));

  return { type: 'doc', version: 1, content };
}

/**
 * Forge editor callbacks should return JSONDocNode, but wrapped payloads can
 * appear in some integration paths. We normalize both shapes to a valid ADF doc.
 */
export function normalizeAdfFromEditorPayload(payload) {
  if (payload && payload.type === 'doc' && Array.isArray(payload.content)) {
    return payload;
  }

  const wrapped = payload?.target?.value;
  if (wrapped && wrapped.type === 'doc' && Array.isArray(wrapped.content)) {
    return wrapped;
  }

  return plainTextToAdf('');
}

/**
 * Determine whether an ADF tree contains meaningful renderable content.
 * This prevents "blank area" rendering when the document is effectively empty.
 */
export function hasRenderableAdfContent(node) {
  if (!node) return false;
  if (Array.isArray(node)) return node.some(hasRenderableAdfContent);
  if (typeof node !== 'object') return false;

  const type = node.type;
  if (type === 'text') return Boolean((node.text ?? '').toString().trim());

  if (
    type === 'emoji' ||
    type === 'mention' ||
    type === 'status' ||
    type === 'date' ||
    type === 'media' ||
    type === 'mediaSingle' ||
    type === 'inlineCard' ||
    type === 'blockCard' ||
    type === 'embedCard' ||
    type === 'rule'
  ) {
    return true;
  }

  return hasRenderableAdfContent(node.content);
}
