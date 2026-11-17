'use client';

import React, { useEffect, useState } from 'react';
import { BUILT_IN_CASES } from '@/lib/gameData';
import {
  DRIVE_OAUTH_CLIENT_ID,
  getCachedDriveToken,
  importDriveFileAsCase,
  importDriveFolderAsCase,
  initDriveAuth,
  listDriveItems,
  signInWithGoogleDrive,
  signOutDrive,
  type DriveFileSummary,
} from '@/lib/driveAuth';
import type {
  EvidenceItem,
  LearningLevel,
  LegalCase,
  PlayableRole,
  PlayerProfile,
} from '@/lib/types';

interface CaseImportModalProps {
  open: boolean;
  initialTab?: 'library' | 'domsdatabasen' | 'editor' | 'drive' | 'history';
  profile: PlayerProfile;
  customCases: LegalCase[];
  onClose: () => void;
  onStartCase: (
    legalCase: LegalCase,
    role: PlayableRole,
    multiplayerOpts?: { active: boolean; roomCode: string; humanJudge: boolean }
  ) => void;
  onSaveCustomCase: (newCase: LegalCase) => void;
  onDeleteCustomCase: (caseId: string) => void;
}

export function CaseImportModal({
  open,
  initialTab = 'library',
  profile,
  customCases,
  onClose,
  onStartCase,
  onSaveCustomCase,
  onDeleteCustomCase,
}: CaseImportModalProps) {
  const [tab, setTab] = useState<'library' | 'domsdatabasen' | 'editor' | 'drive' | 'history'>(
    initialTab
  );
  const [selectedRole, setSelectedRole] = useState<PlayableRole>(profile.preferredRole);
  const [multiplayerActive, setMultiplayerActive] = useState(false);
  const [humanJudge, setHumanJudge] = useState(false);
  const [roomCode, setRoomCode] = useState('RET-402');

  // Domsdatabasen search
  const [domsQuery, setDomsQuery] = useState('');
  const [domsResults, setDomsResults] = useState<LegalCase[]>([]);
  const [domsLoading, setDomsLoading] = useState(false);

  // Custom Case Editor
  const [edTitle, setEdTitle] = useState('');
  const [edCharge, setEdCharge] = useState('');
  const [edSummary, setEdSummary] = useState('');
  const [edDefendant, setEdDefendant] = useState('Signe Holm');
  const [edProsGoal, setEdProsGoal] = useState('Dokumenter ansvar med primærbeviser.');
  const [edDefGoal, setEdDefGoal] = useState('Skab rimelig tvivl om hændelsesforløbet.');
  const [edEvTitle, setEdEvTitle] = useState('Bilag 1: Skriftlig log');
  const [edEvDetail, setEdEvDetail] = useState('Tidsstemplet dokumentation fra stedet.');
  const [edStatus, setEdStatus] = useState<string | null>(null);

  // Google Drive state
  const [needsDriveAuth, setNeedsDriveAuth] = useState(true);
  const [driveUserEmail, setDriveUserEmail] = useState<string | null>(null);
  const [driveItems, setDriveItems] = useState<DriveFileSummary[]>([]);
  const [driveFolderStack, setDriveFolderStack] = useState<{ id: string; name: string }[]>([
    { id: 'root', name: 'Mit drev' },
  ]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  // Initialized cleanly per mount when modal opens

  useEffect(() => {
    const unsub = initDriveAuth(
      (user) => {
        setNeedsDriveAuth(false);
        setDriveUserEmail(user.email);
      },
      () => {
        setNeedsDriveAuth(!getCachedDriveToken());
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (open && tab === 'domsdatabasen' && domsResults.length === 0) {
      void searchDomsdatabasen('');
    }
  }, [open, tab, domsResults.length]);

  if (!open) return null;

  const allCases = [...customCases, ...BUILT_IN_CASES];

  async function searchDomsdatabasen(q: string) {
    setDomsLoading(true);
    try {
      const res = await fetch(`/api/domsdatabasen?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { cases?: LegalCase[] };
      setDomsResults(data.cases ?? []);
    } catch {
      setDomsResults([]);
    } finally {
      setDomsLoading(false);
    }
  }

  async function handleDriveLogin() {
    setDriveError(null);
    setDriveLoading(true);
    try {
      const res = await signInWithGoogleDrive();
      setNeedsDriveAuth(false);
      setDriveUserEmail(res.userEmail);
      const items = await listDriveItems('root');
      setDriveItems(items);
      setDriveFolderStack([{ id: 'root', name: 'Mit drev' }]);
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Google login fejlede.');
    } finally {
      setDriveLoading(false);
    }
  }

  async function openDriveFolder(folderId: string, name: string, resetToRoot = false) {
    setDriveLoading(true);
    setDriveError(null);
    try {
      const items = await listDriveItems(folderId);
      setDriveItems(items);
      setDriveFolderStack((prev) =>
        resetToRoot ? [{ id: 'root', name: 'Mit drev' }] : [...prev, { id: folderId, name }]
      );
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Kunne ikke åbne mappe.');
    } finally {
      setDriveLoading(false);
    }
  }

  async function navigateDriveBreadcrumb(index: number) {
    const target = driveFolderStack[index];
    if (!target) return;
    setDriveLoading(true);
    setDriveError(null);
    try {
      const items = await listDriveItems(target.id);
      setDriveItems(items);
      setDriveFolderStack((prev) => prev.slice(0, index + 1));
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Kunne ikke skifte mappe.');
    } finally {
      setDriveLoading(false);
    }
  }

  async function importDriveDoc(file: DriveFileSummary) {
    setDriveLoading(true);
    setDriveError(null);
    try {
      const imported = await importDriveFileAsCase(file);
      onSaveCustomCase(imported);
      onStartCase(imported, selectedRole, {
        active: multiplayerActive,
        roomCode,
        humanJudge,
      });
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Import fejlede.');
    } finally {
      setDriveLoading(false);
    }
  }

  async function importDriveFolder(folder: DriveFileSummary) {
    setDriveLoading(true);
    setDriveError(null);
    try {
      const imported = await importDriveFolderAsCase(folder.id, folder.name);
      onSaveCustomCase(imported);
      onStartCase(imported, selectedRole, {
        active: multiplayerActive,
        roomCode,
        humanJudge,
      });
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Mappeimport fejlede.');
    } finally {
      setDriveLoading(false);
    }
  }

  function handleCreateCustomCase(e: React.FormEvent) {
    e.preventDefault();
    if (!edTitle.trim() || !edSummary.trim()) {
      setEdStatus('Udfyld venligst både sagstitel og resumé.');
      return;
    }
    const id = `custom-${Date.now()}`;
    const evidenceItem: EvidenceItem = {
      id: `ev-${Date.now()}`,
      title: edEvTitle.trim() || 'Bilag 1',
      type: 'document',
      summary: edEvDetail.trim().slice(0, 100) || 'Dokumenteret bilag.',
      detail: edEvDetail.trim() || 'Sagsdokument oprettet i sagseditoren.',
      reliabilityWeight: 8,
      supports: 'neutral',
      keywords: (edTitle + ' ' + edEvDetail)
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .slice(0, 5),
    };

    const created: LegalCase = {
      id,
      caseNumber: `#E-${String(customCases.length + 1).padStart(3, '0')}`,
      title: edTitle.trim(),
      category: 'Egen sag',
      difficulty: 'Øvet' as LearningLevel,
      source: 'Egen sag',
      summary: edSummary.trim(),
      charge: edCharge.trim() || 'Prøveanklage / civil tvist',
      prosecutionGoal: edProsGoal.trim(),
      defenseGoal: edDefGoal.trim(),
      defendantName: edDefendant.trim() || 'Tiltalte',
      coreIssues: edSummary
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .slice(0, 6),
      rewardCredits: 280,
      witnesses: [],
      evidence: [evidenceItem],
    };
    onSaveCustomCase(created);
    setEdTitle('');
    setEdCharge('');
    setEdSummary('');
    setEdStatus(`Sagen "${created.title}" er gemt og klar i Sagsbiblioteket.`);
    setTab('library');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sagsarkiv, Import og Multiplayer"
    >
      <div className="w-full max-w-5xl bg-[#F4EFE6] text-[#1C1917] border border-[#2A241E] rounded-[2px] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 bg-[#1C1917] text-[#F4EFE6] border-b border-[#3D352B]">
          <div>
            <h2 className="font-serif text-lg font-semibold">
              Sagsarkiv, Import & Multiplayer-lobby
            </h2>
            <p className="text-xs text-[#C8BCA8]">
              {profile.tutorialCompleted
                ? 'Alle sager og multiplayer-roller er låst op.'
                : 'Gennemfør øvelsessag #0001 for at låse almindelige sager og multiplayer op.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-xs font-medium bg-[#2C251F] hover:bg-[#3A3129] border border-[#54483B] rounded-[2px] cursor-pointer"
          >
            Luk
          </button>
        </div>

        {/* Role & Multiplayer Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-[#EAE3D5] border-b border-[#C8BCA8] text-xs">
          <div className="flex items-center gap-2">
            <label htmlFor="caseRoleSelect" className="font-semibold">
              Din rolle:
            </label>
            <select
              id="caseRoleSelect"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as PlayableRole)}
              className="px-2.5 py-1 bg-[#FBF8F3] border border-[#9F927E] rounded-[2px] font-medium"
            >
              <option value="Anklager">Anklager</option>
              <option value="Forsvarer">Forsvarer</option>
              <option value="Tiltalte">Den Tiltalte</option>
              <option value="Vidne">Vidne</option>
              <option value="Dommer" disabled={!multiplayerActive && !profile.judgeIntroCompleted}>
                Dommer (Multiplayer / Intro bestået)
              </option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={multiplayerActive}
                disabled={!profile.tutorialCompleted}
                onChange={(e) => setMultiplayerActive(e.target.checked)}
              />
              Multiplayer-rum (Folket & Menneskelig Dommer)
            </label>
            {multiplayerActive && (
              <>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  aria-label="Rumkode"
                  className="w-24 px-2 py-1 font-mono bg-[#FBF8F3] border border-[#9F927E] rounded-[2px]"
                />
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={humanJudge}
                    onChange={(e) => setHumanJudge(e.target.checked)}
                  />
                  Menneskelig dommer
                </label>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-[#C8BCA8] bg-[#E5DEC9] px-4 pt-2 gap-1.5">
          {(
            [
              { id: 'library', label: 'Sagsbibliotek' },
              { id: 'domsdatabasen', label: 'Domsdatabasen.dk' },
              { id: 'editor', label: 'Egne sager (Editor)' },
              { id: 'drive', label: 'Google Drive Import' },
              { id: 'history', label: `Tidligere sager (${profile.history.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-xs font-semibold border-t border-x rounded-t-[2px] shrink-0 cursor-pointer ${
                tab === t.id
                  ? 'bg-[#F4EFE6] border-[#C8BCA8] text-[#1C1917] -mb-px'
                  : 'bg-transparent border-transparent text-[#5A4F42] hover:text-[#1C1917]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto court-scroll flex-1">
          {tab === 'library' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {allCases.map((c) => {
                const locked = !c.isTutorial && !profile.tutorialCompleted;
                return (
                  <div
                    key={c.id}
                    className={`p-4 border rounded-[2px] flex flex-col justify-between bg-[#FBF8F3] ${
                      locked ? 'border-[#D5CCB9] opacity-75' : 'border-[#9F927E]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-[#7C2D2D] font-semibold">
                          {c.caseNumber} · {c.source}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#EAE3D5] border border-[#C8BCA8] rounded-[2px]">
                          {c.difficulty}
                        </span>
                      </div>
                      <h3 className="font-serif text-base font-bold mt-1">{c.title}</h3>
                      <p className="text-xs text-[#3D352B] mt-1.5 leading-relaxed">{c.summary}</p>
                      <p className="text-[11px] font-mono text-[#5A4F42] mt-2">
                        Bilag: {c.evidence.length} · Vidner: {c.witnesses.length} · Belønning: {c.rewardCredits} Cr
                      </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-[#E6DFD3] flex items-center justify-between gap-2">
                      {c.source === 'Egen sag' || c.source === 'Google Drive' ? (
                        <button
                          type="button"
                          onClick={() => onDeleteCustomCase(c.id)}
                          className="text-xs text-[#7C2D2D] hover:underline cursor-pointer"
                        >
                          Slet sag
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#5A4F42]">{c.category}</span>
                      )}
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() =>
                          onStartCase(c, selectedRole, {
                            active: multiplayerActive,
                            roomCode,
                            humanJudge,
                          })
                        }
                        className="px-3.5 py-1.5 text-xs font-semibold bg-[#1C1917] text-[#F4EFE6] disabled:bg-[#9F927E] rounded-[2px] cursor-pointer disabled:cursor-not-allowed"
                      >
                        {locked ? 'Låses op efter #0001' : c.isTutorial ? 'Start øvelsessag' : 'Åbn retssag'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'domsdatabasen' && (
            <div className="space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void searchDomsdatabasen(domsQuery);
                }}
                className="flex gap-2"
              >
                <input
                  type="search"
                  value={domsQuery}
                  onChange={(e) => setDomsQuery(e.target.value)}
                  placeholder="Søg i Domsdatabasen.dk (f.eks. vandskade, drone, BS-114)..."
                  aria-label="Søg i Domsdatabasen.dk"
                  className="flex-1 px-3 py-2 text-xs bg-[#FBF8F3] border border-[#9F927E] rounded-[2px]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-[#1C1917] text-[#F4EFE6] rounded-[2px] cursor-pointer"
                >
                  {domsLoading ? 'Søger...' : 'Søg'}
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {domsResults.map((c) => {
                  const locked = !profile.tutorialCompleted;
                  return (
                    <div
                      key={c.id}
                      className="p-4 border border-[#9F927E] bg-[#FBF8F3] rounded-[2px] flex flex-col justify-between"
                    >
                      <div>
                        <span className="text-[11px] font-mono text-[#7C2D2D] font-semibold">
                          {c.caseNumber} · Domsdatabasen.dk
                        </span>
                        <h3 className="font-serif text-base font-bold mt-1">{c.title}</h3>
                        <p className="text-xs text-[#3D352B] mt-1.5">{c.summary}</p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-[#E6DFD3] flex items-center justify-between">
                        <span className="text-[11px] font-mono">{c.difficulty} · {c.rewardCredits} Cr</span>
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => {
                            onSaveCustomCase(c);
                            onStartCase(c, selectedRole, {
                              active: multiplayerActive,
                              roomCode,
                              humanJudge,
                            });
                          }}
                          className="px-3 py-1.5 text-xs font-semibold bg-[#7C2D2D] text-[#F4EFE6] disabled:bg-[#9F927E] rounded-[2px] cursor-pointer"
                        >
                          {locked ? 'Fuldfør #0001 først' : 'Importer & Spil'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'editor' && (
            <form onSubmit={handleCreateCustomCase} className="space-y-3 max-w-2xl">
              {edStatus && (
                <div className="p-2.5 text-xs bg-[#EAE3D5] border border-[#A87C2D] rounded-[2px]">
                  {edStatus}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" htmlFor="edTitle">
                    Sagstitel *
                  </label>
                  <input
                    id="edTitle"
                    type="text"
                    value={edTitle}
                    onChange={(e) => setEdTitle(e.target.value)}
                    placeholder="F.eks. Den omstridte lejekontrakt"
                    className="w-full px-3 py-1.5 text-xs bg-[#FBF8F3] border border-[#9F927E] rounded-[2px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" htmlFor="edDefendant">
                    Tiltalte / Indklagede
                  </label>
                  <input
                    id="edDefendant"
                    type="text"
                    value={edDefendant}
                    onChange={(e) => setEdDefendant(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-[#FBF8F3] border border-[#9F927E] rounded-[2px]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" htmlFor="edCharge">
                  Anklage / Påstand
                </label>
                <input
                  id="edCharge"
                  type="text"
                  value={edCharge}
                  onChange={(e) => setEdCharge(e.target.value)}
                  placeholder="F.eks. Krav om tilbagebetaling af depositum..."
                  className="w-full px-3 py-1.5 text-xs bg-[#FBF8F3] border border-[#9F927E] rounded-[2px]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" htmlFor="edSummary">
                  Sagsfremstilling *
                </label>
                <textarea
                  id="edSummary"
                  rows={3}
                  value={edSummary}
                  onChange={(e) => setEdSummary(e.target.value)}
                  placeholder="Beskriv tvisten, tidspunkter og hovedspørgsmålet..."
                  className="w-full px-3 py-1.5 text-xs bg-[#FBF8F3] border border-[#9F927E] rounded-[2px]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" htmlFor="edEvTitle">
                    Primært bilag (titel)
                  </label>
                  <input
                    id="edEvTitle"
                    type="text"
                    value={edEvTitle}
                    onChange={(e) => setEdEvTitle(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-[#FBF8F3] border border-[#9F927E] rounded-[2px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" htmlFor="edEvDetail">
                    Bilagets indhold
                  </label>
                  <input
                    id="edEvDetail"
                    type="text"
                    value={edEvDetail}
                    onChange={(e) => setEdEvDetail(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-[#FBF8F3] border border-[#9F927E] rounded-[2px]"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-[#1C1917] text-[#F4EFE6] rounded-[2px] cursor-pointer"
              >
                Gem egen sag i Sagsbiblioteket
              </button>
            </form>
          )}

          {tab === 'drive' && (
            <div className="space-y-4">
              <div className="p-4 border border-[#C8BCA8] bg-[#FBF8F3] rounded-[2px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-serif font-bold text-base">
                    Google Drive / Google Workspace Sagsimport
                  </h3>
                  {DRIVE_OAUTH_CLIENT_ID && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#EAE3D5] border border-[#C8BCA8] rounded-[2px] text-[#4A4137]">
                      OAuth Klient klar
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#4A4137] mt-1">
                  Log ind med din Google-konto for at hente dine egne juridiske dokumenter eller
                  importere en hel sagsmappe som en samlet retssag med flere bilag.
                </p>

                {needsDriveAuth ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => void handleDriveLogin()}
                      disabled={driveLoading}
                      className="inline-flex items-center gap-2.5 px-4 py-2 bg-white text-[#1F1F1F] border border-[#747775] rounded-[4px] text-xs font-medium hover:bg-[#F8F9FA] cursor-pointer"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                      </svg>
                      {driveLoading ? 'Forbinder...' : 'Sign in with Google'}
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span>
                      Forbundet som <strong className="font-mono">{driveUserEmail}</strong>
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void openDriveFolder('root', 'Mit drev', true)}
                        className="px-2.5 py-1 bg-[#1C1917] text-[#F4EFE6] rounded-[2px] cursor-pointer"
                      >
                        Opdater filer
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void signOutDrive();
                          setNeedsDriveAuth(true);
                          setDriveItems([]);
                        }}
                        className="px-2.5 py-1 border border-[#9F927E] rounded-[2px] cursor-pointer"
                      >
                        Log ud
                      </button>
                    </div>
                  </div>
                )}

                {driveError && (
                  <p className="mt-2 text-xs text-[#7C2D2D] font-medium">{driveError}</p>
                )}
              </div>

              {!needsDriveAuth && (
                <div className="border border-[#C8BCA8] bg-[#FBF8F3] rounded-[2px] divide-y divide-[#E6DFD3]">
                  <div className="px-3 py-2 bg-[#EAE3D5] text-xs font-mono flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <span>Sti:</span>
                      {driveFolderStack.map((f, idx) => (
                        <React.Fragment key={`${f.id}-${idx}`}>
                          {idx > 0 && <span>/</span>}
                          <button
                            type="button"
                            onClick={() => void navigateDriveBreadcrumb(idx)}
                            className="underline hover:text-[#7C2D2D] cursor-pointer"
                          >
                            {f.name}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                    {driveFolderStack.length > 1 && (
                      <button
                        type="button"
                        onClick={() => void navigateDriveBreadcrumb(driveFolderStack.length - 2)}
                        className="px-2 py-0.5 text-[11px] bg-[#FBF8F3] border border-[#9F927E] rounded-[2px] cursor-pointer"
                      >
                        Tilbage
                      </button>
                    )}
                  </div>

                  {driveItems.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-[#5A4F42]">
                      Ingen mapper eller læsbare sagsdokumenter fundet i denne mappe.
                    </p>
                  ) : (
                    driveItems.map((item) => {
                      const isFolder = item.mimeType === 'application/vnd.google-apps.folder';
                      return (
                        <div
                          key={item.id}
                          className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <span className="font-mono text-[10px] mr-2 px-1.5 py-0.5 bg-[#EAE3D5] border border-[#C8BCA8] rounded-[2px]">
                              {isFolder ? 'SAGSMAPPE' : 'DOKUMENT'}
                            </span>
                            <span className="font-medium">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isFolder ? (
                              <>
                                <button
                                  type="button"
                                  disabled={driveLoading}
                                  onClick={() => void openDriveFolder(item.id, item.name)}
                                  className="px-2.5 py-1 border border-[#9F927E] bg-[#EAE3D5] rounded-[2px] cursor-pointer"
                                >
                                  Åbn mappe
                                </button>
                                <button
                                  type="button"
                                  disabled={driveLoading}
                                  onClick={() => void importDriveFolder(item)}
                                  className="px-3 py-1 bg-[#7C2D2D] text-[#F4EFE6] rounded-[2px] cursor-pointer"
                                >
                                  Importer hele mappen som sag
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                disabled={driveLoading}
                                onClick={() => void importDriveDoc(item)}
                                className="px-3 py-1 bg-[#1C1917] text-[#F4EFE6] rounded-[2px] cursor-pointer"
                              >
                                Importer som sag
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-2.5">
              {profile.history.length === 0 ? (
                <p className="text-xs text-[#5A4F42]">
                  Du har endnu ingen afsluttede sager i din retsbog. Når du fuldfører en sag, gemmes
                  dommen og resultatet her.
                </p>
              ) : (
                profile.history.map((rec) => {
                  const foundCase = allCases.find((c) => c.id === rec.caseId);
                  return (
                    <div
                      key={rec.id}
                      className="p-3.5 border border-[#C8BCA8] bg-[#FBF8F3] rounded-[2px] flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-semibold text-[#7C2D2D]">
                            {rec.caseNumber}
                          </span>
                          <span className="font-serif font-bold text-sm">{rec.caseTitle}</span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 border rounded-[2px] ${
                              rec.playerWon
                                ? 'bg-[#E2EDE0] text-[#183C22] border-[#8AA684]'
                                : 'bg-[#F3DFDF] text-[#5B1D1D] border-[#C88E8E]'
                            }`}
                          >
                            {rec.playerWon ? 'SEJR' : 'TABT'}
                          </span>
                        </div>
                        <p className="text-xs text-[#4A4137] mt-1">
                          Rolle: {rec.playerRole} · Kohærens: {rec.coherenceScore}/100 · +{rec.creditsEarned} Credits
                        </p>
                        <p className="text-[11px] text-[#5A4F42] mt-0.5">{rec.judgeSummary}</p>
                      </div>
                      {foundCase && (
                        <button
                          type="button"
                          onClick={() => onStartCase(foundCase, rec.playerRole)}
                          className="px-3 py-1.5 text-xs font-semibold bg-[#1C1917] text-[#F4EFE6] rounded-[2px] cursor-pointer"
                        >
                          Spil igen
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
