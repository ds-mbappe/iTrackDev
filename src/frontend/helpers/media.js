// src/frontend/helpers/media.js
// Shared helpers for attachment/media normalization and upload payload conversion.

/**
 * Converts a UI Kit FilePicker serialized file into a Blob for multipart uploads.
 * FilePicker returns base64 data (sometimes already in data URL form).
 */
export async function serializedFileToBlob(file) {
  const mimeType = file?.type || 'application/octet-stream';
  const rawData = String(file?.data || '').trim();
  if (!rawData) throw new Error('Selected file data is empty.');

  // Avoid `fetch(data:...)` because Forge CSP can block connect-src lookups.
  // Decode payload in-memory instead.
  if (rawData.startsWith('data:')) {
    const commaIndex = rawData.indexOf(',');
    if (commaIndex === -1) throw new Error('Invalid data URL for selected file.');

    const metadata = rawData.slice(5, commaIndex);
    const payload = rawData.slice(commaIndex + 1);
    const isBase64 = metadata.includes(';base64');
    const parsedMimeType = metadata.split(';')[0] || mimeType;

    if (isBase64) {
      const bytes = base64ToUint8Array(payload);
      return new Blob([bytes], { type: parsedMimeType });
    }

    // Non-base64 data URL payloads are percent-encoded text.
    return new Blob([decodeURIComponent(payload)], { type: parsedMimeType });
  }

  // UI Kit FilePicker commonly provides a raw base64 string.
  const bytes = base64ToUint8Array(rawData);
  return new Blob([bytes], { type: mimeType });
}

function base64ToUint8Array(base64Value) {
  const normalized = String(base64Value).replace(/\s+/g, '');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

/**
 * Normalizes attachment payloads from Jira API responses and stored documents
 * into one stable frontend shape.
 */
export function normalizeMediaAttachment(value) {
  if (!value || typeof value !== 'object') return null;

  const fileName = value.fileName || value.filename || 'Attachment';
  const mimeType = value.mimeType || value.type || '';
  const size = Number(value.size || 0);
  const contentUrl = value.contentUrl || value.content || '';
  const thumbnailUrl = value.thumbnailUrl || value.thumbnail || '';
  const label = typeof value.label === 'string' ? value.label : '';
  const id = value.id != null ? String(value.id) : fallbackAttachmentId({
    fileName,
    size,
    contentUrl,
    thumbnailUrl,
  });

  return {
    id,
    fileName,
    mimeType,
    size,
    contentUrl,
    thumbnailUrl,
    label,
  };
}

function fallbackAttachmentId(value) {
  const seed = `${value.fileName}|${value.size}|${value.contentUrl}|${value.thumbnailUrl}`;
  let hash = 0;

  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  return `local_${Math.abs(hash)}`;
}

export function normalizeMediaAttachments(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map(normalizeMediaAttachment)
    .filter(Boolean);
}

/**
 * Tries to resolve a Jira attachment id from normalized attachment payloads.
 * We keep this resilient because older stored docs may only include URLs.
 */
export function resolveAttachmentId(attachment) {
  const directId = String(attachment?.id || '').trim();
  if (/^\d+$/.test(directId)) return directId;

  const candidateUrls = [
    attachment?.contentUrl,
    attachment?.thumbnailUrl,
  ].filter(Boolean);

  for (const url of candidateUrls) {
    const value = String(url);
    const match = value.match(/\/attachment\/(?:content|thumbnail)\/(\d+)/i)
      || value.match(/\/secure\/attachment\/(\d+)/i)
      || value.match(/\/secure\/thumbnail\/(\d+)/i);
    if (match?.[1]) return match[1];
  }

  return null;
}

export function isImageMedia(attachment) {
  const mime = attachment?.mimeType || '';
  return mime.startsWith('image/');
}

export function isVideoMedia(attachment) {
  const mime = attachment?.mimeType || '';
  return mime.startsWith('video/');
}
