import React, { useMemo, useState } from 'react';
import {
  Button,
  CommentEditor,
  FilePicker,
  Label,
  SectionMessage,
  Stack,
  Text,
  Textfield,
} from '@forge/react';
import { inputValueFromChangePayload } from '../helpers/accordion';
import {
  normalizeAdfFromEditorPayload,
  plainTextToAdf,
} from '../helpers/adf';

/**
 * Inline editor shown inside an expanded accordion item while editing.
 * Title is a Textfield and description is stored as rich ADF.
 */
export default function InlineEditor({ draft, setDraft }) {
  const [selectionError, setSelectionError] = useState(null);
  const [pickerKey, setPickerKey] = useState(0);
  const attachments = useMemo(
    () => (Array.isArray(draft?.attachments) ? draft.attachments : []),
    [draft?.attachments]
  );

  if (!draft) return null;

  async function queueSelectedFiles(files) {
    if (!Array.isArray(files) || files.length === 0) return;

    try {
      // We only stage files in draft. Real upload happens on Save from parent.
      const queued = files.map((file, index) => ({
        id: `queued_${Date.now()}_${index}_${Math.random().toString(16).slice(2)}`,
        fileName: file?.name || 'attachment',
        mimeType: file?.type || '',
        size: Number(file?.size || 0),
        contentUrl: '',
        thumbnailUrl: '',
        label: '',
        pendingUpload: true,
        sourceFile: {
          data: file?.data || '',
          name: file?.name || 'attachment',
          size: Number(file?.size || 0),
          type: file?.type || 'application/octet-stream',
        },
      }));

      setDraft((prev) => ({
        ...prev,
        attachments: [...(Array.isArray(prev?.attachments) ? prev.attachments : []), ...queued],
      }));
      setSelectionError(null);
    } catch (error) {
      setSelectionError(error?.message ?? 'Failed to queue selected file.');
    } finally {
      // Reset picker so selecting the same local file triggers onChange again.
      setPickerKey((value) => value + 1);
    }
  }

  function removeAttachment(attachmentId) {
    setDraft((prev) => ({
      ...prev,
      attachments: (Array.isArray(prev?.attachments) ? prev.attachments : []).filter(
        (attachment) => attachment?.id !== attachmentId
      ),
    }));
    // Also reset picker after removals to keep same-file reselection reliable.
    setPickerKey((value) => value + 1);
  }

  function updateAttachmentLabel(attachmentId, payload) {
    const label = inputValueFromChangePayload(payload);

    setDraft((prev) => ({
      ...prev,
      attachments: (Array.isArray(prev?.attachments) ? prev.attachments : []).map((attachment) =>
        attachment?.id === attachmentId
          ? {
            ...attachment,
            label,
          }
          : attachment
      ),
    }));
  }

  function labelFieldId(attachmentId) {
    const safe = String(attachmentId).replace(/[^a-zA-Z0-9_-]/g, '-');
    return `attachment-label-${safe}`;
  }

  function attachmentDisplayName(attachment) {
    return attachment?.fileName || attachment?.filename || 'Attachment';
  }

  function attachmentDisplayMimeType(attachment) {
    return attachment?.mimeType || attachment?.type || '';
  }

  function attachmentLabelValue(attachment) {
    return typeof attachment?.label === 'string' ? attachment.label : '';
  }

  function isPendingAttachment(attachment) {
    return Boolean(attachment?.pendingUpload);
  }

  return (
    <Stack space="space.200">
      <Stack space="space.0">
        <Label labelFor="accordion-title-input">Title</Label>
        <Textfield
          id="accordion-title-input"
          name="accordion-title"
          value={draft.title}
          onChange={(payload) =>
            setDraft((prev) => ({
              ...prev,
              title: inputValueFromChangePayload(payload),
            }))
          }
        />
      </Stack>

      <Stack space="space.0">
        <Text as="span" weight="medium">
          Description
        </Text>
        <CommentEditor
          defaultValue={draft.bodyAdf ?? plainTextToAdf('')}
          features={{
            textFormatting: true,
            textColor: true,
            list: true,
            hyperLink: true,
            insertBlock: true,
            quickInsert: true,
            blockType: true,
            codeBlock: true,
          }}
          onChange={(value) =>
            setDraft((prev) => ({
              ...prev,
              bodyAdf: normalizeAdfFromEditorPayload(value),
            }))
          }
        />
      </Stack>

      <Stack space="space.100">
        <Text as="span" weight="medium">
          Attachments
        </Text>
        <Text color="color.text.subtle">
          Selected files are queued and will upload when you click Save.
        </Text>
        <FilePicker
          // key={`attachment-picker-${pickerKey}`}
          // label="Upload media"
          // description="Select local image/video files to attach."
          // onChange={queueSelectedFiles}
        />

        {selectionError ? (
          <SectionMessage title="Attachment error" appearance="error">
            <Text>{selectionError}</Text>
          </SectionMessage>
        ) : null}

        {attachments.length === 0 ? (
          <Text color="color.text.subtle">No media attached yet.</Text>
        ) : null}

        {attachments.map((attachment) => (
          <Stack key={attachment.id} space="space.050">
            <Text>
              {attachmentDisplayName(attachment)}
              {attachmentDisplayMimeType(attachment) ? ` (${attachmentDisplayMimeType(attachment)})` : ''}
            </Text>
            {isPendingAttachment(attachment) ? (
              <Text color="color.text.subtle">Will upload on Save</Text>
            ) : null}
            <Button
              appearance="subtle"
              spacing="compact"
              onClick={() => removeAttachment(attachment.id)}
            >
              Remove attachment
            </Button>
            <Text as="span" weight="medium">
              Media label
            </Text>
            <Textfield
              id={labelFieldId(attachment.id)}
              value={attachmentLabelValue(attachment)}
              placeholder="Short label shown in view mode"
              onChange={(payload) =>
                updateAttachmentLabel(attachment.id, payload)
              }
            />
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
