import type {
  ArgumentEvaluation,
  CaseLogItem,
  CounselGestureType,
  CourtRole,
  EvidenceCombinationResult,
  EvidenceItem,
  LegalCase,
  LiveJuryPersuasion,
  LogicRadarMetrics,
  PhaseEvidenceRecommendation,
  PlayableRole,
  PlayerProfile,
  RoleTutorialStepDef,
  ShopItem,
  TranscriptEntry,
  TrialPhase,
  TutorialRolePath,
} from './types';
import { ROLE_TUTORIAL_PATHS } from './gameData';

export function mapPlayableRoleToTutorialPath(role: PlayableRole): TutorialRolePath {
  if (role === 'Dommer') return 'Dommer';
  if (role === 'Forsvarer' || role === 'Tiltalte') return 'Forsvarer';
  return 'Anklager';
}

export function getTutorialStepsForRole(role: PlayableRole): RoleTutorialStepDef[] {
  const path = mapPlayableRoleToTutorialPath(role);
  return ROLE_TUTORIAL_PATHS[path];
}

export function evaluateTutorialSimulationStep(
  step: RoleTutorialStepDef,
  optionIndex: number
): { passed: boolean; feedback: string; nextStepNumber: number } {
  const chosen = step.simulation.options[optionIndex];
  if (!chosen) {
    return {
      passed: false,
      feedback: 'Vælg en svarmulighed i simulationen.',
      nextStepNumber: step.stepNumber,
    };
  }
  const totalSteps = ROLE_TUTORIAL_PATHS[step.rolePath].length;
  return {
    passed: chosen.isBest,
    feedback: chosen.feedback,
    nextStepNumber: chosen.isBest
      ? Math.min(totalSteps, step.stepNumber + 1)
      : step.stepNumber,
  };
}

export interface EvaluateArgumentInput {
  text: string;
  role: PlayableRole;
  citedEvidenceIds: string[];
  legalCase: LegalCase;
  priorEntries: TranscriptEntry[];
  isCrossExam?: boolean;
  targetClaim?: string;
}

const LOGICAL_CONNECTORS = [
  'fordi',
  'derfor',
  'viser',
  'beviser',
  'dokumenterer',
  'modstrider',
  'sammenholdt',
  'konsekvens',
  'årsag',
  'alibi',
  'tidspunkt',
  'tidsstempel',
  'vidne',
  'tvivl',
  'sandsynlig',
  'uoverensstemmelse',
  'bekræfter',
  'afkræfter',
  'påstand',
  'konklusion',
  'bevisbyrde',
  'objektiv',
];

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function roleSide(role: CourtRole): 'prosecution' | 'defense' | 'neutral' {
  if (role === 'Anklager') return 'prosecution';
  if (role === 'Forsvarer' || role === 'Tiltalte') return 'defense';
  return 'neutral';
}

/**
 * Core Game Design Algorithm:
 * Rewards logical coherence, causal reasoning, contradiction detection, and
 * accurate primary evidence — NEVER rewards verbosity or evidence spamming.
 */
export function evaluateArgument(input: EvaluateArgumentInput): ArgumentEvaluation {
  const tokens = tokenize(input.text);
  const uniqueTokens = new Set(tokens);
  const side = roleSide(input.role);

  const citedItems: EvidenceItem[] = input.citedEvidenceIds
    .map((id) => input.legalCase.evidence.find((e) => e.id === id))
    .filter((e): e is EvidenceItem => Boolean(e));

  // 1. Structural & Logical Coherence (0 - 50)
  let coherenceScore = 0;
  if (tokens.length >= 4) {
    coherenceScore += 10;
  }
  // Reward concise substance (8-55 words), not endless padding
  const lexicalDiversity = tokens.length > 0 ? uniqueTokens.size / tokens.length : 0;
  if (tokens.length >= 8 && tokens.length <= 75 && lexicalDiversity >= 0.52) {
    coherenceScore += 14;
  } else if (tokens.length > 75 && lexicalDiversity >= 0.45) {
    coherenceScore += 10;
  } else if (tokens.length >= 5) {
    coherenceScore += 6;
  }

  // Causal / legal reasoning connectors
  const connectorHits = LOGICAL_CONNECTORS.filter((c) => uniqueTokens.has(c)).length;
  coherenceScore += Math.min(16, connectorHits * 5);

  // Alignment with the case's core factual issues
  const coreIssueTokens = tokenize(input.legalCase.coreIssues.join(' '));
  const coreOverlap = tokens.filter((t) => coreIssueTokens.includes(t)).length;
  coherenceScore += Math.min(10, coreOverlap * 3);

  // 2. Evidence Relevance & Weight (0 - 35)
  let evidenceWeightScore = 0;
  let penalty = 0;
  const warnings: string[] = [];

  if (citedItems.length > 0) {
    // Spamming 4+ exhibits at once reduces clarity
    if (citedItems.length > 3) {
      penalty += (citedItems.length - 3) * 6;
      warnings.push('For mange bilag på én gang svækker fokus.');
    }

    const relevantCited = citedItems.filter((item) => {
      if (item.isIrrelevant) return false;
      if (side === 'neutral') return true;
      return item.supports === side || item.supports === 'neutral';
    });

    const irrelevantCited = citedItems.filter((item) => item.isIrrelevant);
    const harmfulCited = citedItems.filter(
      (item) =>
        !item.isIrrelevant &&
        side !== 'neutral' &&
        item.supports !== 'neutral' &&
        item.supports !== side
    );

    if (irrelevantCited.length > 0) {
      penalty += irrelevantCited.length * 10;
      warnings.push('Urelevant bilag afvist af retten.');
    }
    if (harmfulCited.length > 0) {
      // Citing opponent's evidence only works if actively rebutting/cross-examining
      if (input.isCrossExam || uniqueTokens.has('modstrider') || uniqueTokens.has('tvivl')) {
        evidenceWeightScore += 8;
      } else {
        penalty += harmfulCited.length * 6;
        warnings.push('Det fremlagte bilag støtter faktisk modpartens udlægning.');
      }
    }

    // Weight by highest-quality cited items (capped at 2 best exhibits so stacking doesn't win)
    const sortedWeights = relevantCited
      .map((e) => {
        const keywordMatch = e.keywords.some((kw) =>
          input.text.toLowerCase().includes(kw.toLowerCase())
        );
        return e.reliabilityWeight * (keywordMatch ? 1.85 : 1.15);
      })
      .sort((a, b) => b - a)
      .slice(0, 2);

    const rawEvidencePoints = sortedWeights.reduce((sum, w) => sum + w, 0);
    evidenceWeightScore += Math.min(35, Math.round(rawEvidencePoints));
  } else {
    // Check if text explicitly cites case facts even without selecting a card
    const anyEvidenceKeyword = input.legalCase.evidence.some(
      (e) =>
        !e.isIrrelevant &&
        e.keywords.some((kw) => input.text.toLowerCase().includes(kw.toLowerCase()))
    );
    if (anyEvidenceKeyword) {
      evidenceWeightScore += 10;
    }
  }

  // 3. Rebuttal & Contradiction Detection (0 - 15)
  let rebuttalScore = 0;
  const opponentEntries = input.priorEntries.filter(
    (e) => roleSide(e.speakerRole) !== side && roleSide(e.speakerRole) !== 'neutral'
  );
  const lastOpponent = opponentEntries[opponentEntries.length - 1];
  if (lastOpponent) {
    const oppTokens = tokenize(lastOpponent.text);
    const shared = oppTokens.filter((t) => uniqueTokens.has(t) && t.length >= 4).length;
    if (shared >= 2 || input.isCrossExam) {
      rebuttalScore += 8;
    }
  }

  const exposedContradiction = citedItems.some(
    (e) =>
      Boolean(e.contradictionHint) &&
      (input.isCrossExam ||
        uniqueTokens.has('modstrider') ||
        uniqueTokens.has('uoverensstemmelse') ||
        uniqueTokens.has('forklaring') ||
        uniqueTokens.has('tidspunkt'))
  );
  if (exposedContradiction) {
    rebuttalScore += 7;
  }

  // 4. Repetition & Low-Effort Spam Penalty
  const sameSidePrior = input.priorEntries.filter(
    (e) => roleSide(e.speakerRole) === side && e.speakerRole !== 'Dommer'
  );
  for (const prev of sameSidePrior) {
    const sim = jaccardSimilarity(tokens, tokenize(prev.text));
    if (sim > 0.65) {
      penalty += 18;
      warnings.push('Gentagelse af tidligere argument giver ingen ny bevisværdi.');
      break;
    }
  }

  if (tokens.length < 4) {
    penalty += 15;
    warnings.push('Argumentet er for kort til at danne et logisk ræsonnement.');
  }
  if (tokens.length > 10 && lexicalDiversity < 0.38) {
    penalty += 12;
    warnings.push('Fyldord og gentagne gloser sænker troværdigheden.');
  }

  coherenceScore = Math.max(0, Math.min(50, coherenceScore));
  evidenceWeightScore = Math.max(0, Math.min(35, evidenceWeightScore));
  rebuttalScore = Math.max(0, Math.min(15, rebuttalScore));

  const rawTotal = coherenceScore + evidenceWeightScore + rebuttalScore - penalty;
  const turnScore = Math.max(0, Math.min(100, Math.round(rawTotal)));

  // Momentum delta shifts court balance toward the arguing side
  const strengthFactor = Math.round((turnScore - 35) / 5);
  let momentumDelta = 0;
  if (side === 'prosecution') momentumDelta = strengthFactor;
  else if (side === 'defense') momentumDelta = -strengthFactor;

  let feedback = 'Solidt indlæg.';
  if (turnScore >= 80) {
    feedback = 'Skarp logisk sammenhæng med tungtvejende og præcis bevisførelse.';
  } else if (turnScore >= 60) {
    feedback = 'Velunderbygget argumentation med klar kobling til sagens bilag.';
  } else if (turnScore >= 40) {
    feedback = 'Acceptabel påstand, men den mangler stærkere direkte bevisstøtte.';
  } else {
    feedback = 'Svagt underbygget indlæg. Dommeren efterspørger klare beviser og logisk årsagssammenhæng.';
  }

  return {
    turnScore,
    coherenceScore,
    evidenceWeightScore,
    rebuttalScore,
    penalty,
    momentumDelta,
    feedback,
    judicialWarning: warnings.length > 0 ? warnings[0] : undefined,
  };
}

export function computeTrialTotals(entries: TranscriptEntry[]): {
  prosecutionAverage: number;
  defenseAverage: number;
  prosecutionBest: number;
  defenseBest: number;
  momentum: number;
} {
  const prosScores: number[] = [];
  const defScores: number[] = [];
  let momentum = 0;

  for (const entry of entries) {
    if (!entry.evaluation) continue;
    momentum += entry.evaluation.momentumDelta;
    const side = roleSide(entry.speakerRole);
    if (side === 'prosecution') prosScores.push(entry.evaluation.turnScore);
    if (side === 'defense') defScores.push(entry.evaluation.turnScore);
  }

  const avg = (arr: number[]) =>
    arr.length === 0 ? 50 : Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

  return {
    prosecutionAverage: avg(prosScores),
    defenseAverage: avg(defScores),
    prosecutionBest: prosScores.length ? Math.max(...prosScores) : 0,
    defenseBest: defScores.length ? Math.max(...defScores) : 0,
    momentum: Math.max(-50, Math.min(50, momentum)),
  };
}

/**
 * Maps an argument's rebuttalScore / objection status into a distinct 3D courtroom gesture
 * for the opposing AI counsel or responding character.
 */
export function determineGestureFromEvaluation(
  evaluation?: ArgumentEvaluation,
  isObjection = false
): CounselGestureType {
  if (isObjection) return 'objection_point';
  const rebuttal = evaluation?.rebuttalScore ?? 0;
  if (rebuttal >= 12) return 'skeptical';
  if (rebuttal >= 7) return 'note_points';
  return 'read_papers';
}

export function getGestureDanishLabel(gesture: CounselGestureType): string {
  switch (gesture) {
    case 'skeptical':
      return 'Ser vantro';
    case 'note_points':
      return 'Noterer point';
    case 'read_papers':
      return 'Læser i papirer';
    case 'objection_point':
      return 'Skarp indsigelse';
    default:
      return 'Afventer';
  }
}

/**
 * Computes continuous real-time jury persuasion & 6-seat distribution from the latest
 * transcript entries, evaluation scores, cited primary evidence, and audience polling.
 */
export function computeLiveJuryPersuasion(
  transcript: TranscriptEntry[],
  selectedEvidenceIds: string[],
  legalCase: LegalCase,
  audienceVotesPros = 0,
  audienceVotesDef = 0
): LiveJuryPersuasion {
  const totals = computeTrialTotals(transcript);
  const scoredEntries = transcript.filter((e) => Boolean(e.evaluation));

  // Evidence weight balance from transcript citations + currently selected exhibits
  let evidenceBalance = 0;
  const countedIds = new Set<string>();

  for (const entry of transcript) {
    const side = roleSide(entry.speakerRole);
    for (const evId of entry.citedEvidenceIds) {
      const item = legalCase.evidence.find((e) => e.id === evId);
      if (!item || item.isIrrelevant) continue;
      const weight = item.reliabilityWeight * (countedIds.has(evId) ? 0.25 : 0.7);
      countedIds.add(evId);
      if (item.supports === 'prosecution' || (item.supports === 'neutral' && side === 'prosecution')) {
        evidenceBalance += weight;
      } else if (item.supports === 'defense' || (item.supports === 'neutral' && side === 'defense')) {
        evidenceBalance -= weight;
      }
    }
    if (entry.isContradiction) {
      evidenceBalance += side === 'prosecution' ? 3.5 : side === 'defense' ? -3.5 : 0;
    }
  }

  for (const evId of selectedEvidenceIds) {
    if (countedIds.has(evId)) continue;
    const item = legalCase.evidence.find((e) => e.id === evId);
    if (!item || item.isIrrelevant) continue;
    if (item.supports === 'prosecution') evidenceBalance += item.reliabilityWeight * 0.35;
    if (item.supports === 'defense') evidenceBalance -= item.reliabilityWeight * 0.35;
  }

  const audienceTotal = audienceVotesPros + audienceVotesDef;
  const audienceNudge =
    audienceTotal > 0 ? ((audienceVotesPros - audienceVotesDef) / audienceTotal) * 3.5 : 0;

  // Burden of proof baseline (-3 toward defense before evidence is presented: In dubio pro reo)
  const burdenBaseline = scoredEntries.length === 0 ? -3 : -2;
  const coherenceDiff =
    scoredEntries.length > 0 ? totals.prosecutionAverage - totals.defenseAverage : 0;
  const momentumContribution = totals.momentum * 0.35;

  const combinedDiff =
    coherenceDiff * 0.65 +
    momentumContribution +
    Math.max(-18, Math.min(18, evidenceBalance)) +
    audienceNudge +
    burdenBaseline;

  const prosecutionPct = Math.max(8, Math.min(92, Math.round(50 + combinedDiff * 1.15)));
  const defensePct = 100 - prosecutionPct;

  const juryVotesProsecution = Math.max(
    0,
    Math.min(6, Math.round((prosecutionPct / 100) * 6))
  );
  const juryVotesDefense = 6 - juryVotesProsecution;

  const leadingSide: 'Anklager' | 'Forsvarer' | 'Lige' =
    prosecutionPct >= 53 ? 'Anklager' : defensePct >= 53 ? 'Forsvarer' : 'Lige';

  const latestScored = [...scoredEntries].reverse()[0];
  const recentSwingDelta = latestScored?.evaluation?.momentumDelta ?? 0;

  let evidenceMomentumNote =
    'Juryen afventer de første dokumenterede indlæg (bevisbyrden ligger hos anklageren).';
  if (scoredEntries.length > 0) {
    if (leadingSide === 'Anklager') {
      evidenceMomentumNote =
        'Anklagerens bevisførelse og tidsstempler trækker et flertal af nævningene mod domfældelse.';
    } else if (leadingSide === 'Forsvarer') {
      evidenceMomentumNote =
        'Forsvaret har skabt tilstrækkelig tvivl eller modbevis til, at nævningeflertallet hælder mod frifindelse.';
    } else {
      evidenceMomentumNote =
        'Juryen står helt tæt — et skarpt krydsforhør med primærbevis kan tippe nævningebænken.';
    }
  }

  return {
    prosecutionPct,
    defensePct,
    juryVotesProsecution,
    juryVotesDefense,
    prosecutionCoherence: totals.prosecutionAverage,
    defenseCoherence: totals.defenseAverage,
    momentum: totals.momentum,
    leadingSide,
    recentSwingDelta,
    evidenceMomentumNote,
  };
}

/**
 * Computes 5-axis Logic Radar metrics comparing the player's submitted arguments
 * against the reliability weight of collected / available primary evidence.
 */
export function computeLogicRadarMetrics(
  transcript: TranscriptEntry[],
  selectedEvidenceIds: string[],
  legalCase: LegalCase,
  playerRole: PlayableRole
): LogicRadarMetrics {
  const playerSide = roleSide(playerRole);
  const playerEntries = transcript.filter((e) => {
    if (!e.evaluation) return false;
    if (playerSide === 'neutral') return e.speakerRole === playerRole;
    return roleSide(e.speakerRole) === playerSide && !e.speakerName.startsWith('AI-');
  });

  const allCitedIds = new Set<string>(selectedEvidenceIds);
  for (const entry of playerEntries) {
    for (const id of entry.citedEvidenceIds) allCitedIds.add(id);
  }

  const collectedItems = legalCase.evidence.filter((e) => allCitedIds.has(e.id));
  const validCaseEvidence = legalCase.evidence.filter((e) => !e.isIrrelevant);
  const validCollected = collectedItems.filter((e) => !e.isIrrelevant);
  const irrelevantCollected = collectedItems.filter((e) => e.isIrrelevant);

  const collectedEvidenceAvgReliability =
    collectedItems.length > 0
      ? Math.round(
          (collectedItems.reduce((s, e) => s + (e.isIrrelevant ? 1 : e.reliabilityWeight), 0) /
            collectedItems.length) *
            10
        )
      : 0;

  const avg = (nums: number[], fallback = 0) =>
    nums.length === 0 ? fallback : Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);

  const playerCoherence = avg(
    playerEntries.map((e) => Math.round(((e.evaluation?.coherenceScore ?? 0) / 50) * 100)),
    22
  );
  const playerEvidence = avg(
    playerEntries.map((e) => Math.round(((e.evaluation?.evidenceWeightScore ?? 0) / 35) * 100)),
    collectedItems.length > 0 ? Math.min(60, Math.round(collectedEvidenceAvgReliability * 0.6)) : 15
  );
  const playerRebuttal = avg(
    playerEntries.map((e) => Math.round(((e.evaluation?.rebuttalScore ?? 0) / 15) * 100)),
    15
  );
  const avgPenalty = avg(
    playerEntries.map((e) => e.evaluation?.penalty ?? 0),
    0
  );
  const playerRelevance = Math.max(
    10,
    Math.min(100, 92 - avgPenalty * 2 - irrelevantCollected.length * 20)
  );
  const coverageRatio =
    validCaseEvidence.length > 0
      ? Math.round((validCollected.length / validCaseEvidence.length) * 100)
      : 0;
  const playerCoverage = Math.max(12, Math.min(100, coverageRatio));

  // Evidence reliability benchmark curves per axis
  const primaryCount = validCaseEvidence.filter((e) => e.reliabilityWeight >= 7).length;
  const contradictionCapableCount = validCollected.filter((e) => Boolean(e.contradictionHint)).length;

  const evCoherenceBench =
    validCollected.length > 0 ? Math.min(95, Math.max(45, collectedEvidenceAvgReliability)) : 55;
  const evWeightBench =
    collectedItems.length > 0
      ? Math.min(100, Math.max(20, collectedEvidenceAvgReliability))
      : validCaseEvidence.length > 0
        ? Math.round(
            (validCaseEvidence.reduce((s, e) => s + e.reliabilityWeight, 0) /
              validCaseEvidence.length) *
              10
          )
        : 60;
  const evRebuttalBench = Math.min(
    95,
    35 + contradictionCapableCount * 30
  );
  const evRelevanceBench =
    irrelevantCollected.length > 0 ? Math.max(30, 95 - irrelevantCollected.length * 30) : 92;
  const evCoverageBench =
    primaryCount > 0
      ? Math.min(
          100,
          Math.max(40, Math.round((validCollected.filter((e) => e.reliabilityWeight >= 7).length / primaryCount) * 100))
        )
      : 70;

  const axes = [
    {
      key: 'coherence' as const,
      label: 'Logik & Kausalitet',
      playerScore: playerCoherence,
      evidenceBenchmark: evCoherenceBench,
    },
    {
      key: 'evidence' as const,
      label: 'Bevisvægt',
      playerScore: playerEvidence,
      evidenceBenchmark: evWeightBench,
    },
    {
      key: 'rebuttal' as const,
      label: 'Kryds & Modsigelse',
      playerScore: playerRebuttal,
      evidenceBenchmark: evRebuttalBench,
    },
    {
      key: 'relevance' as const,
      label: 'Fokus & Relevans',
      playerScore: playerRelevance,
      evidenceBenchmark: evRelevanceBench,
    },
    {
      key: 'coverage' as const,
      label: 'Bilagsdækning',
      playerScore: playerCoverage,
      evidenceBenchmark: evCoverageBench,
    },
  ];

  const overallStrength = Math.round(
    axes.reduce((sum, a) => sum + a.playerScore, 0) / axes.length
  );

  const strongPoints: string[] = [];
  const weakPoints: string[] = [];

  if (playerCoherence >= 70) {
    strongPoints.push('Stærk kausal sammenhæng i dine argumenter.');
  } else {
    weakPoints.push('Brug flere årsagsord ("dokumenterer", "sammenholdt", "fordi") for højere logik.');
  }

  if (playerEvidence >= 65 && validCollected.length > 0) {
    strongPoints.push(`Pålidelige primærbeviser i spil (snit ${collectedEvidenceAvgReliability}%).`);
  } else {
    weakPoints.push('Knyt mindst 1–2 højvægtede bilag direkte til tidsstempler i dit argument.');
  }

  if (playerRebuttal >= 60) {
    strongPoints.push('Skarp gendrivelse af modpartens forklaringer.');
  } else {
    weakPoints.push('Brug "Krydsforhør" til at påpege konkrete modsigelser i modpartens udsagn.');
  }

  if (irrelevantCollected.length > 0 || avgPenalty >= 10) {
    weakPoints.push('Fjern irrelevante bilag eller gentagelser, der trækker relevansen ned.');
  } else if (playerEntries.length > 0) {
    strongPoints.push('Disciplineret bilagsudvælgelse uden støj.');
  }

  return {
    axes,
    overallStrength,
    collectedEvidenceAvgReliability,
    strongPoints: strongPoints.slice(0, 3),
    weakPoints: weakPoints.slice(0, 3),
  };
}

/**
 * Determines which exhibits are newly relevant or pivotal for the current trial phase
 * so the Dossier can highlight them and display a subtle notification toast.
 */
export function getPhaseRelevantEvidence(
  legalCase: LegalCase,
  phase: TrialPhase,
  isCrossExam: boolean,
  selectedEvidenceIds: string[],
  transcript: TranscriptEntry[]
): PhaseEvidenceRecommendation[] {
  const alreadyUsed = new Set<string>(selectedEvidenceIds);
  for (const t of transcript) {
    for (const id of t.citedEvidenceIds) alreadyUsed.add(id);
  }

  const effectivePhase: TrialPhase = isCrossExam ? 'cross_exam' : phase;

  const ranked = legalCase.evidence
    .filter((ev) => !ev.isIrrelevant)
    .map((ev) => {
      let score = ev.reliabilityWeight;
      let reason = `Primært bilag (vægt ${ev.reliabilityWeight}/10) relevant for bevisførelsen.`;

      if (effectivePhase === 'cross_exam') {
        if (ev.contradictionHint) {
          score += 8;
          reason = `Nøgle til krydsforhør: ${ev.contradictionHint}`;
        }
      } else if (effectivePhase === 'opening' || effectivePhase === 'evidence') {
        if (ev.reliabilityWeight >= 7) {
          score += 5;
          reason = `Bærende primærbevis (vægt ${ev.reliabilityWeight}/10) til sagens åbning/bevisførelse.`;
        }
      } else if (effectivePhase === 'closing' || effectivePhase === 'jury') {
        if (ev.reliabilityWeight >= 6) {
          score += 4;
          reason = `Afgørende slutbilag (vægt ${ev.reliabilityWeight}/10) til den afsluttende procedure.`;
        }
      }

      return {
        evidence: ev,
        reason,
        isCollected: alreadyUsed.has(ev.id),
        _rank: score,
      };
    })
    .sort((a, b) => b._rank - a._rank);

  return ranked.slice(0, 2).map(({ evidence, reason, isCollected }) => ({
    evidence,
    reason,
    isCollected,
  }));
}

/**
 * Extracts a chronological log ("Sagslog") of all judicial rulings, objections,
 * judicial warnings, and confirmed contradictions across the trial transcript.
 */
export function extractCaseLogEvents(transcript: TranscriptEntry[]): CaseLogItem[] {
  const items: CaseLogItem[] = [];

  for (const entry of transcript) {
    const hasWarning = Boolean(entry.evaluation?.judicialWarning);
    const isJudge = entry.speakerRole === 'Dommer';
    const isObj = Boolean(entry.isObjection);
    const isContra = Boolean(entry.isContradiction);

    if (!isJudge && !isObj && !hasWarning && !isContra) continue;

    if (hasWarning && entry.evaluation?.judicialWarning) {
      items.push({
        id: `log-warn-${entry.id}`,
        transcriptId: entry.id,
        category: 'warning',
        categoryLabel: 'Dommeradvarsel',
        speakerRole: entry.speakerRole,
        speakerName: entry.speakerName,
        phase: entry.phase,
        timestamp: entry.timestamp,
        text: entry.evaluation.judicialWarning,
        detailNote: `Retten reagerede på indlæg fra ${entry.speakerRole}: "${entry.text.slice(0, 90)}${entry.text.length > 90 ? '…' : ''}"`,
        penalty: entry.evaluation.penalty,
        turnScore: entry.evaluation.turnScore,
        citedEvidenceIds: entry.citedEvidenceIds,
      });
    }

    if (isObj) {
      items.push({
        id: `log-obj-${entry.id}`,
        transcriptId: entry.id,
        category: 'objection',
        categoryLabel: isJudge ? 'Dommer-indsigelse' : 'Modparts indsigelse',
        speakerRole: entry.speakerRole,
        speakerName: entry.speakerName,
        phase: entry.phase,
        timestamp: entry.timestamp,
        text: entry.text,
        detailNote: entry.evaluation?.feedback,
        turnScore: entry.evaluation?.turnScore,
        citedEvidenceIds: entry.citedEvidenceIds,
      });
    } else if (isJudge) {
      items.push({
        id: `log-judge-${entry.id}`,
        transcriptId: entry.id,
        category: 'ruling',
        categoryLabel: 'Dommerafgørelse',
        speakerRole: entry.speakerRole,
        speakerName: entry.speakerName,
        phase: entry.phase,
        timestamp: entry.timestamp,
        text: entry.text,
        citedEvidenceIds: entry.citedEvidenceIds,
      });
    }

    if (isContra && !isJudge && !isObj) {
      items.push({
        id: `log-contra-${entry.id}`,
        transcriptId: entry.id,
        category: 'contradiction',
        categoryLabel: 'Påvist modsigelse',
        speakerRole: entry.speakerRole,
        speakerName: entry.speakerName,
        phase: entry.phase,
        timestamp: entry.timestamp,
        text: entry.text,
        detailNote: entry.evaluation?.feedback,
        turnScore: entry.evaluation?.turnScore,
        citedEvidenceIds: entry.citedEvidenceIds,
      });
    }
  }

  return items;
}

/**
 * Combines two selected exhibits into a specific legal corroboration ("Sammenhæng")
 * or contradiction ("Modsigelse") ready to insert into a courtroom argument.
 */
export function combineEvidenceItems(
  evA: EvidenceItem,
  evB: EvidenceItem,
  legalCase: LegalCase,
  playerRole: PlayableRole
): EvidenceCombinationResult {
  if (evA.isIrrelevant || evB.isIrrelevant) {
    const bad = evA.isIrrelevant ? evA : evB;
    const other = evA.isIrrelevant ? evB : evA;
    return {
      evidenceA: evA,
      evidenceB: evB,
      kind: 'warning',
      title: `Svag kobling: "${bad.title}" er processtøj`,
      summary: `${bad.title} har ingen bevismæssig sammenhæng med ${other.title} og vil udløse dommeradvarsel og kohærensstraf ved fremlæggelse.`,
      draftArgument: `${other.title} dokumenterer sagens faktiske forløb (${other.summary}), uden at inddrage uvedkommende materiale.`,
      combinedStrength: Math.max(15, Math.min(45, other.reliabilityWeight * 4)),
      recommendedPhase: 'Bevisførelse',
    };
  }

  const opposingSupports =
    (evA.supports === 'prosecution' && evB.supports === 'defense') ||
    (evA.supports === 'defense' && evB.supports === 'prosecution');

  const hintText = [evA.contradictionHint, evB.contradictionHint].filter(Boolean).join(' · ');
  const isContradiction = opposingSupports || Boolean(hintText);

  const avgWeight = (evA.reliabilityWeight + evB.reliabilityWeight) / 2;
  const side = roleSide(playerRole);
  const sideMatchBonus =
    (side === 'prosecution' && (evA.supports === 'prosecution' || evB.supports === 'prosecution')) ||
    (side === 'defense' && (evA.supports === 'defense' || evB.supports === 'defense'))
      ? 10
      : 4;

  const combinedStrength = Math.max(
    30,
    Math.min(98, Math.round(avgWeight * 8.5 + (isContradiction ? 12 : 6) + sideMatchBonus))
  );

  const kwA = evA.keywords.slice(0, 2).join(', ');
  const kwB = evB.keywords.slice(0, 2).join(', ');
  const kwPhrase = [kwA, kwB].filter(Boolean).join(' og ');

  if (isContradiction) {
    const summary = hintText
      ? `Direkte modsigelse mellem ${evA.title} og ${evB.title}: ${hintText}.`
      : `Sammenholdt afslører ${evA.title} og ${evB.title} en afgørende tidsmæssig eller faktuel modsigelse i sag ${legalCase.caseNumber}.`;

    const draftArgument = `Sammenholdt med ${evA.title} modsiger ${evB.title} modpartens forklaring${hintText ? ` — fordi ${hintText.toLowerCase()}` : ''}, hvilket dokumenteres gennem ${kwPhrase || 'sagens tidsstempler'}.`;

    return {
      evidenceA: evA,
      evidenceB: evB,
      kind: 'contradiction',
      title: `Modsigelse påvist: ${evA.title} × ${evB.title}`,
      summary,
      draftArgument,
      combinedStrength,
      recommendedPhase: 'Krydsforhør',
    };
  }

  const summary = `Beviskæde mellem ${evA.title} (vægt ${evA.reliabilityWeight}/10) og ${evB.title} (vægt ${evB.reliabilityWeight}/10): Begge spor peger samstemmende i samme retning og styrker den kronologiske årsagssammenhæng.`;
  const draftArgument = `${evA.title} dokumenterer et bærende forhold, som sammenholdt med ${evB.title} beviser en sammenhængende beviskæde om ${kwPhrase || 'hændelsesforløbet'}.`;

  return {
    evidenceA: evA,
    evidenceB: evB,
    kind: 'corroboration',
    title: `Beviskæde: ${evA.title} + ${evB.title}`,
    summary,
    draftArgument,
    combinedStrength,
    recommendedPhase: 'Bevisførelse',
  };
}

export function determineVerdictWinner(
  prosecutionCoherence: number,
  defenseCoherence: number,
  audienceVotesPros = 0,
  audienceVotesDef = 0
): {
  winner: 'Anklager' | 'Forsvarer';
  juryVotesProsecution: number;
  juryVotesDefense: number;
} {
  // Audience ("Folket") can nudge very close ties slightly, never override clear logic
  const audienceNudge =
    audienceVotesPros + audienceVotesDef > 0
      ? ((audienceVotesPros - audienceVotesDef) /
          (audienceVotesPros + audienceVotesDef)) *
        4
      : 0;

  const adjustedPros = prosecutionCoherence + audienceNudge;
  // Burden of proof: prosecution must overcome reasonable doubt (>= defense)
  const winner: 'Anklager' | 'Forsvarer' =
    adjustedPros > defenseCoherence + 2 ? 'Anklager' : 'Forsvarer';

  const diff = adjustedPros - defenseCoherence;
  const clamped = Math.max(-1, Math.min(1, diff / 25));
  const juryVotesProsecution = Math.max(0, Math.min(6, Math.round(3 + clamped * 3)));
  const juryVotesDefense = 6 - juryVotesProsecution;

  return {
    winner,
    juryVotesProsecution,
    juryVotesDefense,
  };
}

export function purchaseShopItem(
  profile: PlayerProfile,
  item: ShopItem
): { success: boolean; profile: PlayerProfile; reason?: string } {
  if (profile.unlockedItemIds.includes(item.id)) {
    return {
      success: true,
      profile: {
        ...profile,
        equipped: {
          ...profile.equipped,
          [item.category]: item.id,
        },
      },
    };
  }

  if (profile.credits < item.price) {
    return {
      success: false,
      profile,
      reason: `Du mangler ${item.price - profile.credits} credits.`,
    };
  }

  return {
    success: true,
    profile: {
      ...profile,
      credits: profile.credits - item.price,
      unlockedItemIds: [...profile.unlockedItemIds, item.id],
      equipped: {
        ...profile.equipped,
        [item.category]: item.id,
      },
    },
  };
}

export function calculateCreditReward(
  baseCredits: number,
  playerWon: boolean,
  coherenceScore: number,
  isTutorial = false
): number {
  if (isTutorial) return Math.round(baseCredits);
  const winMultiplier = playerWon ? 1 : 0.35;
  const coherenceBonus = coherenceScore >= 75 ? 40 : coherenceScore >= 60 ? 20 : 0;
  return Math.max(25, Math.round(baseCredits * winMultiplier + coherenceBonus));
}
