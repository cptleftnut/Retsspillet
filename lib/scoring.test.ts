import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCreditReward,
  combineEvidenceItems,
  computeLiveJuryPersuasion,
  computeLogicRadarMetrics,
  computeTrialTotals,
  determineGestureFromEvaluation,
  determineVerdictWinner,
  evaluateArgument,
  evaluateTutorialSimulationStep,
  extractCaseLogEvents,
  getPhaseRelevantEvidence,
  getTutorialStepsForRole,
  mapPlayableRoleToTutorialPath,
  purchaseShopItem,
} from './scoring';
import type { LegalCase, PlayerProfile, ShopItem, TranscriptEntry } from './types';

const sampleCase: LegalCase = {
  id: 'case-0001',
  caseNumber: '#0001',
  title: 'Den forsvundne cykel',
  category: 'Tyveri / Øvelsessag',
  difficulty: 'Begynder',
  source: 'Indbygget',
  isTutorial: true,
  summary: 'En cykel er forsvundet fra et aflåst cykelskur.',
  charge: 'Tyveri af cykel',
  prosecutionGoal: 'Bevis gerningsmandens adgang og motiv.',
  defenseGoal: 'Skab rimelig tvivl om overvågning og nøgleadgang.',
  defendantName: 'Mads Lind',
  coreIssues: ['nøglekort', 'tidsstempel', 'overvågning', 'jakke'],
  rewardCredits: 250,
  witnesses: [],
  evidence: [
    {
      id: 'ev-cam',
      title: 'Overvågningsbillede kl. 21:14',
      type: 'video',
      summary: 'Sløret skikkelse i mørk hættetrøje ved skuret.',
      detail: 'Tidsstemplet viser 21:14, men ansigtet er skjult.',
      reliabilityWeight: 7,
      supports: 'prosecution',
      keywords: ['21:14', 'overvågning', 'hættetrøje'],
      contradictionHint: 'Tiltalte hævdede at være hjemme fra kl. 20:30.',
    },
    {
      id: 'ev-key',
      title: 'Log for nøglekort #14',
      type: 'digital',
      summary: 'Nøglekort #14 låste skuret op kl. 21:12.',
      detail: 'Kortet tilhører tiltalte, men blev meldt mistet dagen efter.',
      reliabilityWeight: 9,
      supports: 'prosecution',
      keywords: ['nøglekort', '21:12', 'låste'],
    },
    {
      id: 'ev-receipt',
      title: 'Bagerkvittering fra tirsdag',
      type: 'document',
      summary: 'En kvittering for to rundstykker.',
      detail: 'Uden relation til gerningstidspunktet.',
      reliabilityWeight: 1,
      supports: 'neutral',
      keywords: ['rundstykker'],
      isIrrelevant: true,
    },
  ],
};

test('concise coherent argument with primary evidence beats verbose irrelevant spam', () => {
  const strong = evaluateArgument({
    text: 'Nøglekort #14 låste skuret op kl. 21:12, hvilket modstrider tiltaltes forklaring og beviser tilstedeværelse sammenholdt med overvågning.',
    role: 'Anklager',
    citedEvidenceIds: ['ev-key', 'ev-cam'],
    legalCase: sampleCase,
    priorEntries: [],
    isCrossExam: true,
  });

  const verboseSpam = evaluateArgument({
    text: 'jeg siger bare at tingene skete og det er meget vigtigt at alle hører efter fordi alle ved at cykler forsvinder når nogen tager dem og rundstykker er gode og det hele bare er helt klart skyldig skyldig skyldig uden tvivl overhovedet',
    role: 'Anklager',
    citedEvidenceIds: ['ev-receipt'],
    legalCase: sampleCase,
    priorEntries: [],
  });

  assert.ok(
    strong.turnScore > verboseSpam.turnScore + 25,
    `Expected strong (${strong.turnScore}) >> verboseSpam (${verboseSpam.turnScore})`
  );
  assert.ok(verboseSpam.penalty >= 10);
});

test('repeating an identical argument incurs repetition penalty', () => {
  const firstText =
    'Nøglekort #14 blev brugt kl. 21:12, og det dokumenterer adgang til cykelskuret.';
  const prior: TranscriptEntry[] = [
    {
      id: 't1',
      speakerRole: 'Anklager',
      speakerName: 'Anklager',
      phase: 'evidence',
      text: firstText,
      citedEvidenceIds: ['ev-key'],
      timestamp: '10:00',
    },
  ];

  const repeated = evaluateArgument({
    text: firstText,
    role: 'Anklager',
    citedEvidenceIds: ['ev-key'],
    legalCase: sampleCase,
    priorEntries: prior,
  });

  assert.ok(repeated.penalty >= 18);
  assert.ok(Boolean(repeated.judicialWarning));
});

test('prosecution requires higher coherence than defense due to burden of proof', () => {
  const tieVerdict = determineVerdictWinner(68, 68);
  assert.equal(tieVerdict.winner, 'Forsvarer');

  const clearProsVerdict = determineVerdictWinner(82, 61);
  assert.equal(clearProsVerdict.winner, 'Anklager');
  assert.equal(clearProsVerdict.juryVotesProsecution + clearProsVerdict.juryVotesDefense, 6);
});

test('shop purchase deducts credits and equips unlocked item', () => {
  const baseProfile: PlayerProfile = {
    displayName: 'Spiller',
    credits: 300,
    preferredRole: 'Anklager',
    tutorialCompleted: true,
    tutorialHighestStep: 10,
    completedLevels: ['Begynder'],
    judgeIntroCompleted: false,
    unlockedItemIds: ['hat-none'],
    equipped: {
      hat: 'hat-none',
      outfit: 'outfit-classic',
      color: 'color-burgundy',
      animation: 'anim-gavel',
      courtroom: 'court-oak',
    },
    wallet: {
      status: 'unlinked',
      network: 'ethereum-sepolia-ready',
      address: null,
      pendingCreditsBridge: 0,
    },
    history: [],
    ttsEnabled: true,
    ttsRate: 1,
    ttsEngine: 'browser',
    judgeVoiceProfile: 'Charon',
    counselVoiceProfile: 'Kore',
    soundMuted: false,
  };

  const hat: ShopItem = {
    id: 'hat-wig',
    name: 'Dommerparyk',
    category: 'hat',
    price: 250,
    description: 'Klassisk hvid paryk',
    value: 'wig',
  };

  const bought = purchaseShopItem(baseProfile, hat);
  assert.equal(bought.success, true);
  assert.equal(bought.profile.credits, 50);
  assert.equal(bought.profile.equipped.hat, 'hat-wig');

  const tooExpensive = purchaseShopItem(bought.profile, {
    ...hat,
    id: 'hat-crown',
    price: 500,
  });
  assert.equal(tooExpensive.success, false);
  assert.equal(tooExpensive.profile.credits, 50);
});

test('computeTrialTotals and calculateCreditReward stay within bounds', () => {
  const totals = computeTrialTotals([
    {
      id: '1',
      speakerRole: 'Anklager',
      speakerName: 'A',
      phase: 'evidence',
      text: 'x',
      citedEvidenceIds: [],
      timestamp: '10:00',
      evaluation: {
        turnScore: 84,
        coherenceScore: 42,
        evidenceWeightScore: 30,
        rebuttalScore: 12,
        penalty: 0,
        momentumDelta: 10,
        feedback: 'God',
      },
    },
  ]);

  assert.equal(totals.prosecutionAverage, 84);
  assert.equal(calculateCreditReward(200, true, 84, false), 240);
});

test('tiered role tutorials provide distinct paths and interactive simulation checks', () => {
  assert.equal(mapPlayableRoleToTutorialPath('Anklager'), 'Anklager');
  assert.equal(mapPlayableRoleToTutorialPath('Forsvarer'), 'Forsvarer');
  assert.equal(mapPlayableRoleToTutorialPath('Tiltalte'), 'Forsvarer');
  assert.equal(mapPlayableRoleToTutorialPath('Dommer'), 'Dommer');

  const prosSteps = getTutorialStepsForRole('Anklager');
  const defSteps = getTutorialStepsForRole('Forsvarer');
  const judgeSteps = getTutorialStepsForRole('Dommer');

  assert.equal(prosSteps.length, 8);
  assert.equal(defSteps.length, 8);
  assert.equal(judgeSteps.length, 8);

  // Every step across all 3 paths must have a valid best simulation option
  for (const list of [prosSteps, defSteps, judgeSteps]) {
    for (const step of list) {
      const bestIdx = step.simulation.options.findIndex((o) => o.isBest);
      assert.ok(bestIdx >= 0, `Missing best option in ${step.rolePath} step ${step.stepNumber}`);
      const res = evaluateTutorialSimulationStep(step, bestIdx);
      assert.equal(res.passed, true);
      assert.ok(res.nextStepNumber >= step.stepNumber);
    }
  }
});

test('determineGestureFromEvaluation maps rebuttalScore and objections to 3D gestures', () => {
  assert.equal(
    determineGestureFromEvaluation(
      {
        turnScore: 88,
        coherenceScore: 44,
        evidenceWeightScore: 30,
        rebuttalScore: 14,
        penalty: 0,
        momentumDelta: 11,
        feedback: 'Skarp',
      },
      false
    ),
    'skeptical'
  );

  assert.equal(
    determineGestureFromEvaluation(
      {
        turnScore: 74,
        coherenceScore: 38,
        evidenceWeightScore: 28,
        rebuttalScore: 8,
        penalty: 0,
        momentumDelta: 8,
        feedback: 'God',
      },
      false
    ),
    'note_points'
  );

  assert.equal(
    determineGestureFromEvaluation(
      {
        turnScore: 52,
        coherenceScore: 28,
        evidenceWeightScore: 20,
        rebuttalScore: 4,
        penalty: 0,
        momentumDelta: 3,
        feedback: 'Acceptabel',
      },
      false
    ),
    'read_papers'
  );

  assert.equal(
    determineGestureFromEvaluation(
      {
        turnScore: 52,
        coherenceScore: 28,
        evidenceWeightScore: 20,
        rebuttalScore: 4,
        penalty: 0,
        momentumDelta: 3,
        feedback: 'Indsigelse',
      },
      true
    ),
    'objection_point'
  );
});

test('computeLiveJuryPersuasion shifts votes continuously with transcript and primary evidence', () => {
  const initial = computeLiveJuryPersuasion([], [], sampleCase, 0, 0);
  assert.equal(initial.prosecutionPct + initial.defensePct, 100);
  assert.equal(initial.juryVotesProsecution + initial.juryVotesDefense, 6);
  // Burden of proof favors defense slightly before prosecution presents evidence
  assert.ok(initial.defensePct >= initial.prosecutionPct);

  const strongProsEval = evaluateArgument({
    text: 'Nøglekort #14 låste skuret op kl. 21:12, hvilket modstrider tiltaltes forklaring og dokumenterer uafbrudt adgang sammenholdt med overvågning.',
    role: 'Anklager',
    citedEvidenceIds: ['ev-key', 'ev-cam'],
    legalCase: sampleCase,
    priorEntries: [],
    isCrossExam: true,
  });

  const prosTranscript: TranscriptEntry[] = [
    {
      id: 't-pros-1',
      speakerRole: 'Anklager',
      speakerName: 'Anklager',
      phase: 'cross_exam',
      text: 'Nøglekort #14 låste skuret op kl. 21:12, hvilket modstrider tiltaltes forklaring og dokumenterer adgang.',
      citedEvidenceIds: ['ev-key', 'ev-cam'],
      evaluation: strongProsEval,
      isContradiction: true,
      timestamp: '10:02',
    },
  ];

  const afterPros = computeLiveJuryPersuasion(prosTranscript, ['ev-key'], sampleCase, 4, 1);
  assert.equal(afterPros.prosecutionPct + afterPros.defensePct, 100);
  assert.equal(afterPros.juryVotesProsecution + afterPros.juryVotesDefense, 6);
  assert.ok(
    afterPros.prosecutionPct > initial.prosecutionPct,
    `Expected prosecution % (${afterPros.prosecutionPct}) > initial (${initial.prosecutionPct})`
  );
  assert.equal(afterPros.leadingSide, 'Anklager');
});

test('computeLogicRadarMetrics compares player argument axes against evidence reliability', () => {
  const baseline = computeLogicRadarMetrics([], [], sampleCase, 'Anklager');
  assert.equal(baseline.axes.length, 5);
  assert.ok(baseline.weakPoints.length > 0);

  const strongEval = evaluateArgument({
    text: 'Nøglekort #14 låste skuret op kl. 21:12, hvilket modstrider tiltaltes forklaring og beviser adgang sammenholdt med overvågning kl. 21:14.',
    role: 'Anklager',
    citedEvidenceIds: ['ev-key', 'ev-cam'],
    legalCase: sampleCase,
    priorEntries: [],
    isCrossExam: true,
  });

  const entries: TranscriptEntry[] = [
    {
      id: 't-radar-1',
      speakerRole: 'Anklager',
      speakerName: 'Spiller',
      phase: 'cross_exam',
      text: 'Nøglekort #14 låste skuret op kl. 21:12...',
      citedEvidenceIds: ['ev-key', 'ev-cam'],
      evaluation: strongEval,
      isContradiction: true,
      timestamp: '10:05',
    },
  ];

  const after = computeLogicRadarMetrics(entries, ['ev-key', 'ev-cam'], sampleCase, 'Anklager');
  assert.ok(after.overallStrength > baseline.overallStrength);
  assert.equal(after.collectedEvidenceAvgReliability, 80);
  assert.ok(after.strongPoints.length >= 2);
});

test('getPhaseRelevantEvidence ranks contradiction exhibits highest in cross_exam and filters out noise', () => {
  const crossRecs = getPhaseRelevantEvidence(sampleCase, 'cross_exam', true, ['ev-key'], []);
  assert.ok(crossRecs.length >= 1);
  assert.ok(crossRecs.every((r) => !r.evidence.isIrrelevant));
  assert.equal(crossRecs[0].evidence.id, 'ev-cam');
});

test('extractCaseLogEvents summarizes judge rulings, objections, and judicial warnings chronologically', () => {
  const log = extractCaseLogEvents([
    {
      id: 'e1',
      speakerRole: 'Dommer',
      speakerName: 'Præsiderende Dommer',
      phase: 'opening',
      text: 'Retten er sat.',
      citedEvidenceIds: [],
      timestamp: '10:00',
    },
    {
      id: 'e2',
      speakerRole: 'Anklager',
      speakerName: 'Spiller',
      phase: 'evidence',
      text: 'Kort',
      citedEvidenceIds: ['ev-noise'],
      timestamp: '10:01',
      evaluation: {
        turnScore: 12,
        coherenceScore: 6,
        evidenceWeightScore: 6,
        rebuttalScore: 0,
        penalty: 20,
        momentumDelta: -4,
        feedback: 'Svag',
        judicialWarning: 'Irrelevant bilag udelades af retten.',
      },
    },
    {
      id: 'e3',
      speakerRole: 'Forsvarer',
      speakerName: 'AI-Forsvarer',
      phase: 'cross_exam',
      text: 'Indsigelse mod gentagelse.',
      citedEvidenceIds: [],
      isObjection: true,
      timestamp: '10:02',
    },
  ]);

  assert.equal(log.length, 3);
  assert.equal(log[0].category, 'ruling');
  assert.equal(log[1].category, 'warning');
  assert.equal(log[2].category, 'objection');
});

test('combineEvidenceItems generates contradictions, corroborations, and noise warnings', () => {
  const keyEv = sampleCase.evidence[0];
  const camEv = sampleCase.evidence[1];
  const noiseEv = sampleCase.evidence[2];

  const contra = combineEvidenceItems(keyEv, camEv, sampleCase, 'Anklager');
  assert.equal(contra.kind, 'contradiction');
  assert.equal(contra.recommendedPhase, 'Krydsforhør');
  assert.ok(contra.combinedStrength >= 70);
  assert.ok(contra.draftArgument.includes(keyEv.title));

  const warn = combineEvidenceItems(keyEv, noiseEv, sampleCase, 'Anklager');
  assert.equal(warn.kind, 'warning');
  assert.ok(warn.combinedStrength < contra.combinedStrength);
});


