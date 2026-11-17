'use client';

import React from 'react';
import type {
  LegalCase,
  PlayableRole,
  TtsEngine,
  VerdictResult,
  VoiceProfileId,
} from '@/lib/types';
import { GavelIconSvg, SpeakerIconSvg } from './CourtSvgIcons';
import { speakLine } from '@/lib/audio';

interface VerdictModalProps {
  open: boolean;
  legalCase: LegalCase;
  playerRole: PlayableRole;
  verdict: VerdictResult | null;
  ttsRate: number;
  ttsEngine: TtsEngine;
  judgeVoiceProfile: VoiceProfileId;
  onReplay: () => void;
  onNextOrBrowse: () => void;
}

export function VerdictModal({
  open,
  legalCase,
  playerRole,
  verdict,
  ttsRate,
  ttsEngine,
  judgeVoiceProfile,
  onReplay,
  onNextOrBrowse,
}: VerdictModalProps) {
  if (!open || !verdict) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Dommerens Afgørelse"
    >
      <div className="w-full max-w-2xl bg-[#F4EFE6] text-[#1C1917] border border-[#2A241E] rounded-[2px] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#1C1917] text-[#F4EFE6] border-b border-[#3D352B] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GavelIconSvg className="w-6 h-6 text-[#A87C2D]" />
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-[#C8BCA8]">
                {legalCase.caseNumber} · {legalCase.title}
              </p>
              <h2 className="font-serif text-xl font-bold">
                Domskendelse: {verdict.winner} vinder sagen
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              speakLine(
                `Domskendelse. ${verdict.winner} vinder sagen. ${verdict.judgeReasoning}`,
                'Dommer',
                {
                  rate: ttsRate,
                  ttsEngine,
                  voiceProfileId: judgeVoiceProfile,
                }
              )
            }
            className="px-2.5 py-1.5 text-xs bg-[#2C251F] border border-[#54483B] rounded-[2px] flex items-center gap-1.5 cursor-pointer"
          >
            <SpeakerIconSvg active className="w-3.5 h-3.5 text-[#A87C2D]" />
            Læs dom
          </button>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-3 border-b border-[#C8BCA8] bg-[#EAE3D5] divide-x divide-[#C8BCA8]">
          <div className="p-3.5 text-center">
            <p className="text-[10px] font-mono uppercase text-[#5A4F42]">AI-Jury Stemmer</p>
            <p className="font-serif text-xl font-bold tabular-nums mt-0.5">
              {verdict.juryVotesProsecution} – {verdict.juryVotesDefense}
            </p>
            <p className="text-[10px] text-[#5A4F42]">Anklager vs. Forsvarer</p>
          </div>
          <div className="p-3.5 text-center">
            <p className="text-[10px] font-mono uppercase text-[#5A4F42]">Logisk Kohærens</p>
            <p className="font-serif text-xl font-bold tabular-nums mt-0.5">
              {verdict.prosecutionCoherence} / {verdict.defenseCoherence}
            </p>
            <p className="text-[10px] text-[#5A4F42]">Din rolle: {playerRole}</p>
          </div>
          <div className="p-3.5 text-center">
            <p className="text-[10px] font-mono uppercase text-[#5A4F42]">Optjente Credits</p>
            <p className="font-serif text-xl font-bold text-[#7C2D2D] tabular-nums mt-0.5">
              +{verdict.creditsAwarded}
            </p>
            <p className="text-[10px] text-[#5A4F42]">
              {verdict.playerWon ? 'Sag vundet' : 'Deltagelse & analyse'}
            </p>
          </div>
        </div>

        {/* Reasoning */}
        <div className="p-5 space-y-4 max-h-[52vh] overflow-y-auto court-scroll">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-[#5A4F42]">
              AI-Juryens vurdering
            </p>
            <p className="text-xs leading-relaxed mt-1 text-[#2C2620]">{verdict.juryReasoning}</p>
          </div>
          <div className="p-3.5 bg-[#FBF8F3] border border-[#C8BCA8] rounded-[2px]">
            <p className="text-[11px] font-mono uppercase tracking-wider text-[#7C2D2D] font-semibold">
              Dommerens begrundelse
            </p>
            <p className="text-sm leading-relaxed mt-1 font-serif text-[#1C1917]">
              {verdict.judgeReasoning}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-[#EBF2EA] border border-[#A5BF9F] rounded-[2px]">
              <p className="font-semibold text-[#183C22] mb-1">Styrker i din procedure</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[#23482D]">
                {verdict.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="p-3 bg-[#F3E9E2] border border-[#C9B3A3] rounded-[2px]">
              <p className="font-semibold text-[#5B271D] mb-1">Næste læringsfokus</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[#5A3429]">
                {verdict.improvements.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Footer CTAs */}
        <div className="px-6 py-3.5 bg-[#EAE3D5] border-t border-[#C8BCA8] flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onReplay}
            className="px-3.5 py-2 text-xs font-semibold border border-[#9F927E] bg-[#F4EFE6] rounded-[2px] cursor-pointer"
          >
            Spil sagen igen
          </button>
          <button
            type="button"
            data-start="true"
            onClick={onNextOrBrowse}
            className="px-5 py-2 text-xs font-semibold bg-[#1C1917] text-[#F4EFE6] border border-[#1C1917] rounded-[2px] cursor-pointer"
          >
            {legalCase.isTutorial
              ? 'Modtag belønning & Lås sager op'
              : 'Vælg næste sag'}
          </button>
        </div>
      </div>
    </div>
  );
}
