'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BUILT_IN_CASES,
  ROLE_TUTORIAL_PATHS,
} from '@/lib/gameData';
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
  getGestureDanishLabel,
  getPhaseRelevantEvidence,
  mapPlayableRoleToTutorialPath,
  roleSide,
} from '@/lib/scoring';
import {
  Mic,
  MicOff,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  X,
  Link2,
  ScrollText,
  Sliders,
  Sun,
  Moon,
  Sparkles,
} from 'lucide-react';
import {
  appendCaseHistory,
  clearTrialSession,
  createDefaultProfile,
  deleteCustomCase,
  loadCustomCases,
  loadProfile,
  loadTrialSession,
  saveCustomCase,
  saveProfile,
  saveTrialSession,
  type TrialSessionSnapshot,
} from '@/lib/storage';
import {
  isLiveDictationSupported,
  playSoundEffect,
  setAudioMuted,
  speakWithCourtProfile,
  startLiveDictation,
  stopSpeaking,
  type SpeechRecognitionHandle,
} from '@/lib/audio';
import { extractCaseTimeline } from '@/lib/timeline';
import {
  CourtroomSceneManager,
  type CameraPreset,
  type CourtMoodLevel,
} from '@/lib/three/CourtroomScene';
import type {
  CourtRole,
  EvidenceCombinationResult,
  EvidenceItem,
  LearningLevel,
  LegalCase,
  MultiplayerState,
  PhaseEvidenceRecommendation,
  PlayableRole,
  PlayerProfile,
  TranscriptEntry,
  TrialPhase,
  TutorialRolePath,
  VerdictResult,
} from '@/lib/types';
import {
  BookIconSvg,
  GavelIconSvg,
  PauseIconSvg,
  RetsspilletCrestSvg,
  SpeakerIconSvg,
} from './CourtSvgIcons';
import { JudgeIntroModal } from './JudgeIntroModal';
import { CaseImportModal } from './CaseImportModal';
import { ShopGlossaryModal } from './ShopGlossaryModal';
import { VerdictModal } from './VerdictModal';
import { AiCharacterGallery, JuryPersuasionBar } from './AiCharacterGallery';
import { LogicRadarChart } from './LogicRadarChart';

type GameShellState = 'title' | 'playing' | 'paused' | 'gameover';
type DockTab = 'procedure' | 'evidence' | 'dossier' | 'judge_crowd';

export function RetsspilletApp() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<CourtroomSceneManager | null>(null);

  const [gameState, setGameState] = useState<GameShellState>('title');
  const [profile, setProfile] = useState<PlayerProfile>(() => createDefaultProfile());
  const [customCases, setCustomCases] = useState<LegalCase[]>([]);

  // Active Trial State
  const [activeCase, setActiveCase] = useState<LegalCase>(BUILT_IN_CASES[0]);
  const [playerRole, setPlayerRole] = useState<PlayableRole>('Anklager');
  const [phase, setPhase] = useState<TrialPhase>('opening');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [inspectedEvidence, setInspectedEvidence] = useState<EvidenceItem | null>(null);
  const [argumentInput, setArgumentInput] = useState('');
  const [interimSpeech, setInterimSpeech] = useState('');
  const [isCrossExam, setIsCrossExam] = useState(false);
  const [isAiBusy, setIsAiBusy] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<VerdictResult | null>(null);

  // Tutorial & Learning Levels (Tiered by Role)
  const [tutorialStep, setTutorialStep] = useState(1);
  const [tutorialActive, setTutorialActive] = useState(true);
  const [tutorialRolePath, setTutorialRolePath] = useState<TutorialRolePath>('Anklager');
  const [simFeedback, setSimFeedback] = useState<{
    passed: boolean;
    text: string;
    selectedIdx: number;
  } | null>(null);
  const [showSimBox, setShowSimBox] = useState(true);
  const [activeLevel, setActiveLevel] = useState<LearningLevel>('Begynder');

  // HUD & Dock controls
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [dockTab, setDockTab] = useState<DockTab>('procedure');
  const [dossierSubTab, setDossierSubTab] = useState<'overview' | 'timeline' | 'caselog'>(
    'overview'
  );
  const [caseLogFilter, setCaseLogFilter] = useState<'all' | 'ruling' | 'objection_warning'>(
    'all'
  );
  const [judgeCrowdSubTab, setJudgeCrowdSubTab] = useState<'controls' | 'radar' | 'gallery'>(
    'controls'
  );
  // Manual Mood Override for 3D Courtroom Lighting ('auto' | 'warm' | 'neutral' | 'tense')
  const [moodOverride, setMoodOverride] = useState<'auto' | CourtMoodLevel>('auto');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'collected'>('all');
  const [showTranscriptDrawer, setShowTranscriptDrawer] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');

  // Evidence Combination (Bevis-kombination af 2 bilag)
  const [combineSelectionIds, setCombineSelectionIds] = useState<string[]>([]);
  const [combinationResult, setCombinationResult] =
    useState<EvidenceCombinationResult | null>(null);

  // Subtle Dossier Toast Notification for newly relevant / newly available exhibits
  const [dossierToast, setDossierToast] = useState<{
    id: string;
    title: string;
    evidenceId: string;
    evidenceTitle: string;
    reason: string;
  } | null>(null);
  const dossierToastTimerRef = useRef<number | null>(null);

  // Autosave tracking
  const [lastAutosavedAt, setLastAutosavedAt] = useState<string | null>(null);
  const [savedSessionAvailable, setSavedSessionAvailable] =
    useState<TrialSessionSnapshot | null>(null);

  // Modals
  const [judgeIntroOpen, setJudgeIntroOpen] = useState(false);
  const [caseImportOpen, setCaseImportOpen] = useState(false);
  const [caseImportInitialTab, setCaseImportInitialTab] = useState<
    'library' | 'domsdatabasen' | 'editor' | 'drive' | 'history'
  >('library');
  const [shopGlossaryOpen, setShopGlossaryOpen] = useState(false);
  const [shopGlossaryTab, setShopGlossaryTab] = useState<'shop' | 'glossary' | 'settings'>(
    'shop'
  );

  // Full-Duplex Live Voice (replaces legacy static dictation)
  const [fullDuplexActive, setFullDuplexActive] = useState(false);
  const [fullDuplexStatus, setFullDuplexStatus] = useState<
    'idle' | 'listening' | 'processing' | 'speaking'
  >('idle');
  const duplexStreamRef = useRef<MediaStream | null>(null);
  const duplexRecorderRef = useRef<MediaRecorder | null>(null);
  const duplexDictationRef = useRef<SpeechRecognitionHandle | null>(null);
  const duplexAudioCtxRef = useRef<AudioContext | null>(null);
  const duplexRafRef = useRef<number | null>(null);
  const duplexActiveRef = useRef(false);
  const duplexBusyRef = useRef(false);

  // Multiplayer & Folket
  const [multiplayer, setMultiplayer] = useState<MultiplayerState>({
    active: false,
    roomCode: 'RET-402',
    isHost: true,
    humanJudge: false,
    audienceVotesProsecution: 3,
    audienceVotesDefense: 2,
    userAudienceVote: null,
    participants: [
      { name: 'Dig', role: 'Anklager', isHuman: true },
      { name: 'AI-Forsvarer', role: 'Forsvarer', isHuman: false },
      { name: 'AI-Dommer', role: 'Dommer', isHuman: false },
    ],
  });

  // Load persisted profile, custom cases & autosaved session on client mount + check ?autostart=1
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      const loaded = loadProfile();
      const loadedCustom = loadCustomCases();
      setProfile(loaded);
      setPlayerRole(loaded.preferredRole);
      setTutorialRolePath(mapPlayableRoleToTutorialPath(loaded.preferredRole));
      setAudioMuted(loaded.soundMuted);
      setCustomCases(loadedCustom);
      setTutorialActive(!loaded.tutorialCompleted);

      const savedSession = loadTrialSession();
      const autostart =
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('autostart') === '1';

      const hasProgress =
        savedSession &&
        savedSession.phase !== 'verdict' &&
        (savedSession.transcript.length > 0 ||
          (savedSession.selectedEvidenceIds?.length ?? 0) > 0 ||
          savedSession.phase !== 'opening');

      if (hasProgress && savedSession) {
        const matchedCase =
          BUILT_IN_CASES.find((c) => c.id === savedSession.caseId) ??
          loadedCustom.find((c) => c.id === savedSession.caseId) ??
          savedSession.activeCaseData;

        if (savedSession.wasPlaying && matchedCase && !autostart) {
          setActiveCase(matchedCase);
          setPlayerRole(savedSession.playerRole);
          setPhase(savedSession.phase);
          setTranscript(savedSession.transcript);
          setSelectedEvidenceIds(savedSession.selectedEvidenceIds ?? []);
          setInspectedEvidence(matchedCase.evidence[0] ?? null);
          setTutorialStep(savedSession.tutorialStep || 1);
          setTutorialActive(Boolean(savedSession.tutorialActive));
          setTutorialRolePath(savedSession.tutorialRolePath || 'Anklager');
          setActiveLevel(savedSession.activeLevel || 'Begynder');
          setIsCrossExam(Boolean(savedSession.isCrossExam));
          if (savedSession.moodOverride) {
            setMoodOverride(savedSession.moodOverride);
          }
          setLastAutosavedAt(
            new Date(savedSession.savedAt).toLocaleTimeString('da-DK', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          );
          setGameState('playing');
          return;
        }
        setSavedSessionAvailable(savedSession);
      }

      if (autostart) {
        setGameState('playing');
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Sync gameState to document.body.dataset.state
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.dataset.state = gameState;
    }
  }, [gameState]);

  const updateProfile = useCallback((next: PlayerProfile) => {
    setProfile(next);
    saveProfile(next);
    setAudioMuted(next.soundMuted);
    setLastAutosavedAt(
      new Date().toLocaleTimeString('da-DK', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
  }, []);

  // Keep latest state ref for 30s + phase-change autosave
  const autosaveStateRef = useRef({
    profile,
    activeCase,
    playerRole,
    phase,
    transcript,
    selectedEvidenceIds,
    tutorialStep,
    tutorialActive,
    tutorialRolePath,
    activeLevel,
    isCrossExam,
    gameState,
    moodOverride,
  });

  useEffect(() => {
    autosaveStateRef.current = {
      profile,
      activeCase,
      playerRole,
      phase,
      transcript,
      selectedEvidenceIds,
      tutorialStep,
      tutorialActive,
      tutorialRolePath,
      activeLevel,
      isCrossExam,
      gameState,
      moodOverride,
    };
  }, [
    profile,
    activeCase,
    playerRole,
    phase,
    transcript,
    selectedEvidenceIds,
    tutorialStep,
    tutorialActive,
    tutorialRolePath,
    activeLevel,
    isCrossExam,
    gameState,
    moodOverride,
  ]);

  const performAutosave = useCallback((forcePausedTitle = false) => {
    const s = autosaveStateRef.current;
    saveProfile(s.profile);
    if (s.gameState === 'playing' || s.gameState === 'paused') {
      const nowIso = new Date().toISOString();
      saveTrialSession({
        caseId: s.activeCase.id,
        activeCaseData: s.activeCase.source !== 'Indbygget' ? s.activeCase : undefined,
        playerRole: s.playerRole,
        phase: s.phase,
        transcript: s.transcript,
        selectedEvidenceIds: s.selectedEvidenceIds,
        tutorialStep: s.tutorialStep,
        tutorialActive: s.tutorialActive,
        tutorialRolePath: s.tutorialRolePath,
        activeLevel: s.activeLevel,
        isCrossExam: s.isCrossExam,
        wasPlaying: !forcePausedTitle && s.phase !== 'verdict',
        savedAt: nowIso,
        moodOverride: s.moodOverride,
      });
    } else if (s.gameState === 'gameover') {
      clearTrialSession();
    }
    setLastAutosavedAt(
      new Date().toLocaleTimeString('da-DK', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
  }, []);

  // Periodic 30-second autosave + beforeunload safeguard
  useEffect(() => {
    const timer = window.setInterval(() => {
      performAutosave();
    }, 30_000);
    const onBeforeUnload = () => {
      performAutosave();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [performAutosave]);

  // Immediate autosave on phase transitions or trial state transitions
  useEffect(() => {
    if (gameState === 'playing' || gameState === 'paused' || gameState === 'gameover') {
      const id = window.setTimeout(() => {
        performAutosave();
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [phase, gameState, performAutosave]);

  // Ref for 3D exhibit clicks so WebGL never re-mounts
  const handleSelect3DEvidenceRef = useRef<(id: string) => void>(() => {});
  useEffect(() => {
    handleSelect3DEvidenceRef.current = (evidenceId: string) => {
      const found = activeCase.evidence.find((e) => e.id === evidenceId);
      if (!found) return;
      playSoundEffect('paper');
      setInspectedEvidence(found);
      setSelectedEvidenceIds((prev) =>
        prev.includes(evidenceId) ? prev : [...prev.slice(-2), evidenceId]
      );
      setDockTab('evidence');
      setDockCollapsed(false);
      sceneRef.current?.highlightEvidence(evidenceId);
      if (tutorialActive && tutorialStep === 3) {
        setTutorialStep(4);
        setSimFeedback(null);
      }
    };
  }, [activeCase.evidence, tutorialActive, tutorialStep]);

  // Mount Three.js Courtroom Scene ONCE
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const manager = new CourtroomSceneManager(mountEl, {
      onSelectEvidence: (id) => handleSelect3DEvidenceRef.current(id),
    });
    sceneRef.current = manager;

    return () => {
      manager.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Sync 3D scene evidence, cosmetics, and camera preset when state changes
  useEffect(() => {
    sceneRef.current?.setEvidenceItems(activeCase.evidence);
  }, [activeCase]);

  useEffect(() => {
    sceneRef.current?.applyCosmetics(playerRole, profile.equipped);
  }, [playerRole, profile.equipped]);

  useEffect(() => {
    if (gameState === 'title') {
      sceneRef.current?.setCameraPreset('title');
    } else {
      sceneRef.current?.setCameraPreset(cameraPreset);
    }
  }, [gameState, cameraPreset]);

  const pushTranscript = useCallback(
    (entry: Omit<TranscriptEntry, 'id' | 'timestamp'>, speakNow = true) => {
      const full: TranscriptEntry = {
        ...entry,
        id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleTimeString('da-DK', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setTranscript((prev) => [...prev, full]);
      sceneRef.current?.setActiveSpeaker(full.speakerRole);

      if (speakNow && profile.ttsEnabled && !profile.soundMuted) {
        speakWithCourtProfile(
          full.text,
          full.speakerRole,
          {
            rate: profile.ttsRate,
            ttsEngine: profile.ttsEngine,
            judgeVoiceProfile: profile.judgeVoiceProfile,
            counselVoiceProfile: profile.counselVoiceProfile,
          },
          {
            onStart: () => {
              if (duplexActiveRef.current) setFullDuplexStatus('speaking');
            },
            onEnd: () => {
              sceneRef.current?.setActiveSpeaker(null);
              if (duplexActiveRef.current) setFullDuplexStatus('listening');
            },
          }
        );
      }
      return full;
    },
    [
      profile.ttsEnabled,
      profile.soundMuted,
      profile.ttsRate,
      profile.ttsEngine,
      profile.judgeVoiceProfile,
      profile.counselVoiceProfile,
    ]
  );

  const showDossierHighlightToast = useCallback(
    (title: string, rec?: PhaseEvidenceRecommendation | null) => {
      if (!rec) return;
      if (dossierToastTimerRef.current !== null) {
        window.clearTimeout(dossierToastTimerRef.current);
      }
      setDossierToast({
        id: `toast-${Date.now()}`,
        title,
        evidenceId: rec.evidence.id,
        evidenceTitle: rec.evidence.title,
        reason: rec.reason,
      });
      dossierToastTimerRef.current = window.setTimeout(() => {
        setDossierToast(null);
        dossierToastTimerRef.current = null;
      }, 9000);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (dossierToastTimerRef.current !== null) {
        window.clearTimeout(dossierToastTimerRef.current);
      }
    };
  }, []);

  const beginTrial = useCallback(
    (
      legalCase: LegalCase,
      role: PlayableRole,
      mpOpts?: { active: boolean; roomCode: string; humanJudge: boolean }
    ) => {
      stopSpeaking();
      setActiveCase(legalCase);
      setPlayerRole(role);
      setTutorialRolePath(mapPlayableRoleToTutorialPath(role));
      setSimFeedback(null);
      setPhase('evidence');
      setSelectedEvidenceIds([]);
      setCombineSelectionIds([]);
      setCombinationResult(null);
      setInspectedEvidence(legalCase.evidence[0] ?? null);
      setArgumentInput('');
      setApiError(null);
      setVerdict(null);
      setIsCrossExam(false);
      setDockCollapsed(false);
      setDockTab('procedure');
      setCaseImportOpen(false);
      setJudgeIntroOpen(false);

      if (legalCase.isTutorial) {
        setTutorialActive(true);
        setTutorialStep(1);
        setShowSimBox(true);
      } else {
        setTutorialActive(false);
      }

      if (mpOpts) {
        setMultiplayer((prev) => ({
          ...prev,
          active: mpOpts.active,
          roomCode: mpOpts.roomCode,
          humanJudge: mpOpts.humanJudge,
        }));
      }

      const openingEntry: TranscriptEntry = {
        id: `open-${Date.now()}`,
        speakerRole: 'Dommer',
        speakerName: 'Præsiderende Dommer',
        phase: 'opening',
        text: `Retten er sat i sag ${legalCase.caseNumber}: "${legalCase.title}". ${legalCase.charge} Parterne bedes fremføre deres argumenter med støtte i sagens bilag.`,
        citedEvidenceIds: [],
        timestamp: new Date().toLocaleTimeString('da-DK', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setTranscript([openingEntry]);
      setGameState('playing');
      setCameraPreset('overview');
      sceneRef.current?.triggerGavelSlam();
      playSoundEffect('gavel');

      const topRec = getPhaseRelevantEvidence(legalCase, 'evidence', false, [], [openingEntry])[0];
      showDossierHighlightToast('Nøglebilag klar i Dossier', topRec);

      if (profile.ttsEnabled && !profile.soundMuted) {
        speakWithCourtProfile(openingEntry.text, 'Dommer', {
          rate: profile.ttsRate,
          ttsEngine: profile.ttsEngine,
          judgeVoiceProfile: profile.judgeVoiceProfile,
          counselVoiceProfile: profile.counselVoiceProfile,
        });
      }
    },
    [
      profile.ttsEnabled,
      profile.soundMuted,
      profile.ttsRate,
      profile.ttsEngine,
      profile.judgeVoiceProfile,
      profile.counselVoiceProfile,
      showDossierHighlightToast,
    ]
  );

  const handleStartFromTitle = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const startCase = !profile.tutorialCompleted
      ? BUILT_IN_CASES[0]
      : BUILT_IN_CASES[0];
    beginTrial(startCase, profile.preferredRole);
  }, [beginTrial, profile.preferredRole, profile.tutorialCompleted]);

  // Global keyboard shortcuts (Enter/Space on Title, Esc/P Pause, M Mute, H Toggle Dock)
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT';

      if (gameState === 'title' && (ev.key === 'Enter' || ev.key === ' ')) {
        ev.preventDefault();
        handleStartFromTitle();
        return;
      }

      if (isTyping) return;

      if (ev.key === 'Escape' || ev.key.toLowerCase() === 'p') {
        if (judgeIntroOpen || caseImportOpen || shopGlossaryOpen) {
          setJudgeIntroOpen(false);
          setCaseImportOpen(false);
          setShopGlossaryOpen(false);
          return;
        }
        if (gameState === 'playing') {
          stopSpeaking();
          setGameState('paused');
        } else if (gameState === 'paused') {
          setGameState('playing');
        }
      } else if (ev.key.toLowerCase() === 'm') {
        const nextMuted = !profile.soundMuted;
        updateProfile({ ...profile, soundMuted: nextMuted });
      } else if (ev.key.toLowerCase() === 'h' && gameState === 'playing') {
        setDockCollapsed((c) => !c);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    gameState,
    judgeIntroOpen,
    caseImportOpen,
    shopGlossaryOpen,
    handleStartFromTitle,
    profile,
    updateProfile,
  ]);

  // BroadcastChannel multiplayer sync
  useEffect(() => {
    if (!multiplayer.active || typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(`retsspillet_${multiplayer.roomCode}`);
    ch.onmessage = (ev) => {
      const msg = ev.data as { type: string; payload?: unknown };
      if (msg.type === 'audience_vote') {
        const side = msg.payload as 'Anklager' | 'Forsvarer';
        setMultiplayer((prev) => ({
          ...prev,
          audienceVotesProsecution:
            prev.audienceVotesProsecution + (side === 'Anklager' ? 1 : 0),
          audienceVotesDefense:
            prev.audienceVotesDefense + (side === 'Forsvarer' ? 1 : 0),
        }));
      }
    };
    return () => ch.close();
  }, [multiplayer.active, multiplayer.roomCode]);

  const totals = useMemo(() => computeTrialTotals(transcript), [transcript]);

  const handleToggleEvidence = (id: string) => {
    const item = activeCase.evidence.find((e) => e.id === id) ?? null;
    setInspectedEvidence(item);
    playSoundEffect('paper');
    sceneRef.current?.highlightEvidence(id);
    setSelectedEvidenceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    if (tutorialActive && tutorialStep === 3) {
      setTutorialStep(4);
      setSimFeedback(null);
    }
  };

  const handleSubmitArgument = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleaned = argumentInput.trim();
    if (!cleaned || isAiBusy) return;

    setApiError(null);
    const evaluation = evaluateArgument({
      text: cleaned,
      role: playerRole,
      citedEvidenceIds: selectedEvidenceIds,
      legalCase: activeCase,
      priorEntries: transcript,
      isCrossExam,
    });

    const submittedEntry = pushTranscript({
      speakerRole: playerRole,
      speakerName: profile.displayName || playerRole,
      phase: isCrossExam ? 'cross_exam' : 'evidence',
      text: cleaned,
      citedEvidenceIds: selectedEvidenceIds,
      evaluation,
      isContradiction: evaluation.rebuttalScore >= 12,
    });

    setArgumentInput('');
    setInterimSpeech('');
    setCameraPreset(
      roleSide(playerRole) === 'prosecution'
        ? 'prosecution'
        : roleSide(playerRole) === 'defense'
          ? 'defense'
          : 'witness'
    );

    if (evaluation.judicialWarning) {
      sceneRef.current?.triggerGavelSlam();
      sceneRef.current?.triggerCriticalObjectionMood(4.5);
      playSoundEffect('objection');
    } else {
      playSoundEffect('click');
    }

    if (tutorialActive) {
      if (!isCrossExam && tutorialStep <= 4) {
        setTutorialStep(5);
        setSimFeedback(null);
      } else if (isCrossExam && tutorialStep <= 6) {
        setTutorialStep(7);
        setSimFeedback(null);
      }
    }

    // Trigger AI Opponent rebuttal unless player is Judge in multiplayer
    const oppRole: CourtRole =
      roleSide(playerRole) === 'prosecution' ? 'Forsvarer' : 'Anklager';

    // Immediate non-verbal opponent reaction to player's rebuttal strength
    sceneRef.current?.triggerCharacterGesture(
      oppRole,
      determineGestureFromEvaluation(evaluation, false),
      2.0
    );

    setIsAiBusy(true);
    try {
      const updatedTranscript = [...transcript, submittedEntry];
      const res = await fetch('/api/trial/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'opponent_turn',
          legalCase: activeCase,
          playerRole,
          opponentRole: oppRole,
          transcript: updatedTranscript,
          playerLastText: cleaned,
          isCrossExam,
        }),
      });

      const data = (await res.json()) as {
        reply?: string;
        citedEvidenceId?: string;
        isObjection?: boolean;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || 'AI-modpart svarede med en fejl.');
      }

      const oppEval = evaluateArgument({
        text: data.reply || '',
        role: oppRole as PlayableRole,
        citedEvidenceIds: data.citedEvidenceId ? [data.citedEvidenceId] : [],
        legalCase: activeCase,
        priorEntries: updatedTranscript,
        isCrossExam,
      });

      const oppGesture = determineGestureFromEvaluation(oppEval, Boolean(data.isObjection));
      sceneRef.current?.triggerCharacterGesture(oppRole, oppGesture, 3.4);

      if (data.isObjection) {
        sceneRef.current?.triggerGavelSlam();
        sceneRef.current?.triggerCriticalObjectionMood(4.5);
        playSoundEffect('objection');
      }

      const oppEntry = pushTranscript({
        speakerRole: oppRole,
        speakerName: `AI-${oppRole}`,
        phase: isCrossExam ? 'cross_exam' : 'evidence',
        text: data.reply || 'Modparten bestrider påstanden.',
        citedEvidenceIds: data.citedEvidenceId ? [data.citedEvidenceId] : [],
        evaluation: oppEval,
        isObjection: Boolean(data.isObjection),
        gesture: oppGesture,
      });

      const postTurnRecs = getPhaseRelevantEvidence(
        activeCase,
        isCrossExam ? 'cross_exam' : 'evidence',
        isCrossExam,
        selectedEvidenceIds,
        [...updatedTranscript, oppEntry]
      );
      const nextUncollected = postTurnRecs.find((r) => !r.isCollected);
      if (nextUncollected && (data.citedEvidenceId || data.isObjection)) {
        showDossierHighlightToast(
          data.isObjection
            ? 'Modpart rejste indsigelse — modbilag i Dossier'
            : 'Nyt modbilag relevant i Dossier',
          nextUncollected
        );
      }
    } catch (err) {
      setApiError(
        err instanceof Error
          ? err.message
          : 'Kunne ikke kontakte AI-modparten.'
      );
    } finally {
      setIsAiBusy(false);
    }
  };

  const handleRestCase = async (forcedWinner?: 'Anklager' | 'Forsvarer') => {
    if (isAiBusy) return;
    setPhase('jury');
    setCameraPreset('judge');
    setApiError(null);
    if (tutorialActive && tutorialStep < 8) {
      setTutorialStep(8);
    }

    setIsAiBusy(true);
    try {
      const res = await fetch('/api/trial/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'final_verdict',
          legalCase: activeCase,
          playerRole,
          transcript,
        }),
      });
      const aiData = (await res.json()) as {
        juryReasoning?: string;
        judgeReasoning?: string;
        strengths?: string[];
        improvements?: string[];
        error?: string;
      };

      if (!res.ok) {
        throw new Error(aiData.error || 'Kunne ikke gennemføre juryvurdering.');
      }

      const computed = computeTrialTotals(transcript);
      const outcome = determineVerdictWinner(
        computed.prosecutionAverage,
        computed.defenseAverage,
        multiplayer.audienceVotesProsecution,
        multiplayer.audienceVotesDefense
      );

      const finalWinner = forcedWinner ?? outcome.winner;
      const playerSide = roleSide(playerRole);
      const playerWon =
        playerRole === 'Dommer'
          ? true
          : (playerSide === 'prosecution' && finalWinner === 'Anklager') ||
            (playerSide === 'defense' && finalWinner === 'Forsvarer');

      const playerScore =
        playerSide === 'prosecution'
          ? computed.prosecutionAverage
          : computed.defenseAverage;

      const creditsAwarded = calculateCreditReward(
        activeCase.rewardCredits,
        playerWon,
        playerScore,
        Boolean(activeCase.isTutorial)
      );

      const result: VerdictResult = {
        winner: finalWinner,
        playerWon,
        juryVotesProsecution: outcome.juryVotesProsecution,
        juryVotesDefense: outcome.juryVotesDefense,
        prosecutionCoherence: computed.prosecutionAverage,
        defenseCoherence: computed.defenseAverage,
        juryReasoning:
          aiData.juryReasoning ||
          'Juryen har vægtet sammenhængen mellem tidslinje og primærbeviser.',
        judgeReasoning:
          aiData.judgeReasoning ||
          'Retten lægger afgørende vægt på de mest pålidelige bilag og argumentets logiske struktur.',
        creditsAwarded,
        strengths: aiData.strengths?.length
          ? aiData.strengths
          : ['Tydelig inddragelse af sagens hovedspørgsmål'],
        improvements: aiData.improvements?.length
          ? aiData.improvements
          : ['Kobl modpartens forklaring endnu skarpere til modsigende tidsstempler'],
      };

      setPhase('verdict');
      setVerdict(result);
      sceneRef.current?.triggerGavelSlam();
      playSoundEffect('verdict');
      playSoundEffect('credit');

      if (tutorialActive) {
        setTutorialStep(8);
        setSimFeedback(null);
      }

      // Save credits, history, and level progress
      const updatedProfileBase: PlayerProfile = {
        ...profile,
        credits: profile.credits + creditsAwarded,
        completedLevels: profile.completedLevels.includes(activeLevel)
          ? profile.completedLevels
          : [...profile.completedLevels, activeLevel],
      };

      const withHistory = appendCaseHistory(updatedProfileBase, {
        id: `hist-${Date.now()}`,
        caseId: activeCase.id,
        caseNumber: activeCase.caseNumber,
        caseTitle: activeCase.title,
        playerRole,
        winner: finalWinner,
        playerWon,
        coherenceScore: playerScore,
        creditsEarned: creditsAwarded,
        playedAt: new Date().toISOString(),
        judgeSummary: result.judgeReasoning,
      });
      updateProfile(withHistory);

      if (profile.ttsEnabled && !profile.soundMuted) {
        speakWithCourtProfile(
          `Domskendelse. ${finalWinner} vinder sagen. ${result.judgeReasoning}`,
          'Dommer',
          {
            rate: profile.ttsRate,
            ttsEngine: profile.ttsEngine,
            judgeVoiceProfile: profile.judgeVoiceProfile,
            counselVoiceProfile: profile.counselVoiceProfile,
          }
        );
      }

      setGameState('gameover');
    } catch (err) {
      setPhase('evidence');
      setApiError(
        err instanceof Error ? err.message : 'Fejl ved juryens vurdering.'
      );
    } finally {
      setIsAiBusy(false);
    }
  };

  // Legacy single-shot static dictation removed in favor of unified Full-Duplex Live Voice stream.

  // Stop Full-Duplex Live Voice cleanly
  const stopFullDuplex = useCallback(() => {
    duplexActiveRef.current = false;
    setFullDuplexActive(false);
    setFullDuplexStatus('idle');
    setInterimSpeech('');
    if (duplexRafRef.current !== null) {
      cancelAnimationFrame(duplexRafRef.current);
      duplexRafRef.current = null;
    }
    duplexDictationRef.current?.stop();
    duplexDictationRef.current = null;
    if (duplexRecorderRef.current && duplexRecorderRef.current.state !== 'inactive') {
      try {
        duplexRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    duplexRecorderRef.current = null;
    if (duplexStreamRef.current) {
      duplexStreamRef.current.getTracks().forEach((t) => t.stop());
      duplexStreamRef.current = null;
    }
    if (duplexAudioCtxRef.current) {
      duplexAudioCtxRef.current.close().catch(() => {});
      duplexAudioCtxRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopFullDuplex();
    };
  }, [stopFullDuplex]);

  // Process a streamed MediaRecorder audio segment against /api/trial/voice-stream
  const processVoiceStreamBlob = useCallback(
    async (blob: Blob, directTextFallback?: string) => {
      if (duplexBusyRef.current) return;
      duplexBusyRef.current = true;
      setFullDuplexStatus('processing');

      try {
        const b64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(String(reader.result || '').split(',')[1] || '');
          };
          reader.readAsDataURL(blob);
        });

        const oppRole: CourtRole =
          roleSide(playerRole) === 'prosecution' ? 'Forsvarer' : 'Anklager';

        const res = await fetch('/api/trial/voice-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: b64 || undefined,
            mimeType: blob.type || 'audio/webm',
            directText: directTextFallback || undefined,
            autoRespond: true,
            legalCase: activeCase,
            playerRole,
            opponentRole: oppRole,
            transcript: transcript.slice(-6),
            isCrossExam,
          }),
        });

        const data = (await res.json()) as {
          transcriptText?: string;
          reply?: string | null;
          citedEvidenceId?: string;
          isObjection?: boolean;
          error?: string;
        };

        if (!res.ok) {
          throw new Error(data.error || 'Stemmestream svarede med fejl.');
        }

        const spoken = (data.transcriptText || '').trim();
        if (spoken.length >= 5) {
          setArgumentInput(spoken);
          const evaluation = evaluateArgument({
            text: spoken,
            role: playerRole,
            citedEvidenceIds: selectedEvidenceIds,
            legalCase: activeCase,
            priorEntries: transcript,
            isCrossExam,
          });

          pushTranscript(
            {
              speakerRole: playerRole,
              speakerName: `${profile.displayName || playerRole} (Live Stemme)`,
              phase: isCrossExam ? 'cross_exam' : 'evidence',
              text: spoken,
              citedEvidenceIds: selectedEvidenceIds,
              evaluation,
              isContradiction: evaluation.rebuttalScore >= 12,
            },
            false
          );
          setArgumentInput('');
          setInterimSpeech('');

          if (evaluation.judicialWarning) {
            sceneRef.current?.triggerCriticalObjectionMood(4.5);
          }

          if (data.reply) {
            const oppEval = evaluateArgument({
              text: data.reply,
              role: oppRole as PlayableRole,
              citedEvidenceIds: data.citedEvidenceId ? [data.citedEvidenceId] : [],
              legalCase: activeCase,
              priorEntries: transcript,
              isCrossExam,
            });

            const oppGesture = determineGestureFromEvaluation(oppEval, Boolean(data.isObjection));
            sceneRef.current?.triggerCharacterGesture(oppRole, oppGesture, 3.4);

            if (data.isObjection) {
              sceneRef.current?.triggerGavelSlam();
              sceneRef.current?.triggerCriticalObjectionMood(4.5);
              playSoundEffect('objection');
            }

            pushTranscript(
              {
                speakerRole: oppRole,
                speakerName: `AI-${oppRole}`,
                phase: isCrossExam ? 'cross_exam' : 'evidence',
                text: data.reply,
                citedEvidenceIds: data.citedEvidenceId ? [data.citedEvidenceId] : [],
                evaluation: oppEval,
                isObjection: Boolean(data.isObjection),
                gesture: oppGesture,
              },
              true
            );
          }
        }
      } catch (err) {
        setApiError(err instanceof Error ? err.message : 'Fuld-dupleks stemmefejl.');
      } finally {
        duplexBusyRef.current = false;
        if (duplexActiveRef.current) {
          setFullDuplexStatus('listening');
        }
      }
    },
    [
      activeCase,
      isCrossExam,
      playerRole,
      profile.displayName,
      pushTranscript,
      selectedEvidenceIds,
      transcript,
    ]
  );

  // Toggle Full-Duplex Live Voice Interaction (MediaRecorder streaming + VAD barge-in + Live STT/TTS)
  const toggleFullDuplexVoice = async () => {
    if (fullDuplexActive) {
      stopFullDuplex();
      return;
    }

    setApiError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setApiError('Din browser understøtter ikke MediaRecorder til fuld-dupleks stemmestream.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      duplexStreamRef.current = stream;
      duplexActiveRef.current = true;
      setFullDuplexActive(true);
      setFullDuplexStatus('listening');

      // Web Audio AnalyserNode for Voice Activity Detection (barge-in stops ongoing AI speech)
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        duplexAudioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const monitorMicLevel = () => {
          if (!duplexActiveRef.current) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          // Barge-in: if user speaks clearly while AI is speaking, immediately duck/interrupt TTS
          if (avg > 28) {
            stopSpeaking();
          }
          duplexRafRef.current = requestAnimationFrame(monitorMicLevel);
        };
        duplexRafRef.current = requestAnimationFrame(monitorMicLevel);
      }

      // Parallel browser SpeechRecognition for zero-latency live interim text in input UI
      if (isLiveDictationSupported()) {
        duplexDictationRef.current = startLiveDictation({
          onInterim: (txt) => setInterimSpeech(txt),
          onFinal: (txt) => {
            setArgumentInput((prev) => (prev ? `${prev} ${txt}` : txt));
            setInterimSpeech('');
          },
          onError: () => {},
          onEnd: () => {},
        });
      }

      // MediaRecorder chunked streaming every 3.5 seconds to /api/trial/voice-stream
      const recorder = new MediaRecorder(stream);
      duplexRecorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (!duplexActiveRef.current || ev.data.size < 1800) return;
        void processVoiceStreamBlob(ev.data);
      };
      recorder.start(3500);
    } catch {
      stopFullDuplex();
      setApiError('Mikrofonadgang påkrævet til fuld-dupleks stemmesamtale.');
    }
  };

  const currentPathSteps = ROLE_TUTORIAL_PATHS[tutorialRolePath];
  const currentTutStep =
    currentPathSteps.find((s) => s.stepNumber === tutorialStep) ?? currentPathSteps[0];
  const lastTranscript = transcript[transcript.length - 1];
  const timelineNodes = useMemo(
    () => extractCaseTimeline(activeCase, selectedEvidenceIds, transcript),
    [activeCase, selectedEvidenceIds, transcript]
  );
  const caseLogEvents = useMemo(() => extractCaseLogEvents(transcript), [transcript]);
  const collectedTimelineCount = timelineNodes.filter(
    (n) => n.sourceKind === 'evidence' && n.isCollected
  ).length;
  const livePersuasion = useMemo(
    () =>
      computeLiveJuryPersuasion(
        transcript,
        selectedEvidenceIds,
        activeCase,
        multiplayer.audienceVotesProsecution,
        multiplayer.audienceVotesDefense
      ),
    [
      transcript,
      selectedEvidenceIds,
      activeCase,
      multiplayer.audienceVotesProsecution,
      multiplayer.audienceVotesDefense,
    ]
  );

  const logicRadar = useMemo(
    () => computeLogicRadarMetrics(transcript, selectedEvidenceIds, activeCase, playerRole),
    [transcript, selectedEvidenceIds, activeCase, playerRole]
  );

  const phaseRecommendations = useMemo(
    () =>
      getPhaseRelevantEvidence(
        activeCase,
        phase,
        isCrossExam,
        selectedEvidenceIds,
        transcript
      ),
    [activeCase, phase, isCrossExam, selectedEvidenceIds, transcript]
  );
  const uncollectedPhaseRecs = phaseRecommendations.filter((r) => !r.isCollected);
  const highlightedEvidenceIds = useMemo(
    () => new Set(phaseRecommendations.slice(0, 2).map((r) => r.evidence.id)),
    [phaseRecommendations]
  );

  const playerSide = roleSide(playerRole);
  const playerAvgCoherence =
    playerSide === 'defense' ? totals.defenseAverage : totals.prosecutionAverage;
  const juryFavorRatio =
    playerSide === 'defense'
      ? livePersuasion.defensePct / 100
      : livePersuasion.prosecutionPct / 100;
  const hasWarningOrObjection = Boolean(
    lastTranscript?.isObjection || lastTranscript?.evaluation?.judicialWarning
  );

  const dynamicCourtMood: CourtMoodLevel =
    hasWarningOrObjection ||
    (transcript.length > 1 && (playerAvgCoherence < 48 || juryFavorRatio < 0.42))
      ? 'tense'
      : juryFavorRatio >= 0.56 ||
          (transcript.length > 1 &&
            playerAvgCoherence >= 66 &&
            (phase === 'evidence' || phase === 'closing' || phase === 'verdict'))
        ? 'warm'
        : 'neutral';

  const courtMood: CourtMoodLevel =
    moodOverride !== 'auto' ? moodOverride : dynamicCourtMood;

  useEffect(() => {
    sceneRef.current?.setTrialMoodLighting({
      phase,
      juryFavorRatio,
      playerAvgCoherence,
      hasWarningOrObjection,
      manualOverride: moodOverride,
    });
  }, [phase, juryFavorRatio, playerAvgCoherence, hasWarningOrObjection, moodOverride]);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Isolated 3D WebGL Canvas Mount */}
      <div
        ref={canvasMountRef}
        data-testid="courtroom-canvas"
        data-court-mood={courtMood}
        data-mood-override={moodOverride}
        className="fixed inset-0 z-0"
      />

      {/* TITLE SCREEN OVERLAY */}
      {gameState === 'title' && (
        <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-6 sm:p-10">
          {/* Asymmetric Left-Third Editorial Lockup over calm courtroom backdrop */}
          <div className="max-w-md bg-[#F4EFE6]/95 border border-[#2A241E] rounded-[2px] p-6 pointer-events-auto">
            <div className="flex items-center gap-3.5">
              <RetsspilletCrestSvg className="w-12 h-12 shrink-0" />
              <div>
                <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#1C1917] leading-none">
                  RETSSPILLET
                </h1>
                <p className="text-xs font-mono text-[#7C2D2D] mt-1 font-semibold">
                  SAG #0001 · LOGIK &amp; BEVISVÆGT
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-[#2C2620] leading-relaxed">
              Før sager i en levende 3D-retssal. AI-juryen og dommeren belønner kun
              sammenhængende argumentation, primærbeviser og skarpe modargumenter — aldrig tom
              snak.
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                data-start="true"
                onClick={handleStartFromTitle}
                className="w-full px-5 py-3 bg-[#1C1917] hover:bg-[#312A24] text-[#F4EFE6] text-sm font-semibold border border-[#1C1917] rounded-[2px] cursor-pointer text-left flex items-center justify-between"
              >
                <span>
                  {profile.tutorialCompleted
                    ? 'Træd ind i retssalen'
                    : 'Start interaktiv prøvesag (#0001)'}
                </span>
                <span className="font-mono text-xs text-[#A87C2D]">ENTER ↵</span>
              </button>

              {savedSessionAvailable && (
                <button
                  type="button"
                  data-testid="resume-autosave-btn"
                  onClick={() => {
                    const snap = savedSessionAvailable;
                    const matchedCase =
                      BUILT_IN_CASES.find((c) => c.id === snap.caseId) ??
                      customCases.find((c) => c.id === snap.caseId) ??
                      snap.activeCaseData;
                    if (!matchedCase) return;
                    setActiveCase(matchedCase);
                    setPlayerRole(snap.playerRole);
                    setPhase(snap.phase);
                    setTranscript(snap.transcript);
                    setSelectedEvidenceIds(snap.selectedEvidenceIds ?? []);
                    setInspectedEvidence(matchedCase.evidence[0] ?? null);
                    setTutorialStep(snap.tutorialStep || 1);
                    setTutorialActive(Boolean(snap.tutorialActive));
                    setTutorialRolePath(snap.tutorialRolePath || 'Anklager');
                    setActiveLevel(snap.activeLevel || 'Begynder');
                    setIsCrossExam(Boolean(snap.isCrossExam));
                    setSavedSessionAvailable(null);
                    setGameState('playing');
                  }}
                  className="w-full px-4 py-2 bg-[#FBF8F3] hover:bg-[#EAE3D5] text-[#7C2D2D] text-xs font-semibold border border-[#7C2D2D] rounded-[2px] cursor-pointer text-left flex items-center justify-between"
                >
                  <span>Genoptag autolagret sag ({savedSessionAvailable.transcript.length} indlæg)</span>
                  <span className="font-mono text-[10px]">AUTOLAGRING</span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setJudgeIntroOpen(true)}
                  className="px-3 py-2 bg-[#EAE3D5] hover:bg-[#DFD5C2] text-[#1C1917] text-xs font-semibold border border-[#9F927E] rounded-[2px] cursor-pointer"
                >
                  Dommerintroduktion
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCaseImportInitialTab('library');
                    setCaseImportOpen(true);
                  }}
                  className="px-3 py-2 bg-[#EAE3D5] hover:bg-[#DFD5C2] text-[#1C1917] text-xs font-semibold border border-[#9F927E] rounded-[2px] cursor-pointer"
                >
                  Sagsarkiv &amp; Import
                </button>
              </div>
            </div>
          </div>

          {/* Single flat control-hint line at bottom */}
          <div className="pointer-events-none flex justify-center">
            <p className="px-3.5 py-1.5 bg-[#1C1917]/90 text-[#E5DEC9] border border-[#3D352B] rounded-[2px] text-[11px] font-mono">
              Træk mus for udsyn · Klik bilag på bordet · Enter/Space Start · Esc Pause · M Lyd
            </p>
          </div>
        </div>
      )}

      {/* PLAYING HUD OVERLAY (pointer-events: none wrapper) */}
      {gameState !== 'title' && (
        <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-4">
          {/* TOP CLUSTER: Status + Utility Controls + Optional Tutorial Coach Strip */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              {/* Top-Left Compact Courtroom Status Cluster */}
              <div className="pointer-events-auto bg-[#F4EFE6]/95 border border-[#2A241E] rounded-[2px] px-3.5 py-2 flex flex-wrap items-center gap-3 sm:gap-4">
                <div>
                  <p className="text-[10px] font-mono uppercase text-[#7C2D2D] font-semibold leading-none">
                    {activeCase.caseNumber} · {playerRole}
                  </p>
                  <p className="font-serif text-sm font-bold text-[#1C1917] mt-0.5">
                    {activeCase.title}
                  </p>
                </div>

                <div className="h-6 w-px bg-[#C8BCA8] hidden sm:block" />

                <div className="flex items-center gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[#5A4F42] block leading-none">
                      Kohærens
                    </span>
                    <span className="font-mono font-bold tabular-nums text-[#1C1917]">
                      Ank {totals.prosecutionAverage} / For {totals.defenseAverage}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[#5A4F42] block leading-none">
                      Credits
                    </span>
                    <span
                      data-testid="hud-credits"
                      className="font-mono font-bold tabular-nums text-[#7C2D2D]"
                    >
                      {profile.credits}
                    </span>
                  </div>
                  <div className="hidden sm:block pl-2 border-l border-[#C8BCA8]">
                    <span className="text-[10px] font-mono uppercase text-[#5A4F42] block leading-none">
                      Salens lys
                    </span>
                    <span
                      data-testid="hud-court-mood"
                      className={`font-mono text-[11px] font-semibold ${
                        courtMood === 'warm'
                          ? 'text-[#7D5B1E]'
                          : courtMood === 'tense'
                            ? 'text-[#1E3A5F]'
                            : 'text-[#3D352B]'
                      }`}
                    >
                      {courtMood === 'warm'
                        ? moodOverride === 'warm'
                          ? 'Varmt (Låst)'
                          : 'Varm fremdrift'
                        : courtMood === 'tense'
                          ? moodOverride === 'tense'
                            ? 'Køligt (Låst)'
                            : 'Kølig spænding'
                          : moodOverride === 'neutral'
                            ? 'Neutralt (Låst)'
                            : 'Afbalanceret'}
                    </span>
                  </div>
                  {lastAutosavedAt && (
                    <div className="hidden md:block pl-2 border-l border-[#C8BCA8]">
                      <span className="text-[10px] font-mono uppercase text-[#5A4F42] block leading-none">
                        Autolagret
                      </span>
                      <span
                        data-testid="autosave-status"
                        className="font-mono text-[11px] tabular-nums text-[#3D352B]"
                      >
                        {lastAutosavedAt}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Top-Right Compact Utility Controls */}
              <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    const presets: CameraPreset[] = [
                      'overview',
                      'judge',
                      'evidence',
                      'prosecution',
                      'defense',
                      'witness',
                    ];
                    const next = presets[(presets.indexOf(cameraPreset) + 1) % presets.length];
                    setCameraPreset(next);
                  }}
                  aria-label="Skift kameravinkel"
                  className="px-2.5 h-9 bg-[#F4EFE6]/95 hover:bg-[#EAE3D5] text-[#1C1917] border border-[#2A241E] rounded-[2px] text-[11px] font-mono cursor-pointer"
                >
                  Kamera: {cameraPreset}
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    const next = !profile.ttsEnabled;
                    if (!next) stopSpeaking();
                    updateProfile({ ...profile, ttsEnabled: next });
                  }}
                  aria-label="Skift Live TTS oplæsning"
                  title="Live TTS til/fra"
                  className={`px-2.5 h-9 border border-[#2A241E] rounded-[2px] flex items-center gap-1.5 text-[11px] font-mono cursor-pointer ${
                    profile.ttsEnabled
                      ? 'bg-[#1C1917] text-[#F4EFE6]'
                      : 'bg-[#F4EFE6]/95 text-[#5A4F42]'
                  }`}
                >
                  <SpeakerIconSvg active={profile.ttsEnabled && !profile.soundMuted} />
                  TTS
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setShopGlossaryTab('shop');
                    setShopGlossaryOpen(true);
                  }}
                  aria-label="Åbn Shop og Profil"
                  className="px-2.5 h-9 bg-[#F4EFE6]/95 hover:bg-[#EAE3D5] text-[#1C1917] border border-[#2A241E] rounded-[2px] text-[11px] font-semibold cursor-pointer"
                >
                  Shop
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setShopGlossaryTab('glossary');
                    setShopGlossaryOpen(true);
                  }}
                  aria-label="Åbn Juridisk Leksikon"
                  className="w-9 h-9 bg-[#F4EFE6]/95 hover:bg-[#EAE3D5] text-[#1C1917] border border-[#2A241E] rounded-[2px] flex items-center justify-center cursor-pointer"
                >
                  <BookIconSvg />
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setCaseImportInitialTab('library');
                    setCaseImportOpen(true);
                  }}
                  aria-label="Åbn Sagsarkiv"
                  className="px-2.5 h-9 bg-[#F4EFE6]/95 hover:bg-[#EAE3D5] text-[#1C1917] border border-[#2A241E] rounded-[2px] text-[11px] font-semibold cursor-pointer"
                >
                  Sager
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    stopSpeaking();
                    setGameState('paused');
                  }}
                  aria-label="Pause menu"
                  className="w-9 h-9 bg-[#1C1917] hover:bg-[#312A24] text-[#F4EFE6] border border-[#2A241E] rounded-[2px] flex items-center justify-center cursor-pointer"
                >
                  <PauseIconSvg />
                </button>
              </div>
            </div>

            {/* SUBTLE ARCHIVAL DOSSIER EVIDENCE TOAST */}
            {dossierToast && gameState === 'playing' && (
              <div className="flex justify-end pointer-events-none">
                <div
                  data-testid="dossier-evidence-toast"
                  role="status"
                  className="pointer-events-auto max-w-sm bg-[#FBF8F3]/96 border border-[#2A241E] border-l-4 border-l-[#7C2D2D] rounded-[2px] px-3 py-2 flex items-start gap-2.5 text-xs"
                >
                  <FileText className="w-4 h-4 text-[#7C2D2D] shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] uppercase font-bold text-[#7C2D2D]">
                      {dossierToast.title}
                    </p>
                    <p className="font-serif font-bold text-xs text-[#1C1917] truncate">
                      {dossierToast.evidenceTitle}
                    </p>
                    <p className="text-[11px] text-[#3D352B] mt-0.5 line-clamp-2">
                      {dossierToast.reason}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        type="button"
                        data-testid="toast-open-dossier-btn"
                        onClick={() => {
                          const targetEv =
                            activeCase.evidence.find((e) => e.id === dossierToast.evidenceId) ??
                            null;
                          if (targetEv) {
                            setInspectedEvidence(targetEv);
                            sceneRef.current?.highlightEvidence(targetEv.id);
                          }
                          setDockCollapsed(false);
                          setDockTab('dossier');
                          setDossierSubTab('overview');
                          setDossierToast(null);
                        }}
                        className="px-2 py-0.5 text-[10px] font-semibold bg-[#1C1917] text-[#F4EFE6] rounded-[2px] cursor-pointer"
                      >
                        Åbn i Dossier
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedEvidenceIds.includes(dossierToast.evidenceId)) {
                            handleToggleEvidence(dossierToast.evidenceId);
                          }
                          setDossierToast(null);
                        }}
                        className="px-2 py-0.5 text-[10px] font-semibold bg-[#EAE3D5] text-[#1C1917] border border-[#9F927E] rounded-[2px] cursor-pointer"
                      >
                        Vedhæft nu
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Luk notifikation"
                    onClick={() => setDossierToast(null)}
                    className="p-0.5 text-[#5A4F42] hover:text-[#1C1917] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* TIERED ROLE-SPECIFIC TUTORIAL COACH STRIP (Anchored cleanly in top cluster) */}
            {tutorialActive && gameState === 'playing' && (
              <div
                data-testid="tutorial-coach-strip"
                className="pointer-events-auto max-w-2xl bg-[#1C1917]/95 text-[#F4EFE6] border border-[#A87C2D] rounded-[2px] px-3.5 py-2 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#7C2D2D] text-[#F4EFE6] rounded-[2px] shrink-0">
                        TRÆNING ({tutorialRolePath}) {currentTutStep.stepNumber}/{currentPathSteps.length}
                      </span>
                      <h3 className="font-serif text-xs sm:text-sm font-bold truncate">
                        {currentTutStep.title}
                      </h3>
                    </div>
                    <p className="text-[11px] text-[#DFD5C2] mt-0.5">{currentTutStep.hint}</p>
                  </div>

                  {/* Role-Path Switcher (Anklager / Forsvarer / Dommer) */}
                  <div
                    data-testid="tutorial-path-switcher"
                    className="flex items-center gap-1 shrink-0"
                  >
                    {(['Anklager', 'Forsvarer', 'Dommer'] as TutorialRolePath[]).map((rp) => (
                      <button
                        key={rp}
                        type="button"
                        onClick={() => {
                          setTutorialRolePath(rp);
                          setPlayerRole(rp);
                          setTutorialStep(1);
                          setSimFeedback(null);
                          setShowSimBox(true);
                        }}
                        className={`px-2 py-0.5 text-[10px] font-mono border rounded-[2px] cursor-pointer ${
                          tutorialRolePath === rp
                            ? 'bg-[#A87C2D] text-[#1C1917] border-[#A87C2D] font-bold'
                            : 'bg-[#2C251F] text-[#DFD5C2] border-[#54483B]'
                        }`}
                      >
                        {rp}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowSimBox((v) => !v)}
                      className="px-2 py-0.5 text-[10px] border border-[#54483B] text-[#E6C77E] rounded-[2px] cursor-pointer"
                    >
                      {showSimBox ? 'Skjul øvelse' : 'Vis øvelse'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setJudgeIntroOpen(true)}
                      className="px-2 py-0.5 text-[10px] border border-[#54483B] text-[#DFD5C2] rounded-[2px] cursor-pointer"
                    >
                      Intro
                    </button>
                  </div>
                </div>

                {/* Interactive Simulation per Step */}
                {showSimBox && (
                  <div
                    data-testid="tutorial-simulation"
                    className="p-2.5 bg-[#2A241E] border border-[#54483B] rounded-[2px] text-[11px] space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-[#E6C77E] uppercase">
                        Interaktiv Simulation · {currentTutStep.strategyTip}
                      </span>
                    </div>
                    <p className="font-medium text-[#F4EFE6]">{currentTutStep.simulation.prompt}</p>
                    <div className="flex flex-col sm:flex-row flex-wrap gap-1.5">
                      {currentTutStep.simulation.options.map((opt, idx) => {
                        const selected = simFeedback?.selectedIdx === idx;
                        return (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => {
                              const res = evaluateTutorialSimulationStep(currentTutStep, idx);
                              setSimFeedback({
                                passed: res.passed,
                                text: res.feedback,
                                selectedIdx: idx,
                              });
                              if (res.passed) {
                                playSoundEffect('credit');
                              }
                            }}
                            className={`text-left px-2.5 py-1 border rounded-[2px] cursor-pointer text-[11px] ${
                              selected
                                ? opt.isBest
                                  ? 'bg-[#1D3B24] border-[#8AA684] text-[#F4EFE6]'
                                  : 'bg-[#5B1D1D] border-[#C88E8E] text-[#F4EFE6]'
                                : 'bg-[#1C1917] border-[#54483B] text-[#E5DEC9] hover:border-[#A87C2D]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {simFeedback && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span
                          className={
                            simFeedback.passed ? 'text-[#A3D9A5] font-medium' : 'text-[#F3B0B0]'
                          }
                        >
                          {simFeedback.text}
                        </span>
                        {simFeedback.passed && tutorialStep < currentPathSteps.length && (
                          <button
                            type="button"
                            onClick={() => {
                              setTutorialStep((s) => Math.min(currentPathSteps.length, s + 1));
                              setSimFeedback(null);
                            }}
                            className="px-2.5 py-0.5 text-[11px] font-semibold bg-[#A87C2D] text-[#1C1917] rounded-[2px] cursor-pointer"
                          >
                            Næste trin →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* BOTTOM SECTION: Latest Speech Ticker + Collapsible Courtroom Dock */}
          <div className="flex flex-col items-center gap-2 w-full">
            {/* Compact Active Speech Line + Transcript Toggle */}
            {lastTranscript && !dockCollapsed && (
              <div className="pointer-events-auto w-full max-w-[940px] bg-[#F4EFE6]/95 border border-[#2A241E] rounded-[2px] px-4 py-2 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <span className="font-bold text-[#7C2D2D] uppercase">
                      {lastTranscript.speakerRole}
                    </span>
                    <span className="text-[#5A4F42]">{lastTranscript.timestamp}</span>
                    {lastTranscript.evaluation && (
                      <span className="px-1.5 py-0.2 bg-[#EAE3D5] border border-[#C8BCA8] text-[#1C1917] rounded-[2px] tabular-nums">
                        Kohærens: {lastTranscript.evaluation.turnScore}/100
                      </span>
                    )}
                    {lastTranscript.gesture && lastTranscript.gesture !== 'idle' && (
                      <span
                        data-testid="active-gesture-badge"
                        className="px-1.5 py-0.2 bg-[#FBF8F3] border border-[#9F927E] text-[#4A4035] rounded-[2px]"
                      >
                        Gestus: {getGestureDanishLabel(lastTranscript.gesture)}
                      </span>
                    )}
                    {lastTranscript.evaluation?.judicialWarning && (
                      <span className="text-[#7C2D2D] font-semibold">
                        ⚠ {lastTranscript.evaluation.judicialWarning}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-[#1C1917] mt-0.5 line-clamp-2">
                    {lastTranscript.text}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      speakWithCourtProfile(
                        lastTranscript.text,
                        lastTranscript.speakerRole,
                        {
                          rate: profile.ttsRate,
                          ttsEngine: profile.ttsEngine,
                          judgeVoiceProfile: profile.judgeVoiceProfile,
                          counselVoiceProfile: profile.counselVoiceProfile,
                        }
                      )
                    }
                    className="px-2 py-1 text-[11px] font-mono border border-[#9F927E] bg-[#EAE3D5] rounded-[2px] cursor-pointer"
                  >
                    Genafspil
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTranscriptDrawer((v) => !v)}
                    className="px-2 py-1 text-[11px] font-mono border border-[#9F927E] bg-[#EAE3D5] rounded-[2px] cursor-pointer"
                  >
                    Retsbog ({transcript.length})
                  </button>
                </div>
              </div>
            )}

            {/* Expandable Full Transcript Drawer */}
            {showTranscriptDrawer && !dockCollapsed && (
              <div className="pointer-events-auto w-full max-w-[940px] max-h-44 overflow-y-auto court-scroll bg-[#FBF8F3]/96 border border-[#2A241E] rounded-[2px] p-3 space-y-2">
                {transcript.map((entry) => (
                  <div
                    key={entry.id}
                    className="text-xs border-b border-[#E5DEC9] pb-1.5 last:border-b-0"
                  >
                    <span className="font-mono font-bold text-[#7C2D2D] mr-2">
                      [{entry.timestamp}] {entry.speakerRole}:
                    </span>
                    <span className="text-[#1C1917]">{entry.text}</span>
                    {entry.evaluation && (
                      <span className="ml-2 font-mono text-[10px] text-[#5A4F42]">
                        (Score {entry.evaluation.turnScore}: logik {entry.evaluation.coherenceScore},
                        bevis {entry.evaluation.evidenceWeightScore})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Collapse / Expand Dock Handle */}
            <div className="pointer-events-auto flex flex-col items-center w-full max-w-[940px]">
              <button
                type="button"
                onClick={() => setDockCollapsed((c) => !c)}
                className="px-3.5 py-1 bg-[#1C1917] text-[#F4EFE6] border border-b-0 border-[#3D352B] rounded-t-[2px] text-[11px] font-mono cursor-pointer"
              >
                {dockCollapsed ? '▴ Vis retssals-panel [H]' : '▾ Skjul panel [H]'}
              </button>

              {!dockCollapsed && (
                <div className="w-full bg-[#F4EFE6]/97 border border-[#2A241E] rounded-[2px] overflow-hidden">
                  {/* Dock Tabs */}
                  <div className="flex items-center justify-between border-b border-[#C8BCA8] bg-[#EAE3D5] px-3">
                    <div className="flex gap-1 pt-1.5">
                      {(
                        [
                          { id: 'procedure', label: 'Procedure & Indtal' },
                          {
                            id: 'evidence',
                            label: `Beviser (${activeCase.evidence.length})`,
                          },
                          { id: 'dossier', label: 'Sagsmappe & Rolle' },
                          { id: 'judge_crowd', label: 'Dommer & Folket' },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          data-testid={`dock-tab-${t.id}`}
                          onClick={() => {
                            setDockTab(t.id);
                            if (t.id === 'dossier' && tutorialActive && tutorialStep === 2) {
                              setTutorialStep(3);
                              setSimFeedback(null);
                            }
                            if (t.id === 'evidence' && tutorialActive && tutorialStep === 3) {
                              setTutorialStep(4);
                              setSimFeedback(null);
                            }
                            if (
                              t.id === 'judge_crowd' &&
                              tutorialActive &&
                              tutorialRolePath === 'Dommer' &&
                              tutorialStep === 4
                            ) {
                              setTutorialStep(5);
                              setSimFeedback(null);
                            }
                          }}
                          className={`px-3 py-1.5 text-xs font-semibold border-t border-x rounded-t-[2px] cursor-pointer inline-flex items-center gap-1.5 ${
                            dockTab === t.id
                              ? 'bg-[#F4EFE6] border-[#C8BCA8] text-[#1C1917] -mb-px'
                              : 'bg-transparent border-transparent text-[#5A4F42] hover:text-[#1C1917]'
                          }`}
                        >
                          <span>{t.label}</span>
                          {t.id === 'dossier' && uncollectedPhaseRecs.length > 0 && (
                            <span
                              data-testid="dossier-highlight-badge"
                              className="px-1 py-0 text-[10px] font-mono font-bold bg-[#7C2D2D] text-[#F4EFE6] rounded-[2px]"
                              title="Nye relevante bilag for fasen"
                            >
                              {uncollectedPhaseRecs.length}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-[#5A4F42]">
                      <span>Valgte bilag: {selectedEvidenceIds.length}</span>
                      <span>·</span>
                      <span>Fase: {phase}</span>
                    </div>
                  </div>

                  {/* Tab Content */}
                  <div className="p-3 max-h-[min(380px,50vh)] overflow-y-auto court-scroll">
                    {apiError && (
                      <div className="mb-2 px-3 py-1.5 text-xs bg-[#F3DFDF] border border-[#7C2D2D] text-[#5B1D1D] rounded-[2px]">
                        {apiError}
                      </div>
                    )}

                    {dockTab === 'procedure' && (
                      <form onSubmit={handleSubmitArgument} className="space-y-2.5">
                        {/* Quick evidence chips + Visual Full-Duplex Voice Interaction Toggle */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap pb-0.5 court-scroll flex-1 min-w-[200px]">
                            <span className="text-[11px] font-mono text-[#5A4F42] shrink-0">
                              Vedhæft bilag:
                            </span>
                            {activeCase.evidence.map((ev) => {
                              const selected = selectedEvidenceIds.includes(ev.id);
                              return (
                                <button
                                  key={ev.id}
                                  type="button"
                                  onClick={() => handleToggleEvidence(ev.id)}
                                  className={`px-2 py-0.5 text-[11px] border rounded-[2px] shrink-0 cursor-pointer ${
                                    selected
                                      ? 'bg-[#1C1917] text-[#F4EFE6] border-[#1C1917]'
                                      : 'bg-[#FBF8F3] text-[#3D352B] border-[#C8BCA8] hover:border-[#1C1917]'
                                  }`}
                                >
                                  {selected ? '✓ ' : ''}
                                  {ev.title}
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={fullDuplexActive}
                              data-testid="full-duplex-toggle"
                              onClick={() => void toggleFullDuplexVoice()}
                              className={`inline-flex items-center gap-2 px-2.5 py-1 text-[11px] font-semibold border rounded-[2px] cursor-pointer ${
                                fullDuplexActive
                                  ? 'bg-[#7C2D2D] text-[#F4EFE6] border-[#5A1E1E]'
                                  : 'bg-[#EAE3D5] text-[#1C1917] border-[#9F927E] hover:border-[#1C1917]'
                              }`}
                            >
                              {fullDuplexActive ? (
                                <Mic className="w-3.5 h-3.5 text-[#E6C77E]" />
                              ) : (
                                <MicOff className="w-3.5 h-3.5 text-[#5A4F42]" />
                              )}
                              <span>Fuld-dupleks Stemme</span>
                              <span
                                className={`inline-flex items-center w-8 h-4 p-0.5 border rounded-[2px] ${
                                  fullDuplexActive
                                    ? 'bg-[#1C1917] border-[#A87C2D] justify-end'
                                    : 'bg-[#D6CCB9] border-[#9F927E] justify-start'
                                }`}
                              >
                                <span className="w-3 h-2.5 bg-[#F4EFE6] rounded-[1px] block" />
                              </span>
                              <span className="font-mono text-[10px]">
                                {fullDuplexActive ? 'TIL' : 'FRA'}
                              </span>
                            </button>
                            {fullDuplexActive && (
                              <span className="px-2 py-0.5 text-[10px] font-mono bg-[#1C1917] text-[#E6C77E] border border-[#A87C2D] rounded-[2px]">
                                {fullDuplexStatus === 'listening'
                                  ? 'Lytter live'
                                  : fullDuplexStatus === 'processing'
                                    ? 'Behandler tale'
                                    : fullDuplexStatus === 'speaking'
                                      ? 'AI taler'
                                      : 'Klar'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <input
                            type="text"
                            value={
                              interimSpeech
                                ? `${argumentInput} ${interimSpeech}`.trim()
                                : argumentInput
                            }
                            onChange={(e) => setArgumentInput(e.target.value)}
                            placeholder={
                              fullDuplexActive
                                ? 'Tal naturligt i mikrofonen — MediaRecorder streamer live til retssalen...'
                                : isCrossExam
                                  ? 'Stil et skarpt krydsforhørsspørgsmål eller påpeg en modsigelse...'
                                  : 'Fremfør et logisk argument knyttet til sagens bilag (eller slå Fuld-dupleks Stemme til)...'
                            }
                            aria-label="Dit retssalsargument"
                            className="flex-1 min-w-[240px] px-3 py-2 text-xs sm:text-sm bg-[#FBF8F3] border border-[#9F927E] rounded-[2px] text-[#1C1917]"
                          />

                          <button
                            type="button"
                            data-testid="cross-exam-toggle"
                            onClick={() => {
                              const next = !isCrossExam;
                              const nextPhase: TrialPhase = next ? 'cross_exam' : 'evidence';
                              setIsCrossExam(next);
                              setPhase(nextPhase);
                              const nextRecs = getPhaseRelevantEvidence(
                                activeCase,
                                nextPhase,
                                next,
                                selectedEvidenceIds,
                                transcript
                              );
                              const targetRec =
                                nextRecs.find((r) => !r.isCollected) ?? nextRecs[0];
                              showDossierHighlightToast(
                                next
                                  ? 'Krydsforhør aktivt — modsigelsesbilag fremhævet'
                                  : 'Bevisførelse aktiv — nøglebilag i Dossier',
                                targetRec
                              );
                            }}
                            className={`px-3 py-2 text-xs font-semibold border rounded-[2px] cursor-pointer ${
                              isCrossExam
                                ? 'bg-[#A87C2D] text-[#1C1917] border-[#7D5B1E]'
                                : 'bg-[#EAE3D5] text-[#1C1917] border-[#9F927E]'
                            }`}
                          >
                            {isCrossExam ? 'Krydsforhør: TIL' : 'Krydsforhør'}
                          </button>

                          <button
                            type="submit"
                            disabled={isAiBusy || !argumentInput.trim()}
                            className="px-4 py-2 text-xs font-semibold bg-[#1C1917] text-[#F4EFE6] disabled:opacity-50 border border-[#1C1917] rounded-[2px] cursor-pointer"
                          >
                            {isAiBusy ? 'Behandler...' : 'Fremlæg'}
                          </button>

                          <button
                            type="button"
                            disabled={isAiBusy}
                            onClick={() => void handleRestCase()}
                            className="px-3.5 py-2 text-xs font-semibold bg-[#7C2D2D] text-[#F4EFE6] border border-[#5A1E1E] rounded-[2px] cursor-pointer"
                          >
                            Afslut sag
                          </button>
                        </div>
                      </form>
                    )}

                    {dockTab === 'evidence' && (
                      <div className="space-y-2.5">
                        {/* Combine two exhibits toolbar */}
                        <div
                          data-testid="evidence-combine-bar"
                          className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 bg-[#EAE3D5] border border-[#C8BCA8] rounded-[2px] text-xs"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-[#1C1917]">
                              <Link2 className="w-3.5 h-3.5 text-[#7C2D2D]" />
                              Kombiner 2 bilag ({combineSelectionIds.length}/2)
                            </span>
                            {combineSelectionIds.length === 0 ? (
                              <span className="text-[11px] text-[#5A4F42]">
                                Marker to bilag nedenfor for at afdække sammenhæng eller modsigelse.
                              </span>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1">
                                {combineSelectionIds.map((cid) => {
                                  const ev = activeCase.evidence.find((e) => e.id === cid);
                                  return ev ? (
                                    <span
                                      key={cid}
                                      className="px-1.5 py-0.5 text-[10px] font-mono bg-[#FBF8F3] border border-[#7C2D2D] text-[#1C1917] rounded-[2px]"
                                    >
                                      {ev.title}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {combineSelectionIds.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCombineSelectionIds([]);
                                  setCombinationResult(null);
                                }}
                                className="px-2 py-1 text-[10px] font-mono bg-[#FBF8F3] border border-[#9F927E] text-[#4A4035] rounded-[2px] cursor-pointer"
                              >
                                Nulstil
                              </button>
                            )}
                            <button
                              type="button"
                              data-testid="combine-evidence-btn"
                              disabled={combineSelectionIds.length !== 2}
                              onClick={() => {
                                if (combineSelectionIds.length !== 2) return;
                                const evA = activeCase.evidence.find(
                                  (e) => e.id === combineSelectionIds[0]
                                );
                                const evB = activeCase.evidence.find(
                                  (e) => e.id === combineSelectionIds[1]
                                );
                                if (!evA || !evB) return;
                                const combined = combineEvidenceItems(
                                  evA,
                                  evB,
                                  activeCase,
                                  playerRole
                                );
                                setCombinationResult(combined);
                                playSoundEffect('paper');
                              }}
                              className="px-3 py-1 text-[11px] font-semibold bg-[#7C2D2D] text-[#F4EFE6] disabled:opacity-45 border border-[#5A1E1E] rounded-[2px] cursor-pointer"
                            >
                              Kombiner
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto court-scroll">
                          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {activeCase.evidence.map((ev) => {
                              const selected = selectedEvidenceIds.includes(ev.id);
                              const markedForCombine = combineSelectionIds.includes(ev.id);
                              return (
                                <div
                                  key={ev.id}
                                  className={`p-1.5 border rounded-[2px] flex flex-col justify-between gap-1 ${
                                    markedForCombine
                                      ? 'bg-[#FFFDF8] border-[#A87C2D]'
                                      : selected
                                        ? 'bg-[#EAE3D5] border-[#7C2D2D]'
                                        : 'bg-[#FBF8F3] border-[#C8BCA8]'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleToggleEvidence(ev.id)}
                                    className="text-left cursor-pointer w-full"
                                  >
                                    <div className="flex items-center justify-between text-[10px] font-mono text-[#5A4F42]">
                                      <span>{ev.type.toUpperCase()}</span>
                                      <span>Vægt: {ev.reliabilityWeight}/10</span>
                                    </div>
                                    <p className="font-serif font-bold text-xs mt-0.5 text-[#1C1917]">
                                      {ev.title}
                                    </p>
                                    <p className="text-[11px] text-[#3D352B] mt-0.5 line-clamp-2">
                                      {ev.summary}
                                    </p>
                                  </button>

                                  <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-[#E5DEC9]">
                                    <span className="text-[10px] font-mono text-[#5A4F42]">
                                      {selected ? '✓ Vedhæftet' : 'Ikke vedhæftet'}
                                    </span>
                                    <button
                                      type="button"
                                      data-testid={`combine-select-${ev.id}`}
                                      onClick={() => {
                                        setCombineSelectionIds((prev) => {
                                          if (prev.includes(ev.id)) {
                                            return prev.filter((id) => id !== ev.id);
                                          }
                                          if (prev.length >= 2) {
                                            return [prev[1], ev.id];
                                          }
                                          return [...prev, ev.id];
                                        });
                                      }}
                                      className={`px-2 py-0.5 text-[10px] font-mono font-semibold border rounded-[2px] cursor-pointer ${
                                        markedForCombine
                                          ? 'bg-[#1C1917] text-[#E6C77E] border-[#1C1917]'
                                          : 'bg-[#EAE3D5] text-[#1C1917] border-[#9F927E] hover:border-[#1C1917]'
                                      }`}
                                    >
                                      {markedForCombine ? '✓ Til kombination' : '+ Marker'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="space-y-2">
                            {combinationResult && (
                              <div
                                data-testid="evidence-combination-result"
                                className={`p-2.5 border rounded-[2px] text-xs space-y-1.5 ${
                                  combinationResult.kind === 'contradiction'
                                    ? 'bg-[#F3E5E5] border-[#7C2D2D]'
                                    : combinationResult.kind === 'warning'
                                      ? 'bg-[#EFEAE0] border-[#A87C2D]'
                                      : 'bg-[#E6EFE9] border-[#234E3D]'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1 font-mono text-[10px]">
                                  <span className="font-bold uppercase text-[#1C1917]">
                                    {combinationResult.kind === 'contradiction'
                                      ? 'Modsigelse'
                                      : combinationResult.kind === 'warning'
                                        ? 'Advarsel'
                                        : 'Sammenhæng'}
                                  </span>
                                  <span className="px-1 bg-[#1C1917] text-[#E6C77E] rounded-[2px]">
                                    Styrke {combinationResult.combinedStrength}/100
                                  </span>
                                </div>
                                <p className="font-serif font-bold text-xs text-[#1C1917]">
                                  {combinationResult.title}
                                </p>
                                <p className="text-[11px] text-[#2C2620] leading-snug">
                                  {combinationResult.summary}
                                </p>
                                <button
                                  type="button"
                                  data-testid="use-combined-argument-btn"
                                  onClick={() => {
                                    const validIds = [
                                      combinationResult.evidenceA,
                                      combinationResult.evidenceB,
                                    ]
                                      .filter((ev) => !ev.isIrrelevant)
                                      .map((ev) => ev.id);

                                    setSelectedEvidenceIds((prev) => {
                                      const next = new Set(prev);
                                      for (const id of validIds) next.add(id);
                                      return Array.from(next);
                                    });
                                    setArgumentInput(combinationResult.draftArgument);
                                    if (combinationResult.recommendedPhase === 'Krydsforhør') {
                                      setIsCrossExam(true);
                                      setPhase('cross_exam');
                                    }
                                    setDockTab('procedure');
                                    playSoundEffect('click');
                                  }}
                                  className="w-full py-1 text-[11px] font-semibold bg-[#1C1917] text-[#F4EFE6] rounded-[2px] cursor-pointer"
                                >
                                  Brug i argument ({combinationResult.recommendedPhase}) →
                                </button>
                              </div>
                            )}

                            <div className="p-2.5 bg-[#FBF8F3] border border-[#C8BCA8] rounded-[2px] text-xs">
                              {inspectedEvidence ? (
                                <>
                                  <p className="font-mono text-[10px] text-[#7C2D2D] uppercase">
                                    Bilagsdetalje
                                  </p>
                                  <p className="font-serif font-bold mt-0.5">
                                    {inspectedEvidence.title}
                                  </p>
                                  <p className="mt-1 text-[11px] leading-relaxed text-[#2C2620]">
                                    {inspectedEvidence.detail}
                                  </p>
                                </>
                              ) : (
                                <p className="text-[11px] text-[#5A4F42]">
                                  Klik på et bilag på 3D-bordet eller i listen for at læse dets
                                  detaljer.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {dockTab === 'dossier' && (
                      <div className="space-y-2.5 text-xs">
                        {/* Dossier Sub-tabs: Overview vs Chronological Timeline vs Case Log */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D5C9B6] pb-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              data-testid="dossier-overview-tab"
                              onClick={() => setDossierSubTab('overview')}
                              className={`px-2.5 py-1 text-[11px] font-semibold border rounded-[2px] cursor-pointer ${
                                dossierSubTab === 'overview'
                                  ? 'bg-[#1C1917] text-[#F4EFE6] border-[#1C1917]'
                                  : 'bg-[#FBF8F3] text-[#3D352B] border-[#C8BCA8]'
                              }`}
                            >
                              Sagsoversigt &amp; Rolle
                            </button>
                            <button
                              type="button"
                              data-testid="dossier-timeline-tab"
                              onClick={() => setDossierSubTab('timeline')}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold border rounded-[2px] cursor-pointer ${
                                dossierSubTab === 'timeline'
                                  ? 'bg-[#7C2D2D] text-[#F4EFE6] border-[#5A1E1E]'
                                  : 'bg-[#FBF8F3] text-[#3D352B] border-[#C8BCA8]'
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              Tidslinje (Kronologi)
                            </button>
                            <button
                              type="button"
                              data-testid="dossier-caselog-tab"
                              onClick={() => setDossierSubTab('caselog')}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold border rounded-[2px] cursor-pointer ${
                                dossierSubTab === 'caselog'
                                  ? 'bg-[#1C1917] text-[#F4EFE6] border-[#1C1917]'
                                  : 'bg-[#FBF8F3] text-[#3D352B] border-[#C8BCA8]'
                              }`}
                            >
                              <ScrollText className="w-3 h-3" />
                              Sagslog ({caseLogEvents.length})
                            </button>
                          </div>

                          {dossierSubTab === 'timeline' && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setTimelineFilter('all')}
                                className={`px-2 py-0.5 text-[10px] font-mono border rounded-[2px] cursor-pointer ${
                                  timelineFilter === 'all'
                                    ? 'bg-[#1C1917] text-[#F4EFE6] border-[#1C1917]'
                                    : 'bg-[#EAE3D5] text-[#3D352B] border-[#C8BCA8]'
                                }`}
                              >
                                Alle spor ({timelineNodes.length})
                              </button>
                              <button
                                type="button"
                                data-testid="timeline-collected-filter"
                                onClick={() => setTimelineFilter('collected')}
                                className={`px-2 py-0.5 text-[10px] font-mono border rounded-[2px] cursor-pointer ${
                                  timelineFilter === 'collected'
                                    ? 'bg-[#7C2D2D] text-[#F4EFE6] border-[#5A1E1E]'
                                    : 'bg-[#EAE3D5] text-[#3D352B] border-[#C8BCA8]'
                                }`}
                              >
                                Kun indsamlede ({collectedTimelineCount})
                              </button>
                            </div>
                          )}

                          {dossierSubTab === 'caselog' && (
                            <div className="flex items-center gap-1.5">
                              {(
                                [
                                  { id: 'all', label: `Alle (${caseLogEvents.length})` },
                                  { id: 'ruling', label: 'Dommerafgørelser' },
                                  { id: 'objection_warning', label: 'Indsigelser & Advarsler' },
                                ] as const
                              ).map((f) => (
                                <button
                                  key={f.id}
                                  type="button"
                                  onClick={() => setCaseLogFilter(f.id)}
                                  className={`px-2 py-0.5 text-[10px] font-mono border rounded-[2px] cursor-pointer ${
                                    caseLogFilter === f.id
                                      ? 'bg-[#7C2D2D] text-[#F4EFE6] border-[#5A1E1E]'
                                      : 'bg-[#EAE3D5] text-[#3D352B] border-[#C8BCA8]'
                                  }`}
                                >
                                  {f.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {dossierSubTab === 'overview' ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto court-scroll">
                            <div className="md:col-span-2 space-y-2">
                              <div>
                                <p className="font-serif font-bold text-sm">
                                  {activeCase.caseNumber} – {activeCase.title}
                                </p>
                                <p className="text-[#2C2620] mt-0.5">{activeCase.summary}</p>
                                <p className="text-[#7C2D2D] font-medium mt-0.5">
                                  Tiltale: {activeCase.charge}
                                </p>
                              </div>

                              {/* Phase-relevant Evidence Visual Highlight inside Dossier */}
                              {phaseRecommendations.length > 0 && (
                                <div
                                  data-testid="dossier-phase-highlight"
                                  className="p-2 bg-[#FBF8F3] border border-[#A87C2D] border-l-4 border-l-[#7C2D2D] rounded-[2px] space-y-1.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-[10px] font-bold uppercase text-[#7C2D2D]">
                                      Aktuelle bilag for fasen ({phase === 'cross_exam' || isCrossExam ? 'Krydsforhør' : phase})
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setDossierSubTab('timeline')}
                                      className="font-mono text-[10px] text-[#1E3A5F] underline cursor-pointer"
                                    >
                                      Se i tidslinje →
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {phaseRecommendations.slice(0, 2).map((rec) => (
                                      <div
                                        key={rec.evidence.id}
                                        className={`p-1.5 border rounded-[2px] flex flex-col justify-between gap-1 ${
                                          rec.isCollected
                                            ? 'bg-[#EAE3D5]/70 border-[#9F927E]'
                                            : 'bg-[#FFFDF8] border-[#A87C2D]'
                                        }`}
                                      >
                                        <div>
                                          <div className="flex items-center justify-between gap-1">
                                            <span className="font-serif font-bold text-[11px] text-[#1C1917] truncate">
                                              {rec.evidence.title}
                                            </span>
                                            <span className="font-mono text-[9px] px-1 bg-[#EAE3D5] border border-[#C8BCA8] rounded-[2px] shrink-0">
                                              Vægt {rec.evidence.reliabilityWeight}/10
                                            </span>
                                          </div>
                                          <p className="text-[10px] text-[#3D352B] mt-0.5 line-clamp-2">
                                            {rec.reason}
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleEvidence(rec.evidence.id)}
                                          className={`w-full py-0.5 text-[10px] font-mono font-semibold border rounded-[2px] cursor-pointer ${
                                            rec.isCollected
                                              ? 'bg-[#1C1917] text-[#F4EFE6] border-[#1C1917]'
                                              : 'bg-[#7C2D2D] text-[#F4EFE6] border-[#5A1E1E]'
                                          }`}
                                        >
                                          {rec.isCollected ? '✓ Indsamlet til procedure' : '+ Tag bilag i spil'}
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                                <div className="p-2 bg-[#FBF8F3] border border-[#C8BCA8] rounded-[2px]">
                                  <span className="font-semibold block">Anklagerens mål:</span>
                                  {activeCase.prosecutionGoal}
                                </div>
                                <div className="p-2 bg-[#FBF8F3] border border-[#C8BCA8] rounded-[2px]">
                                  <span className="font-semibold block">Forsvarerens mål:</span>
                                  {activeCase.defenseGoal}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2 p-2.5 bg-[#FBF8F3] border border-[#C8BCA8] rounded-[2px]">
                              <label htmlFor="liveRoleSwitch" className="block font-semibold">
                                Skift aktiv rolle
                              </label>
                              <select
                                id="liveRoleSwitch"
                                value={playerRole}
                                onChange={(e) => {
                                  const nextRole = e.target.value as PlayableRole;
                                  setPlayerRole(nextRole);
                                  setTutorialRolePath(mapPlayableRoleToTutorialPath(nextRole));
                                  updateProfile({ ...profile, preferredRole: nextRole });
                                  if (tutorialActive && tutorialStep <= 2) {
                                    setTutorialStep(3);
                                    setSimFeedback(null);
                                  }
                                }}
                                className="w-full px-2 py-1 bg-[#F4EFE6] border border-[#9F927E] rounded-[2px]"
                              >
                                <option value="Anklager">Anklager</option>
                                <option value="Forsvarer">Forsvarer</option>
                                <option value="Tiltalte">Tiltalte</option>
                                <option value="Vidne">Vidne</option>
                                <option value="Dommer">Dommer</option>
                              </select>

                              <label htmlFor="levelSwitch" className="block font-semibold pt-1">
                                Læringsniveau
                              </label>
                              <select
                                id="levelSwitch"
                                value={activeLevel}
                                onChange={(e) => setActiveLevel(e.target.value as LearningLevel)}
                                className="w-full px-2 py-1 bg-[#F4EFE6] border border-[#9F927E] rounded-[2px]"
                              >
                                <option value="Begynder">Begynder</option>
                                <option value="Øvet">Øvet</option>
                                <option value="Dommer">Dommer</option>
                              </select>
                            </div>
                          </div>
                        ) : dossierSubTab === 'timeline' ? (
                          <div
                            data-testid="dossier-timeline-view"
                            className="max-h-44 overflow-y-auto court-scroll pr-1"
                          >
                            {(() => {
                              const visibleNodes =
                                timelineFilter === 'collected'
                                  ? timelineNodes.filter(
                                      (n) => n.sourceKind === 'evidence' && n.isCollected
                                    )
                                  : timelineNodes;

                              if (visibleNodes.length === 0) {
                                return (
                                  <div className="p-3 bg-[#FBF8F3] border border-[#C8BCA8] rounded-[2px] text-[#4A4137]">
                                    Du har endnu ikke vedhæftet nogen bilag til din kronologi. Skift til
                                    &quot;Alle spor&quot; eller klik et bilag på bevisbordet for at se
                                    sammenhængen.
                                  </div>
                                );
                              }

                              return (
                                <div className="relative pl-4 border-l-2 border-[#7C2D2D] space-y-2 ml-1.5">
                                  {visibleNodes.map((node) => {
                                    const sideTag =
                                      node.supports === 'prosecution'
                                        ? 'Anklage'
                                        : node.supports === 'defense'
                                          ? 'Forsvar'
                                          : 'Neutral';
                                    const isPhaseHighlighted = Boolean(
                                      node.evidenceId && highlightedEvidenceIds.has(node.evidenceId)
                                    );
                                    return (
                                      <div
                                        key={node.id}
                                        data-testid={`timeline-node-${node.id}`}
                                        className={`relative p-2 border rounded-[2px] ${
                                          node.isIrrelevant
                                            ? 'bg-[#EFEAE0] border-[#B8AD9B] opacity-80'
                                            : isPhaseHighlighted && !node.isCollected
                                              ? 'bg-[#FFFDF8] border-[#A87C2D]'
                                              : node.isCollected && node.sourceKind === 'evidence'
                                                ? 'bg-[#FBF8F3] border-[#7C2D2D]'
                                                : 'bg-[#FBF8F3] border-[#C8BCA8]'
                                        }`}
                                      >
                                        <span
                                          className={`absolute -left-[22px] top-2.5 w-2.5 h-2.5 border border-[#1C1917] rounded-[1px] ${
                                            node.isCollected && node.sourceKind === 'evidence'
                                              ? 'bg-[#7C2D2D]'
                                              : isPhaseHighlighted
                                                ? 'bg-[#A87C2D]'
                                                : 'bg-[#E6C77E]'
                                          }`}
                                        />
                                        {isPhaseHighlighted && (
                                          <span className="inline-block mb-1 px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase bg-[#A87C2D] text-[#1C1917] rounded-[2px]">
                                            Relevant for nuværende fase
                                          </span>
                                        )}
                                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[#1C1917] text-[#E6C77E] rounded-[2px] tabular-nums">
                                              {node.timeLabel}
                                            </span>
                                            <span className="text-[10px] font-mono uppercase text-[#5A4F42]">
                                              {node.dayBucketLabel}
                                            </span>
                                            <span className="text-[10px] font-mono px-1 bg-[#EAE3D5] border border-[#C8BCA8] rounded-[2px]">
                                              {sideTag}
                                            </span>
                                            {typeof node.reliabilityWeight === 'number' && (
                                              <span className="text-[10px] font-mono text-[#5A4F42]">
                                                Vægt {node.reliabilityWeight}/10
                                              </span>
                                            )}
                                          </div>

                                          {node.evidenceId && (
                                            <button
                                              type="button"
                                              onClick={() => handleToggleEvidence(node.evidenceId!)}
                                              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono border rounded-[2px] cursor-pointer ${
                                                node.isCollected
                                                  ? 'bg-[#7C2D2D] text-[#F4EFE6] border-[#5A1E1E]'
                                                  : 'bg-[#EAE3D5] text-[#1C1917] border-[#9F927E]'
                                              }`}
                                            >
                                              {node.isCollected ? (
                                                <>
                                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                                  Indsamlet
                                                </>
                                              ) : (
                                                '+ Vedhæft bilag'
                                              )}
                                            </button>
                                          )}
                                        </div>

                                        <p className="font-serif font-bold text-xs text-[#1C1917] mt-1">
                                          {node.title}
                                        </p>
                                        <p className="text-[11px] text-[#2C2620] mt-0.5">
                                          {node.summary}
                                        </p>

                                        {node.contradictionHint && (
                                          <p className="mt-1 inline-flex items-start gap-1 text-[10px] text-[#7C2D2D] font-medium">
                                            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                                            <span>Sammenhæng/Modsigelse: {node.contradictionHint}</span>
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          <div
                            data-testid="dossier-caselog-view"
                            className="max-h-44 overflow-y-auto court-scroll pr-1 space-y-2"
                          >
                            {(() => {
                              const visibleLogs = caseLogEvents.filter((item) => {
                                if (caseLogFilter === 'ruling') return item.category === 'ruling';
                                if (caseLogFilter === 'objection_warning') {
                                  return (
                                    item.category === 'objection' || item.category === 'warning'
                                  );
                                }
                                return true;
                              });

                              if (visibleLogs.length === 0) {
                                return (
                                  <div className="p-3 bg-[#FBF8F3] border border-[#C8BCA8] rounded-[2px] text-[#4A4137]">
                                    Ingen registrerede dommerafgørelser, indsigelser eller advarsler
                                    matcher filteret endnu.
                                  </div>
                                );
                              }

                              return visibleLogs.map((item) => {
                                const badgeClass =
                                  item.category === 'warning' || item.category === 'objection'
                                    ? 'bg-[#7C2D2D] text-[#F4EFE6] border-[#5A1E1E]'
                                    : item.category === 'contradiction'
                                      ? 'bg-[#A87C2D] text-[#1C1917] border-[#7D5B1E]'
                                      : 'bg-[#1C1917] text-[#E6C77E] border-[#1C1917]';

                                return (
                                  <article
                                    key={item.id}
                                    data-testid={`caselog-item-${item.category}`}
                                    className="p-2.5 bg-[#FBF8F3] border border-[#C8BCA8] rounded-[2px] space-y-1"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-1.5 font-mono text-[10px]">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span
                                          className={`px-1.5 py-0.5 font-bold uppercase border rounded-[2px] ${badgeClass}`}
                                        >
                                          {item.categoryLabel}
                                        </span>
                                        <span className="text-[#5A4F42] tabular-nums">
                                          kl. {item.timestamp} · {item.phase}
                                        </span>
                                        <span className="px-1 bg-[#EAE3D5] border border-[#C8BCA8] rounded-[2px] text-[#1C1917]">
                                          {item.speakerRole}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1.5 tabular-nums">
                                        {typeof item.penalty === 'number' && item.penalty > 0 && (
                                          <span className="px-1.5 py-0.5 bg-[#F3E5E5] border border-[#7C2D2D] text-[#7C2D2D] rounded-[2px] font-bold">
                                            Straf -{item.penalty}
                                          </span>
                                        )}
                                        {typeof item.turnScore === 'number' && (
                                          <span className="text-[#5A4F42]">
                                            Score {item.turnScore}/100
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <p className="text-xs font-medium text-[#1C1917] leading-snug">
                                      {item.text}
                                    </p>

                                    {item.detailNote && (
                                      <p className="text-[11px] text-[#4A4035] italic">
                                        {item.detailNote}
                                      </p>
                                    )}

                                    {item.citedEvidenceIds.length > 0 && (
                                      <div className="flex flex-wrap gap-1 pt-0.5">
                                        {item.citedEvidenceIds.map((evId) => {
                                          const ev = activeCase.evidence.find((e) => e.id === evId);
                                          return (
                                            <span
                                              key={evId}
                                              className="px-1.5 py-0.5 text-[10px] font-mono bg-[#EAE3D5] border border-[#C8BCA8] rounded-[2px] text-[#1C1917]"
                                            >
                                              {ev?.title ?? evId}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </article>
                                );
                              });
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    {dockTab === 'judge_crowd' && (
                      <div className="space-y-3 text-xs">
                        {/* Dynamic Jury Persuasion Bar always pinned at top of Dommer & Folket */}
                        <JuryPersuasionBar persuasion={livePersuasion} />

                        {/* Sub-tabs inside Dommer & Folket */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#C8BCA8] pb-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setJudgeCrowdSubTab('controls')}
                              className={`px-2.5 py-1 text-[11px] font-semibold border rounded-[2px] cursor-pointer ${
                                judgeCrowdSubTab === 'controls'
                                  ? 'bg-[#1C1917] text-[#F4EFE6] border-[#1C1917]'
                                  : 'bg-[#EAE3D5] text-[#4A4035] border-[#9F927E]'
                              }`}
                            >
                              Afstemning &amp; Dommerværktøj
                            </button>
                            <button
                              type="button"
                              data-testid="logic-radar-tab"
                              onClick={() => setJudgeCrowdSubTab('radar')}
                              className={`px-2.5 py-1 text-[11px] font-semibold border rounded-[2px] cursor-pointer ${
                                judgeCrowdSubTab === 'radar'
                                  ? 'bg-[#7C2D2D] text-[#F4EFE6] border-[#5A1E1E]'
                                  : 'bg-[#EAE3D5] text-[#4A4035] border-[#9F927E]'
                              }`}
                            >
                              Logik-radar
                            </button>
                            <button
                              type="button"
                              data-testid="ai-character-gallery-tab"
                              onClick={() => setJudgeCrowdSubTab('gallery')}
                              className={`px-2.5 py-1 text-[11px] font-semibold border rounded-[2px] cursor-pointer ${
                                judgeCrowdSubTab === 'gallery'
                                  ? 'bg-[#1C1917] text-[#F4EFE6] border-[#1C1917]'
                                  : 'bg-[#EAE3D5] text-[#4A4035] border-[#9F927E]'
                              }`}
                            >
                              AI-karaktergalleri
                            </button>
                          </div>
                          <span className="font-mono text-[10px] text-[#5A4F42]">
                            6 AI-nævninge + modstående AI-counsel
                          </span>
                        </div>

                        {judgeCrowdSubTab === 'controls' ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            {/* Folket (Audience Polling) */}
                            <div className="p-2.5 bg-[#FBF8F3] border border-[#C8BCA8] rounded-[2px] space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-serif font-bold text-sm">
                                  Folket (Tilskuerafstemning)
                                </span>
                                <span className="font-mono text-[11px] tabular-nums">
                                  Ank {multiplayer.audienceVotesProsecution} vs For{' '}
                                  {multiplayer.audienceVotesDefense}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMultiplayer((prev) => ({
                                      ...prev,
                                      audienceVotesProsecution: prev.audienceVotesProsecution + 1,
                                      userAudienceVote: 'Anklager',
                                    }));
                                    playSoundEffect('click');
                                  }}
                                  className="flex-1 py-1.5 border border-[#7C2D2D] bg-[#F3E5E5] text-[#5B1D1D] font-semibold rounded-[2px] cursor-pointer"
                                >
                                  Stem Anklager
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMultiplayer((prev) => ({
                                      ...prev,
                                      audienceVotesDefense: prev.audienceVotesDefense + 1,
                                      userAudienceVote: 'Forsvarer',
                                    }));
                                    playSoundEffect('click');
                                  }}
                                  className="flex-1 py-1.5 border border-[#1E3A5F] bg-[#E3EAF2] text-[#162C47] font-semibold rounded-[2px] cursor-pointer"
                                >
                                  Stem Forsvarer
                                </button>
                              </div>
                            </div>

                            {/* Judge Tools */}
                            <div className="p-2.5 bg-[#FBF8F3] border border-[#C8BCA8] rounded-[2px] space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-serif font-bold text-sm">
                                  Dommerens Værktøjer
                                </span>
                                <span className="font-mono text-[10px] text-[#5A4F42]">
                                  Rum: {multiplayer.roomCode}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    sceneRef.current?.triggerGavelSlam();
                                    playSoundEffect('gavel');
                                    pushTranscript({
                                      speakerRole: 'Dommer',
                                      speakerName: 'Dommer',
                                      phase,
                                      text: 'Ro i retssalen! Hold Dem til sagens dokumenterede fakta.',
                                      citedEvidenceIds: [],
                                    });
                                  }}
                                  className="px-2.5 py-1 bg-[#1C1917] text-[#F4EFE6] rounded-[2px] cursor-pointer flex items-center gap-1"
                                >
                                  <GavelIconSvg className="w-3 h-3 text-[#A87C2D]" />
                                  Slå hammeren
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    sceneRef.current?.triggerGavelSlam();
                                    sceneRef.current?.triggerCriticalObjectionMood(4.5);
                                    playSoundEffect('objection');
                                    pushTranscript({
                                      speakerRole: 'Dommer',
                                      speakerName: 'Dommer',
                                      phase,
                                      text: 'Indsigelse taget til følge – irrelevant materiale afvises fra retsbogen.',
                                      citedEvidenceIds: [],
                                      isObjection: true,
                                    });
                                  }}
                                  className="px-2.5 py-1 border border-[#9F927E] bg-[#EAE3D5] rounded-[2px] cursor-pointer"
                                >
                                  Afvis irrelevant bilag
                                </button>
                                {playerRole === 'Dommer' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => void handleRestCase('Anklager')}
                                      className="px-2.5 py-1 bg-[#7C2D2D] text-[#F4EFE6] rounded-[2px] cursor-pointer"
                                    >
                                      Døm Anklager
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleRestCase('Forsvarer')}
                                      className="px-2.5 py-1 bg-[#1E3A5F] text-[#F4EFE6] rounded-[2px] cursor-pointer"
                                    >
                                      Døm Frifindelse
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Stemnings-override (Manuel lys-indstilling af 3D-retssalen) */}
                            <div
                              data-testid="mood-override-card"
                              className="col-span-1 md:col-span-2 p-3 bg-[#FBF8F3] border border-[#C8BCA8] rounded-[2px] space-y-2.5"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <Sliders className="w-3.5 h-3.5 text-[#7C2D2D]" />
                                  <span className="font-serif font-bold text-sm text-[#1C1917]">
                                    Retssalens Stemnings-override
                                  </span>
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[2px] border border-[#C8BCA8] bg-[#F4EFE6] text-[#4A4035]">
                                    3D-lys &amp; atmosfære
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-mono text-[#5A4F42]">
                                    Aktiv belysning:
                                  </span>
                                  <span
                                    data-testid="active-mood-badge"
                                    className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-[2px] border ${
                                      moodOverride === 'auto'
                                        ? 'bg-[#EAE3D5] text-[#3D352B] border-[#9F927E]'
                                        : moodOverride === 'warm'
                                          ? 'bg-[#FFF6E5] text-[#7D5B1E] border-[#D4A359]'
                                          : moodOverride === 'tense'
                                            ? 'bg-[#E3EAF2] text-[#1E3A5F] border-[#7CA3C9]'
                                            : 'bg-[#F0ECE1] text-[#3D352B] border-[#B5A895]'
                                    }`}
                                  >
                                    {moodOverride === 'auto'
                                      ? `Auto (${courtMood === 'warm' ? 'Varm' : courtMood === 'tense' ? 'Kølig' : 'Neutral'})`
                                      : moodOverride === 'warm'
                                        ? 'Altid varmt lys'
                                        : moodOverride === 'tense'
                                          ? 'Altid køligt lys'
                                          : 'Neutralt standardlys'}
                                  </span>
                                </div>
                              </div>

                              <p className="text-[11px] text-[#5A4F42] leading-relaxed">
                                Overstyr retssalens automatiske belysning for at skabe en bestemt atmosfære i 3D-scenen (f.eks. altid varmt gyldent ravlys eller altid kølig skiferblå spænding), eller lad belysningen følge juryens stemning automatisk.
                              </p>

                              {/* Slider Control */}
                              <div className="space-y-1.5 pt-1">
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-[10px] text-[#7C2D2D] w-12 text-left font-semibold">
                                    0: Auto
                                  </span>
                                  <input
                                    type="range"
                                    min="0"
                                    max="3"
                                    step="1"
                                    value={
                                      moodOverride === 'auto'
                                        ? 0
                                        : moodOverride === 'tense'
                                          ? 1
                                          : moodOverride === 'neutral'
                                            ? 2
                                            : 3
                                    }
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      const mapped: 'auto' | CourtMoodLevel =
                                        val === 0
                                          ? 'auto'
                                          : val === 1
                                            ? 'tense'
                                            : val === 2
                                              ? 'neutral'
                                              : 'warm';
                                      setMoodOverride(mapped);
                                      sceneRef.current?.setManualMoodOverride(mapped);
                                      playSoundEffect('click');
                                    }}
                                    data-testid="mood-override-slider"
                                    aria-label="Stemnings-override skyder"
                                    className="flex-1 accent-[#7C2D2D] h-2 bg-[#E5DDCF] rounded-[2px] cursor-pointer"
                                  />
                                  <span className="font-mono text-[10px] text-[#A87C2D] w-16 text-right font-semibold">
                                    3: Varmt
                                  </span>
                                </div>

                                {/* Slider Marks */}
                                <div className="flex justify-between text-[10px] font-mono text-[#6A5E50] px-1">
                                  <span
                                    className={
                                      moodOverride === 'auto'
                                        ? 'font-bold text-[#1C1917]'
                                        : ''
                                    }
                                  >
                                    0: Auto (dynamisk)
                                  </span>
                                  <span
                                    className={
                                      moodOverride === 'tense'
                                        ? 'font-bold text-[#1E3A5F]'
                                        : ''
                                    }
                                  >
                                    1: Altid køligt
                                  </span>
                                  <span
                                    className={
                                      moodOverride === 'neutral'
                                        ? 'font-bold text-[#1C1917]'
                                        : ''
                                    }
                                  >
                                    2: Neutralt
                                  </span>
                                  <span
                                    className={
                                      moodOverride === 'warm'
                                        ? 'font-bold text-[#7D5B1E]'
                                        : ''
                                    }
                                  >
                                    3: Altid varmt
                                  </span>
                                </div>
                              </div>

                              {/* Quick-Select Buttons */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                <button
                                  type="button"
                                  data-testid="mood-btn-auto"
                                  onClick={() => {
                                    setMoodOverride('auto');
                                    sceneRef.current?.setManualMoodOverride('auto');
                                    playSoundEffect('click');
                                  }}
                                  className={`py-1.5 px-2 text-[11px] font-semibold border rounded-[2px] cursor-pointer flex items-center justify-center gap-1.5 ${
                                    moodOverride === 'auto'
                                      ? 'bg-[#1C1917] text-[#F4EFE6] border-[#1C1917]'
                                      : 'bg-[#EAE3D5] text-[#3D352B] border-[#B5A895] hover:bg-[#DDD5C5]'
                                  }`}
                                >
                                  <Sparkles className="w-3 h-3 text-[#C8BCA8]" />
                                  <span>Auto (Jury-stemning)</span>
                                </button>

                                <button
                                  type="button"
                                  data-testid="mood-btn-tense"
                                  onClick={() => {
                                    setMoodOverride('tense');
                                    sceneRef.current?.setManualMoodOverride('tense');
                                    playSoundEffect('click');
                                  }}
                                  className={`py-1.5 px-2 text-[11px] font-semibold border rounded-[2px] cursor-pointer flex items-center justify-center gap-1.5 ${
                                    moodOverride === 'tense'
                                      ? 'bg-[#1E3A5F] text-[#F4EFE6] border-[#10243E]'
                                      : 'bg-[#E3EAF2] text-[#1E3A5F] border-[#A8BDD4] hover:bg-[#D5E1EE]'
                                  }`}
                                >
                                  <Moon className="w-3 h-3 text-[#1E3A5F]" />
                                  <span>Altid køligt lys</span>
                                </button>

                                <button
                                  type="button"
                                  data-testid="mood-btn-neutral"
                                  onClick={() => {
                                    setMoodOverride('neutral');
                                    sceneRef.current?.setManualMoodOverride('neutral');
                                    playSoundEffect('click');
                                  }}
                                  className={`py-1.5 px-2 text-[11px] font-semibold border rounded-[2px] cursor-pointer flex items-center justify-center gap-1.5 ${
                                    moodOverride === 'neutral'
                                      ? 'bg-[#4A4035] text-[#F4EFE6] border-[#2A241E]'
                                      : 'bg-[#F0ECE1] text-[#3D352B] border-[#B5A895] hover:bg-[#E3DCC5]'
                                  }`}
                                >
                                  <span>Neutralt lys</span>
                                </button>

                                <button
                                  type="button"
                                  data-testid="mood-btn-warm"
                                  onClick={() => {
                                    setMoodOverride('warm');
                                    sceneRef.current?.setManualMoodOverride('warm');
                                    playSoundEffect('click');
                                  }}
                                  className={`py-1.5 px-2 text-[11px] font-semibold border rounded-[2px] cursor-pointer flex items-center justify-center gap-1.5 ${
                                    moodOverride === 'warm'
                                      ? 'bg-[#7D5B1E] text-[#F4EFE6] border-[#5A4012]'
                                      : 'bg-[#FFF6E5] text-[#7D5B1E] border-[#E5C992] hover:bg-[#FBECCC]'
                                  }`}
                                >
                                  <Sun className="w-3 h-3 text-[#A87C2D]" />
                                  <span>Altid varmt lys</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : judgeCrowdSubTab === 'radar' ? (
                          <LogicRadarChart metrics={logicRadar} />
                        ) : (
                          <AiCharacterGallery
                            opposingRole={
                              roleSide(playerRole) === 'prosecution' ? 'Forsvarer' : 'Anklager'
                            }
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {gameState === 'paused' && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Spillet er sat på pause"
        >
          <div className="w-full max-w-sm bg-[#F4EFE6] text-[#1C1917] border border-[#2A241E] rounded-[2px] p-5 space-y-4">
            <div className="border-b border-[#C8BCA8] pb-3">
              <p className="text-[10px] font-mono uppercase text-[#7C2D2D]">Retsmøde suspenderet</p>
              <h2 className="font-serif text-xl font-bold mt-0.5">Retssalen på pause</h2>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setGameState('playing')}
                className="w-full py-2.5 text-xs font-semibold bg-[#1C1917] text-[#F4EFE6] rounded-[2px] cursor-pointer"
              >
                Genoptag retssag
              </button>
              <button
                type="button"
                onClick={() => beginTrial(activeCase, playerRole)}
                className="w-full py-2 text-xs font-semibold bg-[#EAE3D5] border border-[#9F927E] rounded-[2px] cursor-pointer"
              >
                Genstart nuværende sag
              </button>
              <button
                type="button"
                onClick={() => {
                  setShopGlossaryTab('settings');
                  setShopGlossaryOpen(true);
                }}
                className="w-full py-2 text-xs font-semibold bg-[#EAE3D5] border border-[#9F927E] rounded-[2px] cursor-pointer"
              >
                Indstillinger, TTS &amp; Tutorial
              </button>
              <button
                type="button"
                onClick={() => {
                  stopSpeaking();
                  performAutosave(true);
                  setGameState('title');
                }}
                className="w-full py-2 text-xs font-semibold text-[#7C2D2D] border border-[#C8BCA8] bg-[#FBF8F3] rounded-[2px] cursor-pointer"
              >
                Afslut til titelskærm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      <JudgeIntroModal
        open={judgeIntroOpen}
        ttsEnabled={profile.ttsEnabled}
        ttsRate={profile.ttsRate}
        ttsEngine={profile.ttsEngine}
        judgeVoiceProfile={profile.judgeVoiceProfile}
        completedLevels={profile.completedLevels}
        onClose={() => setJudgeIntroOpen(false)}
        onCompleteIntro={() =>
          updateProfile({ ...profile, judgeIntroCompleted: true })
        }
        onStartTrialWithLevel={(lvl) => {
          setActiveLevel(lvl);
          const matchingCase =
            BUILT_IN_CASES.find((c) => c.difficulty === lvl) ?? BUILT_IN_CASES[0];
          beginTrial(
            lvl === 'Begynder' ? BUILT_IN_CASES[0] : matchingCase,
            lvl === 'Dommer' ? 'Dommer' : profile.preferredRole
          );
        }}
      />

      {caseImportOpen && (
        <CaseImportModal
          open={caseImportOpen}
          initialTab={caseImportInitialTab}
          profile={profile}
          customCases={customCases}
          onClose={() => setCaseImportOpen(false)}
          onStartCase={(c, r, mp) => beginTrial(c, r, mp)}
          onSaveCustomCase={(nc) => setCustomCases(saveCustomCase(nc))}
          onDeleteCustomCase={(id) => setCustomCases(deleteCustomCase(id))}
        />
      )}

      {shopGlossaryOpen && (
        <ShopGlossaryModal
          open={shopGlossaryOpen}
          initialTab={shopGlossaryTab}
          profile={profile}
          onClose={() => setShopGlossaryOpen(false)}
          onUpdateProfile={updateProfile}
          onRestartTutorial={() => {
            updateProfile({ ...profile, tutorialCompleted: false, tutorialHighestStep: 1 });
            beginTrial(BUILT_IN_CASES[0], 'Anklager');
          }}
        />
      )}

      <VerdictModal
        open={gameState === 'gameover' && Boolean(verdict)}
        legalCase={activeCase}
        playerRole={playerRole}
        verdict={verdict}
        ttsRate={profile.ttsRate}
        ttsEngine={profile.ttsEngine}
        judgeVoiceProfile={profile.judgeVoiceProfile}
        onReplay={() => beginTrial(activeCase, playerRole)}
        onNextOrBrowse={() => {
          if (activeCase.isTutorial && !profile.tutorialCompleted) {
            updateProfile({
              ...profile,
              tutorialCompleted: true,
              tutorialHighestStep: 8,
            });
          }
          setCaseImportInitialTab('library');
          setCaseImportOpen(true);
          setGameState('playing');
          setVerdict(null);
        }}
      />
    </div>
  );
}
