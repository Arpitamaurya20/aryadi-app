import type { PpmChecklistItem, PpmGeneralDetails } from '../api/ppmWork';
import { readJson, removeKey, writeJson } from './localStore';

const DraftTtlMs = 30 * 24 * 60 * 60 * 1000;

export type PpmReportDraft = {
  savedAt: number;
  general: PpmGeneralDetails;
  assetCondition: string;
  items: Pick<PpmChecklistItem, 'id' | 'value' | 'status' | 'remarks'>[];
};

function draftKey(ticketId: string | number) {
  return `aryadi.ppm.reportDraft.${ticketId}`;
}

/** Unsent service report input for a ticket, kept on the device until the report is submitted. */
export async function loadPpmReportDraft(ticketId: string | number): Promise<PpmReportDraft | null> {
  const draft = await readJson<PpmReportDraft>(draftKey(ticketId));
  if (!draft || typeof draft.savedAt !== 'number' || Date.now() - draft.savedAt > DraftTtlMs) {
    if (draft) await removeKey(draftKey(ticketId));
    return null;
  }
  return draft;
}

export function savePpmReportDraft(
  ticketId: string | number,
  draft: Omit<PpmReportDraft, 'savedAt'>,
): Promise<void> {
  return writeJson(draftKey(ticketId), {
    savedAt: Date.now(),
    general: draft.general,
    assetCondition: draft.assetCondition,
    items: draft.items.map(({ id, value, status, remarks }) => ({ id, value, status, remarks })),
  } satisfies PpmReportDraft);
}

export function clearPpmReportDraft(ticketId: string | number): Promise<void> {
  return removeKey(draftKey(ticketId));
}
