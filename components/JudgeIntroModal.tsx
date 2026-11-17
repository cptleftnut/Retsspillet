'use client';

import React, { useState } from 'react';
import { JUDGE_INTRO_MODULES } from '@/lib/gameData';
import type { LearningLevel, TtsEngine, VoiceProfileId } from '@/lib/types';
import { speakLine } from '@/lib/audio';
import { GavelIconSvg, SpeakerIconSvg } from './CourtSvgIcons';

interface JudgeIntroModalProps {
  open: boolean;
  ttsEnabled: boolean;
  ttsRate: number;
  ttsEngine: TtsEngine;
  judgeVoiceProfile: VoiceProfileId;
  completedLevels: LearningLevel[];
  onClose: () => void;
  onCompleteIntro: () => void;
  onStartTrialWithLevel: (level: LearningLevel) => void;
}

export function JudgeIntroModal({
  open,
  ttsEnabled,
  ttsRate,
  ttsEngine,
  judgeVoiceProfile,
  completedLevels,
  onClose,
  onCompleteIntro,
  onStartTrialWithLevel,
}: JudgeIntroModalProps) {
  const [moduleIndex, setModuleIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answeredCorrectly, setAnsweredCorrectly] = useState<Record<number, boolean>>({});

  if (!open) return null;

  const mod = JUDGE_INTRO_MODULES[moduleIndex];
  const isCorrect = selectedOption === mod.interactiveCheck.correctIndex;
  const totalChecked = Object.values(answeredCorrectly).filter(Boolean).length;

  const handleSelectOption = (idx: number) => {
    setSelectedOption(idx);
    if (idx === mod.interactiveCheck.correctIndex) {
      setAnsweredCorrectly((prev) => ({ ...prev, [mod.id]: true }));
    }
  };

  const handleSpeak = () => {
    speakLine(`${mod.title}. ${mod.body} Nøgleprincip: ${mod.keyPrinciple}`, 'Dommer', {
      rate: ttsRate,
      ttsEngine,
      voiceProfileId: judgeVoiceProfile,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Dommerintroduktion"
    >
      <div className="w-full max-w-3xl bg-[#F4EFE6] text-[#1C1917] border border-[#2A241E] rounded-[2px] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#1C1917] text-[#F4EFE6] border-b border-[#3D352B]">
          <div className="flex items-center gap-2.5">
            <GavelIconSvg className="w-5 h-5 text-[#A87C2D]" />
            <div>
              <h2 className="font-serif text-lg font-semibold leading-tight">
                Dommerintroduktion & Læringsniveauer
              </h2>
              <p className="text-xs text-[#C8BCA8] font-mono">
                Modul {moduleIndex + 1} / {JUDGE_INTRO_MODULES.length} · Beståede prøver: {totalChecked}/10
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSpeak}
              className="px-2.5 py-1.5 text-xs font-medium bg-[#2C251F] hover:bg-[#3A3129] text-[#F4EFE6] border border-[#54483B] rounded-[2px] flex items-center gap-1.5 cursor-pointer"
              aria-label="Læs modul højt med TTS"
            >
              <SpeakerIconSvg active={ttsEnabled} className="w-3.5 h-3.5 text-[#A87C2D]" />
              Læs op
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 text-xs font-medium bg-[#2C251F] hover:bg-[#3A3129] text-[#F4EFE6] border border-[#54483B] rounded-[2px] cursor-pointer"
            >
              Luk
            </button>
          </div>
        </div>

        {/* Module Step Bar */}
        <div className="flex overflow-x-auto border-b border-[#C8BCA8] bg-[#EAE3D5] px-3 py-2 gap-1.5">
          {JUDGE_INTRO_MODULES.map((m, idx) => {
            const done = answeredCorrectly[m.id];
            const active = idx === moduleIndex;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setModuleIndex(idx);
                  setSelectedOption(null);
                }}
                className={`px-2.5 py-1 text-xs font-mono border rounded-[2px] shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#1C1917] text-[#F4EFE6] border-[#1C1917]'
                    : done
                      ? 'bg-[#D9E2D5] text-[#1D3B24] border-[#8AA684]'
                      : 'bg-[#F4EFE6] text-[#4A4137] border-[#C8BCA8] hover:border-[#7C2D2D]'
                }`}
              >
                {m.id}. {done ? '✓' : ''}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto court-scroll space-y-5">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-[#7C2D2D] font-semibold">
              {mod.subtitle}
            </p>
            <h3 className="font-serif text-2xl font-bold mt-0.5 text-[#1C1917]">{mod.title}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-[#2C2620]">{mod.body}</p>
            <div className="mt-3 p-3 bg-[#EAE3D5] border-l-4 border-[#A87C2D] text-xs font-medium text-[#1C1917]">
              Hovedregel: {mod.keyPrinciple}
            </div>
          </div>

          {/* Interactive check */}
          <div className="border border-[#C8BCA8] bg-[#FBF8F3] p-4 rounded-[2px]">
            <p className="text-xs font-mono uppercase tracking-wider text-[#5A4F42] mb-2">
              Kontrolspørgsmål
            </p>
            <p className="text-sm font-semibold mb-3">{mod.interactiveCheck.question}</p>
            <div className="space-y-2">
              {mod.interactiveCheck.options.map((opt, idx) => {
                const chosen = selectedOption === idx;
                const right = idx === mod.interactiveCheck.correctIndex;
                let style =
                  'bg-[#F4EFE6] border-[#C8BCA8] text-[#1C1917] hover:border-[#1C1917]';
                if (chosen && right) {
                  style = 'bg-[#E2EDE0] border-[#2D6A3E] text-[#183C22] font-medium';
                } else if (chosen && !right) {
                  style = 'bg-[#F3DFDF] border-[#7C2D2D] text-[#5B1D1D]';
                }
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleSelectOption(idx)}
                    className={`w-full text-left px-3 py-2 text-xs border rounded-[2px] cursor-pointer transition-colors ${style}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {selectedOption !== null && (
              <p
                className={`mt-3 text-xs font-medium ${
                  isCorrect ? 'text-[#2D6A3E]' : 'text-[#7C2D2D]'
                }`}
              >
                {isCorrect
                  ? `Korrekt: ${mod.interactiveCheck.explanation}`
                  : 'Ikke helt. Læs hovedreglen ovenfor og prøv et andet svar.'}
              </p>
            )}
          </div>

          {/* 3 Learning Levels Entry */}
          <div className="border-t border-[#C8BCA8] pt-4">
            <p className="text-xs font-mono uppercase tracking-wider text-[#5A4F42] mb-2.5">
              Vælg læringsniveau til prøvesag
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(
                [
                  {
                    lvl: 'Begynder' as LearningLevel,
                    desc: 'Grundlæggende retssagsforløb og argumentation (Sag #0001).',
                  },
                  {
                    lvl: 'Øvet' as LearningLevel,
                    desc: 'Bevisvægt, krydsforhør, modargumenter og juryvurdering.',
                  },
                  {
                    lvl: 'Dommer' as LearningLevel,
                    desc: 'Neutralitet, habilitet, bevisbedømmelse og begrundede afgørelser.',
                  },
                ] as const
              ).map(({ lvl, desc }) => {
                const done = completedLevels.includes(lvl);
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => {
                      onCompleteIntro();
                      onStartTrialWithLevel(lvl);
                    }}
                    className="text-left p-3 border border-[#C8BCA8] hover:border-[#1C1917] bg-[#FBF8F3] rounded-[2px] cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-serif font-bold text-sm">{lvl}</span>
                      {done && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#E2EDE0] text-[#183C22] border border-[#8AA684] rounded-[2px]">
                          Gennemført
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#4A4137] mt-1">{desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#EAE3D5] border-t border-[#C8BCA8]">
          <button
            type="button"
            disabled={moduleIndex === 0}
            onClick={() => {
              setModuleIndex((i) => Math.max(0, i - 1));
              setSelectedOption(null);
            }}
            className="px-3 py-1.5 text-xs font-medium border border-[#9F927E] bg-[#F4EFE6] disabled:opacity-40 rounded-[2px] cursor-pointer"
          >
            Forrige modul
          </button>
          {moduleIndex < JUDGE_INTRO_MODULES.length - 1 ? (
            <button
              type="button"
              onClick={() => {
                setModuleIndex((i) => i + 1);
                setSelectedOption(null);
              }}
              className="px-4 py-1.5 text-xs font-semibold bg-[#1C1917] text-[#F4EFE6] border border-[#1C1917] rounded-[2px] cursor-pointer"
            >
              Næste modul
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onCompleteIntro();
                onStartTrialWithLevel('Begynder');
              }}
              className="px-4 py-1.5 text-xs font-semibold bg-[#7C2D2D] text-[#F4EFE6] border border-[#5A1E1E] rounded-[2px] cursor-pointer"
            >
              Afslut intro & Start prøvesag
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
