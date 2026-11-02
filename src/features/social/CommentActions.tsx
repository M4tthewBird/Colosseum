/** Under a comment: Delete on your own, Report on anyone else's. */
import { Text } from 'react-native';

import { confirm } from '@/stores/ui';
import { type } from '@/theme/tokens';
import { askToReport, type ReportTarget } from './report';

export function CommentActions({
  mine,
  target,
  id,
  onDelete,
  onAsking,
}: {
  mine: boolean;
  target: ReportTarget;
  id: string;
  onDelete: () => void;
  /** A sheet has to step aside while the question is open: it would cover it. */
  onAsking?: (asking: boolean) => void;
}) {
  const press = async () => {
    onAsking?.(true);
    if (mine) {
      const ok = await confirm({
        title: 'Delete this comment?',
        confirmLabel: 'Delete',
        destructive: true,
      });
      if (ok) onDelete();
    } else await askToReport(target, id);
    onAsking?.(false);
  };
  return (
    <Text
      accessibilityRole="button"
      accessibilityLabel={mine ? 'Delete comment' : 'Report comment'}
      onPress={() => void press()}
      style={[type.small, { alignSelf: 'flex-start', paddingVertical: 6, paddingRight: 16 }]}
    >
      {mine ? 'Delete' : 'Report'}
    </Text>
  );
}
