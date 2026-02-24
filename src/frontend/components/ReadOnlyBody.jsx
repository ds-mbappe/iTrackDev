import React, { useEffect, useState } from 'react';
import {
  AdfRenderer,
  Button,
  Box,
  Image,
  Inline,
  Stack,
  Text,
  Tooltip,
} from '@forge/react';
import { requestJira } from '@forge/bridge';
import { hasRenderableAdfContent, plainTextToAdf } from '../helpers/adf';
import {
  isImageMedia,
  isVideoMedia,
  normalizeMediaAttachments,
  resolveAttachmentId,
} from '../helpers/media';

/**
 * Renders the saved accordion body in read-only mode.
 * If the ADF doc is effectively empty, we show a friendly placeholder message.
 */
export default function ReadOnlyBody({ item }) {
  const doc = item.bodyAdf ?? plainTextToAdf('');
  const hasContent = hasRenderableAdfContent(doc);
  const attachments = normalizeMediaAttachments(item.attachments);
  const hasAttachments = attachments.length > 0;

  return (
    <Box padding="space.100">
      <Stack space="space.200">
        {hasContent ? (
          <AdfRenderer document={doc} />
        ) : (
          <Text>No description for the moment</Text>
        )}

        {hasAttachments ? (
          <Stack space="space.100">
            <Text as="span" weight="medium">
              Media
            </Text>
            <Inline space="space.200" shouldWrap>
              {attachments.map((attachment) => {
                return (
                  <AttachmentTile key={attachment.id} attachment={attachment} />
                );
              })}
            </Inline>
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}

function AttachmentTile({ attachment }) {
  const isImage = isImageMedia(attachment);
  const isVideo = isVideoMedia(attachment);
  const attachmentId = resolveAttachmentId(attachment);
  const labelText = attachment.label?.trim() || attachment.fileName;

  const [resolvedUrl, setResolvedUrl] = useState(
    ''
  );
  const [loadError, setLoadError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadAttachmentPreview() {
      if (!attachmentId) return;

      try {
        if (!isImage) return;

        const endpoint = `/rest/api/3/attachment/thumbnail/${attachmentId}`;

        const response = await requestJira(endpoint);
        if (!response.ok) throw new Error(`Attachment fetch failed: ${response.status}`);

        const blob = await response.blob();
        const dataUrl = await blobToDataUrl(blob);
        if (active) {
          setResolvedUrl(dataUrl);
          setLoadError(false);
        }
      } catch (_error) {
        if (active) setLoadError(true);
      }
    }

    loadAttachmentPreview();

    return () => {
      active = false;
    };
  }, [attachmentId, isImage]);

  async function downloadAttachment() {
    if (!attachmentId) {
      setLoadError(true);
      return;
    }

    setDownloading(true);
    setLoadError(false);

    try {
      const response = await requestJira(`/rest/api/3/attachment/content/${attachmentId}`);
      if (!response.ok) throw new Error(`Attachment fetch failed: ${response.status}`);

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = attachment.fileName || 'attachment';
      anchor.rel = 'noopener';
      anchor.target = '_blank';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (_error) {
      setLoadError(true);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Box
      xcss={{
        width: '160px',
      }}
    >
      <Stack space="space.050">
        {isImage && resolvedUrl ? (
          <Image src={resolvedUrl} alt={labelText} width={160} />
        ) : (
          <Text as="span">{attachment.fileName}</Text>
        )}

        <Button
          appearance="subtle"
          spacing="compact"
          onClick={downloadAttachment}
          isDisabled={downloading}
        >
          {downloading ? 'Preparing file...' : isVideo ? 'Download video' : 'Download file'}
        </Button>

        {loadError ? (
          <Text as="span" color="color.text.warning">
            Preview unavailable in this context.
          </Text>
        ) : null}

        <Tooltip content={labelText}>
          <Text as="span" color="color.text.subtle" align="center" maxLines={2}>
            {labelText}
          </Text>
        </Tooltip>
      </Stack>
    </Box>
  );
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to decode attachment preview.'));
    reader.readAsDataURL(blob);
  });
}
