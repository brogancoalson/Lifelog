import type { AppData } from '../types';
import { AWARD_AREAS, AWARD_ORDER } from './categories';
import { awardTotals, fmtHours, fmtMinutes } from './stats';

/** Plain-text award log, grouped by area, for sharing with a validator. */
export function awardExport(data: AppData): string {
  const a = data.settings.award;
  const totals = awardTotals(data.entries);
  const lines = [`Congressional Award log (${a.level})`, ''];
  for (const area of AWARD_ORDER) {
    const target = a.targets[area];
    lines.push(`${AWARD_AREAS[area].label}: ${fmtHours(totals[area])}${target ? ` / ${target}` : ''} hrs`);
    const items = data.entries.filter((e) => e.awardArea === area).sort((x, y) => x.date.localeCompare(y.date));
    for (const e of items) {
      lines.push(`  ${e.date}  ${fmtMinutes(e.minutes ?? 0)}  ${e.text}${e.validator ? `  (validator: ${e.validator})` : ''}`);
    }
    lines.push('');
  }
  lines.push(`Expedition trip: ${a.expeditionDone ? 'completed' : 'not yet'}`);
  return lines.join('\n');
}
