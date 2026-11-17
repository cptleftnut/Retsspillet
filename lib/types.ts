export type CourtRole =
  | 'Anklager'
  | 'Forsvarer'
  | 'Tiltalte'
  | 'Vidne'
  | 'Dommer'
  | 'Folket';

export type PlayableRole = 'Anklager' | 'Forsvarer' | 'Tiltalte' | 'Vidne' | 'Dommer';

export type TrialPhase =
  | 'opening'
  | 'evidence'
  | 'cross_exam'
  | 'closing'
  | 'jury'
  | 'verdict';

export type LearningLevel = 'Begynder' | 'Øvet' | 'Dommer';

export type EvidenceType =
  | 'video'
  | 'witness'
  | 'document'
  | 'physical'
  | 'digital';

export interface EvidenceItem {
  id: string;
  title: string;
  type: EvidenceType;
  summary: string;
  detail: string;
  /** 1-10 reliability weight (primary physical/video > corroborated > hearsay) */
  reliabilityWeight: number;
  /** Which side this evidence primarily supports */
  supports: 'prosecution' | 'defense' | 'neutral';
  /** Keywords that indicate logical grounding when referenced in an argument */
  keywords: string[];
  /** Optional contradiction this evidence exposes if paired with a claim */
  contradictionHint?: string;
  /** True if the exhibit is irrelevant fluff/red herring that hurts coherence if spammed */
  isIrrelevant?: boolean;
}

export interface CaseWitness {
  id: string;
  name: string;
  roleTitle: string;
  statement: string;
  weakness: string;
  supports: 'prosecution' | 'defense' | 'neutral';
}

export interface LegalCase {
  id: string;
  caseNumber: string;
  title: string;
  category: string;
  difficulty: LearningLevel;
  source: 'Indbygget' | 'Domsdatabasen.dk' | 'Egen sag' | 'Google Drive';
  isTutorial?: boolean;
  summary: string;
  charge: string;
  prosecutionGoal: string;
  defenseGoal: string;
  defendantName: string;
  evidence: EvidenceItem[];
  witnesses: CaseWitness[];
  /** Key logical points the judge/jury look for */
  coreIssues: string[];
  rewardCredits: number;
  externalUrl?: string;
}

export interface ArgumentEvaluation {
  /** 0-100 overall score for this submission */
  turnScore: number;
  /** Logical coherence component (0-50) */
  coherenceScore: number;
  /** Evidence relevance & primary-weight component (0-35) */
  evidenceWeightScore: number;
  /** Bonus for exposing contradictions or directly answering opponent (0-15) */
  rebuttalScore: number;
  /** Penalty applied for spam, repetition, or irrelevant evidence */
  penalty: number;
  /** Side momentum delta: positive favors Prosecution, negative favors Defense */
  momentumDelta: number;
  /** Concise Danish judicial assessment of the argument */
  feedback: string;
  /** Whether the judge warns against irrelevance or repetition */
  judicialWarning?: string;
}

export type CounselGestureType =
  | 'idle'
  | 'read_papers'
  | 'skeptical'
  | 'note_points'
  | 'objection_point';

export interface LiveJuryPersuasion {
  prosecutionPct: number;
  defensePct: number;
  juryVotesProsecution: number;
  juryVotesDefense: number;
  prosecutionCoherence: number;
  defenseCoherence: number;
  momentum: number;
  leadingSide: 'Anklager' | 'Forsvarer' | 'Lige';
  recentSwingDelta: number;
  evidenceMomentumNote: string;
}

export interface AiCharacterProfile {
  id: string;
  name: string;
  title: string;
  category: 'counsel' | 'jury';
  roleBadge: string;
  seatLabel: string;
  portraitSrc: string;
  backstory: string;
  rhetoricStyle: string;
  persuasionTrigger: string;
  weakness: string;
}

export interface LogicRadarAxis {
  key: 'coherence' | 'evidence' | 'rebuttal' | 'relevance' | 'coverage';
  label: string;
  playerScore: number; // 0-100
  evidenceBenchmark: number; // 0-100
}

export interface LogicRadarMetrics {
  axes: LogicRadarAxis[];
  overallStrength: number;
  collectedEvidenceAvgReliability: number; // 0-100
  strongPoints: string[];
  weakPoints: string[];
}

export interface PhaseEvidenceRecommendation {
  evidence: EvidenceItem;
  reason: string;
  isCollected: boolean;
}

export type CaseLogCategory = 'ruling' | 'objection' | 'warning' | 'contradiction';

export interface CaseLogItem {
  id: string;
  transcriptId: string;
  category: CaseLogCategory;
  categoryLabel: string;
  speakerRole: CourtRole;
  speakerName: string;
  phase: TrialPhase;
  timestamp: string;
  text: string;
  detailNote?: string;
  penalty?: number;
  turnScore?: number;
  citedEvidenceIds: string[];
}

export interface EvidenceCombinationResult {
  evidenceA: EvidenceItem;
  evidenceB: EvidenceItem;
  kind: 'contradiction' | 'corroboration' | 'warning';
  title: string;
  summary: string;
  draftArgument: string;
  combinedStrength: number;
  recommendedPhase: 'Krydsforhør' | 'Bevisførelse';
}

export interface TranscriptEntry {
  id: string;
  speakerRole: CourtRole;
  speakerName: string;
  phase: TrialPhase;
  text: string;
  citedEvidenceIds: string[];
  evaluation?: ArgumentEvaluation;
  isObjection?: boolean;
  isContradiction?: boolean;
  gesture?: CounselGestureType;
  timestamp: string;
}

export interface VerdictResult {
  winner: 'Anklager' | 'Forsvarer';
  playerWon: boolean;
  juryVotesProsecution: number;
  juryVotesDefense: number;
  prosecutionCoherence: number;
  defenseCoherence: number;
  judgeReasoning: string;
  juryReasoning: string;
  creditsAwarded: number;
  strengths: string[];
  improvements: string[];
}

export interface SavedCaseRecord {
  id: string;
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  playerRole: PlayableRole;
  winner: 'Anklager' | 'Forsvarer';
  playerWon: boolean;
  coherenceScore: number;
  creditsEarned: number;
  playedAt: string;
  judgeSummary: string;
}

export type ShopCategory = 'hat' | 'outfit' | 'color' | 'animation' | 'courtroom';

export interface ShopItem {
  id: string;
  name: string;
  category: ShopCategory;
  price: number;
  description: string;
  previewHex?: string;
  value: string;
}

export interface EquippedCosmetics {
  hat: string;
  outfit: string;
  color: string;
  animation: string;
  courtroom: string;
}

export interface PreparedWallet {
  status: 'unlinked' | 'prepared';
  network: 'ethereum-sepolia-ready';
  address: string | null;
  pendingCreditsBridge: number;
}

export type VoiceProfileId = 'Charon' | 'Fenrir' | 'Kore' | 'Puck' | 'Zephyr';

export type TtsEngine = 'browser' | 'gemini';

export type TutorialRolePath = 'Anklager' | 'Forsvarer' | 'Dommer';

export interface TutorialSimulationOption {
  label: string;
  isBest: boolean;
  feedback: string;
}

export interface RoleTutorialStepDef {
  stepNumber: number;
  rolePath: TutorialRolePath;
  title: string;
  objective: string;
  strategyTip: string;
  hint: string;
  requiredAction:
    | 'ack'
    | 'read_case'
    | 'inspect_evidence'
    | 'submit_argument'
    | 'cross_exam'
    | 'judge_control'
    | 'rest_case'
    | 'judge_verdict';
  levelFocus: LearningLevel;
  simulation: {
    prompt: string;
    options: TutorialSimulationOption[];
  };
}

export interface PlayerProfile {
  displayName: string;
  credits: number;
  preferredRole: PlayableRole;
  tutorialCompleted: boolean;
  tutorialHighestStep: number;
  completedLevels: LearningLevel[];
  judgeIntroCompleted: boolean;
  unlockedItemIds: string[];
  equipped: EquippedCosmetics;
  wallet: PreparedWallet;
  history: SavedCaseRecord[];
  ttsEnabled: boolean;
  ttsRate: number;
  ttsEngine: TtsEngine;
  judgeVoiceProfile: VoiceProfileId;
  counselVoiceProfile: VoiceProfileId;
  soundMuted: boolean;
}

export interface LegalTerm {
  id: string;
  term: string;
  category: 'Procesret' | 'Bevisret' | 'Strafferet' | 'Roller';
  shortDefinition: string;
  courtroomExample: string;
}

export interface JudgeIntroModule {
  id: number;
  title: string;
  subtitle: string;
  body: string;
  keyPrinciple: string;
  interactiveCheck: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

export interface MultiplayerState {
  active: boolean;
  roomCode: string;
  isHost: boolean;
  humanJudge: boolean;
  audienceVotesProsecution: number;
  audienceVotesDefense: number;
  userAudienceVote: 'Anklager' | 'Forsvarer' | null;
  participants: { name: string; role: CourtRole; isHuman: boolean }[];
}
