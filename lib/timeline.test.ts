import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILT_IN_CASES } from './gameData';
import { extractCaseTimeline } from './timeline';

test('extractCaseTimeline sorts case #0001 evidence and witnesses strictly chronologically', () => {
  const case0001 = BUILT_IN_CASES[0];
  const timeline = extractCaseTimeline(case0001, ['ev-keylog', 'ev-laundry']);

  // Expect prior day bakery receipt first, then 20:55 (witness), 20:58 (laundry), 21:12:08 (keylog), 21:14 (cctv), 21:15 (witness), then 09:30 next day
  const titles = timeline.map((n) => n.title);
  const idxBakery = titles.findIndex((t) => t.includes('bagerkvittering'));
  const idxNabo = titles.findIndex((t) => t.includes('Sofie Kragh'));
  const idxLaundry = titles.findIndex((t) => t.includes('Vaskeri-kvittering'));
  const idxKeylog = titles.findIndex((t) => t.includes('Adgangslog'));
  const idxCctv = titles.findIndex((t) => t.includes('Overvågningsbillede'));
  const idxVicevaert = titles.findIndex((t) => t.includes('Henrik Møller'));
  const idxFollowup = titles.findIndex((t) => t.includes('Opfølgning: Bilag A'));

  assert.ok(idxBakery >= 0 && idxBakery < idxNabo);
  assert.ok(idxNabo < idxLaundry);
  assert.ok(idxLaundry < idxKeylog);
  assert.ok(idxKeylog < idxCctv);
  assert.ok(idxCctv < idxVicevaert);
  assert.ok(idxVicevaert < idxFollowup);

  const keylogNode = timeline[idxKeylog];
  assert.equal(keylogNode.isCollected, true);
  assert.equal(timeline[idxCctv].isCollected, false);
});

test('extractCaseTimeline keeps prior multi-week evidence before evening events in case #0108', () => {
  const case0108 = BUILT_IN_CASES.find((c) => c.id === 'case-0108')!;
  const timeline = extractCaseTimeline(case0108, ['ev-audit']);

  assert.ok(timeline.length >= 2);
  assert.ok(timeline[0].title.includes('Intern mail'));
  assert.ok(timeline[1].title.includes('CRM Audit Log'));
  assert.equal(timeline[1].isCollected, true);
  assert.equal(timeline[0].isCollected, false);
});

test('extractCaseTimeline inserts distinct gavel-slam intervention markers with isGavelSlam: true', () => {
  const case0001 = BUILT_IN_CASES[0];
  const gavelEvents = [
    {
      id: 'gavel-1',
      timestamp: '21:13:00',
      reason: 'Ro i retssalen! Parterne bedes holde sig til beviserne.',
      phase: 'cross_exam',
      kind: 'order' as const,
    },
  ];
  const timeline = extractCaseTimeline(case0001, [], undefined, gavelEvents);
  const gavelNode = timeline.find((n) => n.id === 'tl-gavel-gavel-1');

  assert.ok(gavelNode, 'Gavel node should be created');
  assert.equal(gavelNode.isGavelSlam, true);
  assert.equal(gavelNode.sourceKind, 'gavel');
  assert.equal(gavelNode.timeLabel, 'kl. 21:13:00');
  assert.ok(gavelNode.summary.includes('Ro i retssalen'));

  // Verify chronological ordering between 21:12 (keylog) and 21:14 (cctv)
  const idxKeylog = timeline.findIndex((n) => n.id === 'tl-ev-ev-keylog');
  const idxGavel = timeline.findIndex((n) => n.id === 'tl-gavel-gavel-1');
  const idxCctv = timeline.findIndex((n) => n.id === 'tl-ev-ev-cctv');

  assert.ok(idxKeylog < idxGavel, 'Keylog (21:12) should be before gavel (21:13)');
  assert.ok(idxGavel < idxCctv, 'Gavel (21:13) should be before cctv (21:14)');
});
