import type { AuthUser } from '../api/auth';
import type { SiteVisit } from '../api/siteVisits';
import { readJson } from './localStore';

/** Site visits created from this device, keyed per signed-in employee. */
export function mySiteVisitsKey(user: AuthUser) {
  return `site_visits_mine_${user.employeeId || user.id || user.loginName}`;
}

export async function readMySiteVisits(user: AuthUser): Promise<SiteVisit[]> {
  const saved = await readJson<SiteVisit[]>(mySiteVisitsKey(user));
  return Array.isArray(saved) ? saved.filter((item) => item && Number(item.id) > 0) : [];
}
