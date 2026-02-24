import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  DynamicTable,
  Inline,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  useProductContext,
} from '@forge/react';
import { invoke, requestJira } from '@forge/bridge';
import AccordionRow from './AccordionRow';
import {
  nextOrder,
  reorderByIndex,
  sortByOrder,
  uuidLike,
} from '../helpers/accordion';
import { plainTextToAdf } from '../helpers/adf';
import {
  normalizeMediaAttachment,
  normalizeMediaAttachments,
  serializedFileToBlob,
} from '../helpers/media';

/**
 * Main container responsible for fetching/saving document state and
 * coordinating row-level editing interactions.
 */
export default function AccordionPanel() {
  const context = useProductContext();

  // Forge context shapes vary slightly across modules. We resolve a stable issue id.
  const issueId =
    context?.platformContext?.issueId ??
    context?.issue?.id ??
    context?.extension?.issue?.id ??
    context?.extensionContext?.issueId ??
    null;

  const [doc, setDoc] = useState(null);
  const items = useMemo(() => sortByOrder(doc?.items ?? []), [doc]);

  const [expanded, setExpanded] = useState(() => new Set());
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        if (!issueId) throw new Error('Could not resolve issueId from context.');
        const data = await invoke('accordions.get', { issueId });
        if (mounted) setDoc(data);
      } catch (e) {
        if (mounted) setError(e?.message ?? String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [issueId]);

  function toggleExpanded(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startEdit(item) {
    setError(null);
    setEditingId(item.id);

    // Force open after the click event cycle completes.
    // This keeps behavior deterministic when header + action click handlers overlap.
    setTimeout(() => {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.add(item.id);
        return next;
      });
    }, 0);

    setDraft({
      id: item.id,
      title: item.title ?? '',
      bodyAdf: item.bodyAdf ?? plainTextToAdf(''),
      attachments: normalizeMediaAttachments(item.attachments),
      order: item.order ?? 0,
      createdAt: item.createdAt ?? null,
      createdBy: item.createdBy ?? null,
    });
  }

  function cancelEdit() {
    const editedId = editingId;
    setEditingId(null);
    setDraft(null);
    setError(null);

    // Collapse after the click cycle to avoid accidental re-open by parent toggles.
    if (editedId) {
      setTimeout(() => {
        setExpanded((prev) => {
          const next = new Set(prev);
          next.delete(editedId);
          return next;
        });
      }, 0);
    }
  }

  async function persist(nextDoc) {
    if (!issueId) return false;
    setSaving(true);
    setError(null);

    try {
      const res = await invoke('accordions.save', { issueId, doc: nextDoc });
      if (!res?.ok) {
        if (res?.conflict) {
          setError(res?.message || 'Conflict saving. Please reload.');
          setDoc(res.current);
        } else {
          setError('Failed to save.');
        }
        return false;
      }
      setDoc(res.doc);
      return true;
    } catch (e) {
      setError(e?.message ?? String(e));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!draft || !editingId || !doc) return;
    if (!issueId) return;
    if (saving) return;

    let resolvedAttachments = normalizeMediaAttachments(draft.attachments);

    const stagedAttachments = Array.isArray(draft.attachments) ? draft.attachments : [];
    const hasPendingUploads = stagedAttachments.some((attachment) => attachment?.pendingUpload);

    if (hasPendingUploads) {
      setSaving(true);
      setError(null);

      try {
        const uploaded = [];

        // Upload only files queued in edit mode; keep previously uploaded media as-is.
        for (const attachment of stagedAttachments) {
          if (!attachment?.pendingUpload) {
            const normalizedExisting = normalizeMediaAttachment(attachment);
            if (normalizedExisting) uploaded.push(normalizedExisting);
            continue;
          }

          const sourceFile = attachment?.sourceFile;
          if (!sourceFile) {
            throw new Error('Queued attachment is missing source file data.');
          }

          const blob = await serializedFileToBlob(sourceFile);
          const formData = new FormData();
          formData.append('file', blob, sourceFile.name || attachment.fileName || 'attachment');

          const response = await requestJira(`/rest/api/3/issue/${issueId}/attachments`, {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const detail = await response.text();
            throw new Error(`Attachment upload failed (${response.status}): ${detail}`);
          }

          const payload = await response.json();
          const jiraAttachment = Array.isArray(payload) ? payload[0] : payload;

          const normalizedUploaded = normalizeMediaAttachment({
            id: jiraAttachment?.id,
            filename: jiraAttachment?.filename || sourceFile.name || attachment.fileName,
            mimeType: jiraAttachment?.mimeType || sourceFile.type || attachment.mimeType,
            size: jiraAttachment?.size || sourceFile.size || attachment.size,
            content: jiraAttachment?.content,
            thumbnail: jiraAttachment?.thumbnail,
            label: attachment?.label || '',
          });

          if (normalizedUploaded) uploaded.push(normalizedUploaded);
        }

        resolvedAttachments = uploaded;
      } catch (e) {
        setError(e?.message ?? String(e));
        setSaving(false);
        return;
      }

      setSaving(false);
    }

    const updatedItems = (doc.items ?? []).map((it) => {
      if (it.id !== editingId) return it;
      return {
        ...it,
        title: draft.title,
        bodyAdf: draft.bodyAdf ?? plainTextToAdf(''),
        attachments: resolvedAttachments,
        order: it.order,
        updatedAt: new Date().toISOString(),
      };
    });

    const nextDoc = { ...doc, items: updatedItems };
    const saved = await persist(nextDoc);
    if (!saved) return;
    setEditingId(null);
    setDraft(null);
  }

  async function addAccordion() {
    if (!doc) return;

    const id = uuidLike();
    const now = new Date().toISOString();

    const item = {
      id,
      title: '',
      bodyAdf: plainTextToAdf(''),
      attachments: [],
      resolved: false,
      order: nextOrder(doc.items ?? []),
      createdAt: now,
      createdBy: null,
      updatedAt: now,
    };

    const optimisticDoc = { ...doc, items: [...(doc.items ?? []), item] };
    setDoc(optimisticDoc);

    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    await persist(optimisticDoc);
  }

  async function removeAccordion(id) {
    if (!doc) return;

    const nextItems = (doc.items ?? []).filter((it) => it.id !== id);
    const nextDoc = { ...doc, items: nextItems };
    await persist(nextDoc);

    setExpanded((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    if (editingId === id) cancelEdit();
  }

  async function reorderAccordions(sourceIndex, destinationIndex) {
    if (!doc) return;
    if (sourceIndex === destinationIndex) return;

    const reorderedItems = reorderByIndex(doc.items ?? [], sourceIndex, destinationIndex);
    const nextDoc = { ...doc, items: reorderedItems };

    // Optimistic local update keeps the UI responsive while the resolver persists.
    setDoc(nextDoc);
    await persist(nextDoc);
  }

  async function toggleResolved(id) {
    if (!doc || saving) return;

    const nextItems = (doc.items ?? []).map((it) => {
      if (it.id !== id) return it;
      return {
        ...it,
        resolved: !Boolean(it.resolved),
        updatedAt: new Date().toISOString(),
      };
    });

    const nextDoc = { ...doc, items: nextItems };
    await persist(nextDoc);
  }

  async function handleRankEnd(rankEnd) {
    const sourceIndex = rankEnd?.sourceIndex;
    const destinationIndex = rankEnd?.destination?.index;

    // Dropping outside the target area yields no destination; we safely ignore it.
    if (typeof sourceIndex !== 'number' || typeof destinationIndex !== 'number') return;
    await reorderAccordions(sourceIndex, destinationIndex);
  }

  if (!context) {
    return (
      <Stack space="space.200" alignInline="center">
        <Spinner />
        <Text>Loading context...</Text>
      </Stack>
    );
  }

  if (loading) {
    return (
      <Stack space="space.200" alignInline="center">
        <Spinner />
        <Text>Loading...</Text>
      </Stack>
    );
  }

  if (!issueId) {
    return (
      <>
        <SectionMessage title="Missing issue context" appearance="error">
          <Text>Could not determine issueId. Check the panel context.</Text>
        </SectionMessage>

        <Text>Context keys: {Object.keys(context).join(', ')}</Text>
        <Text>platformContext: {JSON.stringify(context.platformContext)}</Text>
      </>
    );
  }

  return (
    <Box
      backgroundColor="elevation.surface"
      padding="space.200"
      xcss={{
        borderColor: 'color.border',
        borderWidth: 'border.width',
        borderStyle: 'solid',
        borderRadius: 'radius.medium',
      }}
    >
      <Stack space="space.200">
        <Inline alignInline="space-between" alignBlock="center">
          <Text weight="bold">Feedback Items</Text>
          <Button onClick={addAccordion} isDisabled={saving}>
            Add
          </Button>
        </Inline>

        {error ? (
          <SectionMessage title="Something went wrong" appearance="error">
            <Text>{error}</Text>
          </SectionMessage>
        ) : null}

        {items.length === 0 ? (
          <SectionMessage title="No feedback yet" appearance="information">
            <Text>Click "Add" to create the first feedback for this issue.</Text>
          </SectionMessage>
        ) : null}

        {items.length > 0 ? (
          <Box>
            <DynamicTable
              label="Accordion items"
              isRankable={!saving && !editingId}
              rowsPerPage={Math.max(items.length, 1)}
              onRankEnd={handleRankEnd}
              rows={items.map((item) => {
                const isEditing = editingId === item.id && draft?.id === item.id;

                return {
                  key: item.id,
                  cells: [
                    {
                      key: `accordion-row-${item.id}`,
                      content: (
                        <Box
                          xcss={{
                            // DynamicTable injects cell padding (8px inline, 4px block).
                            // Cancel that padding, then add a tiny controlled row gap so
                            // adjacent card borders do not collapse into a thick separator.
                            // Keep this wrapper opaque so DynamicTable row hover background
                            // does not bleed as a halo above/below the accordion card.
                            backgroundColor: 'elevation.surface',
                            marginInline: 'space.negative.100',
                            marginBlock: 'space.negative.050',
                            paddingBlock: 'space.075',
                          }}
                        >
                          <AccordionRow
                            item={item}
                            expanded={expanded.has(item.id)}
                            editing={isEditing}
                            draft={isEditing ? draft : null}
                            setDraft={setDraft}
                            onToggleExpand={() => toggleExpanded(item.id)}
                            onToggleResolved={() => toggleResolved(item.id)}
                            onStartEdit={() => startEdit(item)}
                            onCancel={cancelEdit}
                            onSave={saveEdit}
                            onDelete={() => removeAccordion(item.id)}
                            isBusy={saving}
                          />
                        </Box>
                      ),
                    },
                  ],
                };
              })}
            />

            <Box
              xcss={{
                // DynamicTable adds a hard-coded 2px bottom border when rows exist.
                // Overlap with a taller strip to fully hide the rule across all rows.
                height: 'space.100',
                backgroundColor: 'elevation.surface',
                marginBlockStart: 'space.negative.150',
              }}
            />
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}
