import { isValidBlock, type NewTimeBlock } from '../domain/timeBlock';
import { fromLocalInput } from './datetimeInput';

export const INVALID_DATETIME_ERROR = '日時が正しくありません。';
export const INVALID_RANGE_ERROR = '終了は開始より後にしてください。';

export interface BlockFormValues {
  start: string;
  end: string;
}

export type BlockFormResult =
  | { ok: true; block: NewTimeBlock }
  | { ok: false; error: string };

export function validateBlockForm(values: BlockFormValues): BlockFormResult {
  const start = fromLocalInput(values.start);
  const end = fromLocalInput(values.end);
  if (!start || !end) return { ok: false, error: INVALID_DATETIME_ERROR };
  if (!isValidBlock({ start, end })) {
    return { ok: false, error: INVALID_RANGE_ERROR };
  }
  return { ok: true, block: { start, end } };
}

export async function submitBlockForm(
  values: BlockFormValues,
  onValid: (block: NewTimeBlock) => Promise<void>,
): Promise<string | null> {
  const result = validateBlockForm(values);
  if (!result.ok) return result.error;
  await onValid(result.block);
  return null;
}
