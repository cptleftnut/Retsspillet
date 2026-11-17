import type {
  LearningLevel,
  LegalCase,
  PlayableRole,
  PlayerProfile,
  SavedCaseRecord,
  TranscriptEntry,
  TrialPhase,
  TutorialRolePath,
} from './types';

const PROFILE_KEY = 'retsspillet_profile_v1';
const CUSTOM_CASES_KEY = 'retsspillet_custom_cases_v1';
const SESSION_AUTOSAVE_KEY = 'retsspillet_session_autosave_v1';

export interface TrialSessionSnapshot {
  caseId: string;
  activeCaseData?: LegalCase;
  playerRole: PlayableRole;
  phase: TrialPhase;
  transcript: TranscriptEntry[];
  selectedEvidenceIds: string[];
  tutorialStep: number;
  tutorialActive: boolean;
  tutorialRolePath: TutorialRolePath;
  activeLevel: LearningLevel;
  isCrossExam: boolean;
  wasPlaying: boolean;
  savedAt: string;
  moodOverride?: 'auto' | 'warm' | 'neutral' | 'tense';
}

export function createDefaultProfile(): PlayerProfile {
  return {
    displayName: 'Advokat',
    credits: 150,
    preferredRole: 'Anklager',
    tutorialCompleted: false,
    tutorialHighestStep: 1,
    completedLevels: [],
    judgeIntroCompleted: false,
    unlockedItemIds: [
      'hat-none',
      'outfit-classic',
      'color-burgundy',
      'anim-gavel',
      'court-oak',
    ],
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
    ttsRate: 1.0,
    ttsEngine: 'browser',
    judgeVoiceProfile: 'Charon',
    counselVoiceProfile: 'Kore',
    soundMuted: false,
  };
}

export function loadProfile(): PlayerProfile {
  if (typeof window === 'undefined') return createDefaultProfile();
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return createDefaultProfile();
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    const def = createDefaultProfile();
    return {
      ...def,
      ...parsed,
      equipped: { ...def.equipped, ...(parsed.equipped ?? {}) },
      wallet: { ...def.wallet, ...(parsed.wallet ?? {}) },
      unlockedItemIds: Array.isArray(parsed.unlockedItemIds)
        ? Array.from(new Set([...def.unlockedItemIds, ...parsed.unlockedItemIds]))
        : def.unlockedItemIds,
      completedLevels: Array.isArray(parsed.completedLevels) ? parsed.completedLevels : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return createDefaultProfile();
  }
}

export function saveProfile(profile: PlayerProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function saveTrialSession(snapshot: TrialSessionSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SESSION_AUTOSAVE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function loadTrialSession(): TrialSessionSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TrialSessionSnapshot>;
    if (!parsed || typeof parsed.caseId !== 'string' || !Array.isArray(parsed.transcript)) {
      return null;
    }
    return parsed as TrialSessionSnapshot;
  } catch {
    return null;
  }
}

export function clearTrialSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SESSION_AUTOSAVE_KEY);
  } catch {
    // Ignore
  }
}

export function appendCaseHistory(
  profile: PlayerProfile,
  record: SavedCaseRecord
): PlayerProfile {
  const next: PlayerProfile = {
    ...profile,
    history: [record, ...profile.history].slice(0, 30),
  };
  saveProfile(next);
  return next;
}

export function loadCustomCases(): LegalCase[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_CASES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LegalCase[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomCase(newCase: LegalCase): LegalCase[] {
  const existing = loadCustomCases().filter((c) => c.id !== newCase.id);
  const next = [newCase, ...existing];
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CUSTOM_CASES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function deleteCustomCase(caseId: string): LegalCase[] {
  const next = loadCustomCases().filter((c) => c.id !== caseId);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CUSTOM_CASES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}
