import React from 'react';
import {
  Box,
  Button,
  Checkbox,
  Icon,
  Inline,
  Pressable,
  Stack,
  Text,
  Tooltip,
} from '@forge/react';
import InlineEditor from './InlineEditor';
import ReadOnlyBody from './ReadOnlyBody';

/**
 * Single accordion row (header + optional expanded body).
 * Kept isolated so the panel container stays focused on data/state orchestration.
 */
export default function AccordionRow({
  item,
  expanded,
  editing,
  draft,
  setDraft,
  onToggleExpand,
  onStartEdit,
  onCancel,
  onSave,
  onToggleResolved,
  onDelete,
  isBusy,
}) {
  const resolutionTooltip = item.resolved
    ? 'Mark as unresolved'
    : 'Mark as resolved';

  return (
    <Box
      xcss={{
        borderColor: 'color.border',
        borderWidth: 'border.width',
        borderStyle: 'solid',
        borderRadius: 'radius.medium',
        backgroundColor: 'elevation.surface',
        // Keep rounded clipping in normal mode, but allow editor popovers to escape
        // when the row is in edit mode.
        overflow: editing ? 'visible' : 'hidden',
        minHeight: '48px',
      }}
    >
      <Stack space="space.0">
        {/* Keep most of the header non-interactive so DynamicTable can treat it as drag handle area. */}
        <Box
          xcss={{
            width: '100%',
            minHeight: '48px',
            paddingInline: 'space.100',
            paddingBlock: 'space.100',
            backgroundColor: 'elevation.surface',
            ':hover': {
              backgroundColor: 'elevation.surface.hovered',
            },
          }}
        >
          <Inline alignInline="space-between" alignBlock="center">
            <Inline space="space.0" alignBlock="center">
              <Tooltip content={expanded ? 'Collapse' : 'Expand'}>
                <Pressable
                  onClick={onToggleExpand}
                  xcss={{
                    width: '24px',
                    height: '24px',
                    borderRadius: 'radius.small',
                    ':hover': {
                      backgroundColor: 'color.background.neutral.subtle.hovered',
                    },
                    ':active': {
                      backgroundColor: 'color.background.neutral.subtle.pressed',
                    },
                  }}
                >
                  <Icon glyph={expanded ? 'chevron-down' : 'chevron-right'} label={expanded ? 'Collapse' : 'Expand'} size="small" />
                </Pressable>
              </Tooltip>
              <Box xcss={{ marginInlineStart: 'space.150' }}>
                <Tooltip content={resolutionTooltip}>
                  <Checkbox
                    label=""
                    isChecked={Boolean(item.resolved)}
                    isDisabled={isBusy}
                    onChange={onToggleResolved}
                  />
                </Tooltip>
              </Box>
              <Box xcss={{ marginInlineStart: 'space.100' }}>
                <Text as="span" weight="bold">
                  {item.title?.trim() ? item.title : 'Untitled'}
                </Text>
              </Box>
            </Inline>

            {/* Compact action buttons similar to Jira icon action affordances. */}
            <Inline space="space.100" alignBlock="center">
              {editing ? (
                <>
                  <Button appearance="primary" onClick={onSave} isDisabled={isBusy}>
                    Save
                  </Button>
                  <Button onClick={onCancel} isDisabled={isBusy}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Tooltip content="Edit">
                    <Pressable
                      onClick={onStartEdit}
                      isDisabled={isBusy}
                      xcss={{
                        width: '32px',
                        height: '32px',
                        borderRadius: 'radius.small',
                        backgroundColor: 'color.background.neutral.subtle',
                        ':hover': {
                          backgroundColor: 'color.background.neutral.subtle.hovered',
                        },
                        ':active': {
                          backgroundColor: 'color.background.neutral.subtle.pressed',
                        },
                      }}
                    >
                      <Icon glyph="edit" label="Edit" size="small" />
                    </Pressable>
                  </Tooltip>

                  <Tooltip content="Delete">
                    <Pressable
                      onClick={onDelete}
                      isDisabled={isBusy}
                      xcss={{
                        width: '32px',
                        height: '32px',
                        borderRadius: 'radius.small',
                        backgroundColor: 'color.background.neutral.subtle',
                        ':hover': {
                          backgroundColor: 'color.background.neutral.subtle.hovered',
                        },
                        ':active': {
                          backgroundColor: 'color.background.neutral.subtle.pressed',
                        },
                      }}
                    >
                      <Icon glyph="trash" label="Delete" size="small" color="color.icon.danger" />
                    </Pressable>
                  </Tooltip>
                </>
              )}
            </Inline>
          </Inline>
        </Box>

        {expanded ? (
          <Box padding="space.100">
            {editing ? (
              draft ? (
                <InlineEditor draft={draft} setDraft={setDraft} />
              ) : (
                <Text>Preparing editor...</Text>
              )
            ) : (
              <ReadOnlyBody item={item} />
            )}
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}
