import type { LegalCase, TranscriptEntry } from './types';

export interface GavelSlamRecord {
  id: string;
  timestamp: string;
  reason: string;
  phase: string;
  kind?: 'order' | 'objection_sustained' | 'warning' | 'dismiss_evidence';
}

export interface TimelineNode {
  id: string;
  sourceKind: 'evidence' | 'witness' | 'transcript' | 'gavel';
  evidenceId?: string;
  timeLabel: string;
  dayBucketLabel: string;
  sortMinutes: number;
  title: string;
  summary: string;
  detail?: string;
  isCollected: boolean;
  supports: 'prosecution' | 'defense' | 'neutral';
  reliabilityWeight?: number;
  isIrrelevant?: boolean;
  contradictionHint?: string;
  isGavelSlam?: boolean;
  gavelInterventionKind?: 'order' | 'objection_sustained' | 'warning' | 'dismiss_evidence';
  gavelTimestamp?: string;
}

interface ParsedChronology {
  sortMinutes: number;
  timeLabel: string;
  dayBucketLabel: string;
  hasExplicitTime: boolean;
}

function detectDayOffset(text: string): { offsetDays: number; bucket: string } | null {
  const lower = text.toLowerCase();
  if (/tre uger tidligere|uger tidligere/.test(lower)) {
    return { offsetDays: -21, bucket: 'Forudgående (uger før)' };
  }
  if (/tre dage før|flere dage før|tirsdag|sidste uge/.test(lower)) {
    return { offsetDays: -3, bucket: 'Forudgående dag' };
  }
  if (/dagen før|i går/.test(lower)) {
    return { offsetDays: -1, bucket: 'Dagen før' };
  }
  if (/dagen efter|næste morgen|døgn senere/.test(lower)) {
    return { offsetDays: 1, bucket: 'Dagen efter' };
  }
  if (/samme aften|samme dag|på gerningstidspunktet/.test(lower)) {
    return { offsetDays: 0, bucket: 'Gerningstidspunkt' };
  }
  return null;
}

function parseClockTime(text: string): { hours: number; minutes: number; seconds: number; raw: string } | null {
  const m = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  const seconds = m[3] ? Number(m[3]) : 0;
  return { hours, minutes, seconds, raw: m[0] };
}

function parseChronology(
  primaryText: string,
  secondaryText: string,
  fallbackIndex: number
): ParsedChronology {
  const primaryClock = parseClockTime(primaryText);
  const primaryDay = detectDayOffset(primaryText);

  if (primaryClock) {
    const offsetDays = primaryDay?.offsetDays ?? 0;
    const bucket =
      primaryDay?.bucket ??
      (offsetDays < 0 ? 'Forudgående' : offsetDays > 0 ? 'Efterfølgende' : 'Samme døgn');
    const sortMinutes =
      offsetDays * 1440 + primaryClock.hours * 60 + primaryClock.minutes + primaryClock.seconds / 60;
    return {
      sortMinutes,
      timeLabel: `kl. ${primaryClock.raw}`,
      dayBucketLabel: bucket,
      hasExplicitTime: true,
    };
  }

  if (primaryDay) {
    return {
      sortMinutes: primaryDay.offsetDays * 1440 + 720 + fallbackIndex,
      timeLabel: primaryDay.bucket,
      dayBucketLabel: primaryDay.bucket,
      hasExplicitTime: true,
    };
  }

  const secondaryClock = parseClockTime(secondaryText);
  const secondaryDay = detectDayOffset(secondaryText);

  if (secondaryClock) {
    const offsetDays = secondaryDay?.offsetDays ?? 0;
    const bucket =
      secondaryDay?.bucket ??
      (offsetDays < 0 ? 'Forudgående' : offsetDays > 0 ? 'Efterfølgende' : 'Samme døgn');
    const sortMinutes =
      offsetDays * 1440 +
      secondaryClock.hours * 60 +
      secondaryClock.minutes +
      secondaryClock.seconds / 60;
    return {
      sortMinutes,
      timeLabel: `kl. ${secondaryClock.raw}`,
      dayBucketLabel: bucket,
      hasExplicitTime: true,
    };
  }

  if (secondaryDay) {
    return {
      sortMinutes: secondaryDay.offsetDays * 1440 + 720 + fallbackIndex,
      timeLabel: secondaryDay.bucket,
      dayBucketLabel: secondaryDay.bucket,
      hasExplicitTime: true,
    };
  }

  // Relative short cues (e.g. "3 sekunder før kollision")
  const combined = `${primaryText} ${secondaryText}`.toLowerCase();
  if (/sekunder? før|s før/.test(combined)) {
    return {
      sortMinutes: 719 + fallbackIndex * 0.01,
      timeLabel: 'Sekunder før hændelse',
      dayBucketLabel: 'Gerningstidspunkt',
      hasExplicitTime: false,
    };
  }

  return {
    sortMinutes: 10000 + fallbackIndex,
    timeLabel: 'Uden klokkeslæt',
    dayBucketLabel: 'Kontekst',
    hasExplicitTime: false,
  };
}

/**
 * Extracts and chronologically sorts all evidence items and witness timestamps
 * so players can inspect causal sequences and contradictions in the Dossier timeline.
 */
export function extractCaseTimeline(
  legalCase: LegalCase,
  selectedEvidenceIds: string[],
  transcript?: TranscriptEntry[],
  gavelEvents?: GavelSlamRecord[]
): TimelineNode[] {
  const nodes: TimelineNode[] = [];
  const selectedSet = new Set(selectedEvidenceIds);

  legalCase.evidence.forEach((ev, idx) => {
    const primary = `${ev.title} ${ev.summary}`;
    const secondary = `${ev.detail} ${ev.contradictionHint ?? ''} ${ev.keywords.join(' ')}`;
    const chrono = parseChronology(primary, secondary, idx);

    nodes.push({
      id: `tl-ev-${ev.id}`,
      sourceKind: 'evidence',
      evidenceId: ev.id,
      timeLabel: chrono.timeLabel,
      dayBucketLabel: chrono.dayBucketLabel,
      sortMinutes: chrono.sortMinutes,
      title: ev.title,
      summary: ev.summary,
      detail: ev.detail,
      isCollected: selectedSet.has(ev.id),
      supports: ev.supports,
      reliabilityWeight: ev.reliabilityWeight,
      isIrrelevant: ev.isIrrelevant,
      contradictionHint: ev.contradictionHint,
    });

    // If detail explicitly mentions a distinct follow-up event like "spærret dagen efter kl. 09:30",
    // surface it as a connected follow-up timeline cue when the primary clock differs.
    const detailLower = ev.detail.toLowerCase();
    if (/dagen efter|næste morgen/.test(detailLower)) {
      const followClock = parseClockTime(
        ev.detail.slice(detailLower.search(/dagen efter|næste morgen/))
      );
      if (followClock) {
        nodes.push({
          id: `tl-ev-${ev.id}-followup`,
          sourceKind: 'evidence',
          evidenceId: ev.id,
          timeLabel: `kl. ${followClock.raw} (dagen efter)`,
          dayBucketLabel: 'Dagen efter',
          sortMinutes: 1440 + followClock.hours * 60 + followClock.minutes,
          title: `Opfølgning: ${ev.title}`,
          summary: ev.contradictionHint || ev.detail,
          isCollected: selectedSet.has(ev.id),
          supports: ev.supports,
          reliabilityWeight: ev.reliabilityWeight,
          isIrrelevant: ev.isIrrelevant,
        });
      }
    }
  });

  legalCase.witnesses.forEach((w, idx) => {
    const chrono = parseChronology(w.statement, w.weakness, 50 + idx);
    if (!chrono.hasExplicitTime) return;
    nodes.push({
      id: `tl-wit-${w.id}`,
      sourceKind: 'witness',
      timeLabel: chrono.timeLabel,
      dayBucketLabel: chrono.dayBucketLabel,
      sortMinutes: chrono.sortMinutes,
      title: `Vidne: ${w.name} (${w.roleTitle})`,
      summary: w.statement,
      detail: `Svaghed: ${w.weakness}`,
      isCollected: true,
      supports: w.supports,
      contradictionHint: w.weakness,
    });
  });

  if (transcript && transcript.length > 0) {
    transcript.forEach((entry, idx) => {
      if (entry.citedEvidenceIds.length === 0 && !entry.isContradiction) return;
      const clock = parseClockTime(entry.text);
      if (!clock) return;
      // Only add if it introduces a time reference during cross-exam/evidence not already duplicated verbatim
      const minutes = clock.hours * 60 + clock.minutes;
      const alreadyExists = nodes.some(
        (n) => Math.abs(n.sortMinutes - minutes) < 0.5 && n.sourceKind !== 'transcript'
      );
      if (!alreadyExists) {
        nodes.push({
          id: `tl-tr-${entry.id}`,
          sourceKind: 'transcript',
          timeLabel: `kl. ${clock.raw}`,
          dayBucketLabel: 'Retsbog-reference',
          sortMinutes: minutes + idx * 0.001,
          title: `${entry.speakerRole} i retten`,
          summary: entry.text,
          isCollected: true,
          supports:
            entry.speakerRole === 'Anklager'
              ? 'prosecution'
              : entry.speakerRole === 'Forsvarer' || entry.speakerRole === 'Tiltalte'
                ? 'defense'
                : 'neutral',
        });
      }
    });
  }

  // Include judicial gavel-slam interventions as visual timeline milestones
  if (gavelEvents && gavelEvents.length > 0) {
    gavelEvents.forEach((gavel, idx) => {
      const clock = parseClockTime(gavel.timestamp);
      const minutes = clock ? clock.hours * 60 + clock.minutes : 720 + idx * 5;
      nodes.push({
        id: `tl-gavel-${gavel.id}`,
        sourceKind: 'gavel',
        isGavelSlam: true,
        gavelInterventionKind: gavel.kind ?? 'order',
        gavelTimestamp: gavel.timestamp,
        timeLabel: clock ? `kl. ${clock.raw}` : `kl. ${gavel.timestamp}`,
        dayBucketLabel: 'Retssalen (Dommerindgreb)',
        sortMinutes: minutes + idx * 0.001,
        title: 'Dommerens hammer slået',
        summary: gavel.reason,
        detail: `Hårdt retsligt indgreb under sagens ${gavel.phase}-fase. Retten kræver orden og saglig bevisførelse.`,
        isCollected: true,
        supports: 'neutral',
      });
    });
  }

  return nodes.sort((a, b) => a.sortMinutes - b.sortMinutes);
}
