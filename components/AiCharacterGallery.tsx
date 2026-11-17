'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Scale, Users, ShieldAlert, Sparkles } from 'lucide-react';
import { AI_CHARACTER_PROFILES } from '@/lib/gameData';
import type { CourtRole, LiveJuryPersuasion } from '@/lib/types';

export function JuryPersuasionBar({
  persuasion,
}: {
  persuasion: LiveJuryPersuasion;
}) {
  const [animatedPct, setAnimatedPct] = useState<number>(persuasion.prosecutionPct);
  const currentPctRef = useRef<number>(persuasion.prosecutionPct);

  useEffect(() => {
    const startVal = currentPctRef.current;
    const endVal = persuasion.prosecutionPct;
    if (Math.abs(endVal - startVal) < 0.1) return;

    const durationMs = 780;
    const startTime = performance.now();
    let rafId = 0;

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      // Cubic ease-out for weighted courtroom balance feel
      const eased = 1 - Math.pow(1 - t, 3);
      const next = startVal + (endVal - startVal) * eased;
      currentPctRef.current = next;
      setAnimatedPct(next);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        currentPctRef.current = endVal;
        setAnimatedPct(endVal);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [persuasion.prosecutionPct]);

  const roundedProsPct = Math.round(animatedPct);
  const roundedDefPct = 100 - roundedProsPct;

  const leadBadgeClass =
    persuasion.leadingSide === 'Anklager'
      ? 'bg-[#F3E5E5] border-[#7C2D2D] text-[#5B1D1D]'
      : persuasion.leadingSide === 'Forsvarer'
        ? 'bg-[#E3EAF2] border-[#1E3A5F] text-[#162C47]'
        : 'bg-[#EAE3D5] border-[#9F927E] text-[#1C1917]';

  const leadLabel =
    persuasion.leadingSide === 'Lige'
      ? 'Juryen står helt lige'
      : `${persuasion.leadingSide} fører voteringen`;

  return (
    <div
      data-testid="jury-persuasion-bar"
      data-target-prosecution-pct={persuasion.prosecutionPct}
      data-displayed-prosecution-pct={roundedProsPct}
      className="p-2.5 bg-[#FBF8F3] border border-[#2A241E] rounded-[2px] space-y-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Scale className="w-3.5 h-3.5 text-[#7C2D2D]" />
          <span className="font-serif font-bold text-xs sm:text-sm text-[#1C1917]">
            Jury-overbevisningsbar
          </span>
          <span className={`px-1.5 py-0.5 text-[10px] font-mono border rounded-[2px] transition-colors duration-500 ${leadBadgeClass}`}>
            {leadLabel}
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
          <span className="text-[#7C2D2D] font-bold">
            Anklager {roundedProsPct}% ({persuasion.juryVotesProsecution}/6)
          </span>
          <span className="text-[#8E7F6B]">·</span>
          <span className="text-[#1E3A5F] font-bold">
            Forsvarer {roundedDefPct}% ({persuasion.juryVotesDefense}/6)
          </span>
          {persuasion.recentSwingDelta !== 0 && (
            <span
              className={`px-1 py-0.5 border rounded-[2px] text-[10px] transition-all duration-500 ${
                persuasion.recentSwingDelta > 0
                  ? 'bg-[#F3E5E5] border-[#7C2D2D] text-[#7C2D2D]'
                  : 'bg-[#E3EAF2] border-[#1E3A5F] text-[#1E3A5F]'
              }`}
              title="Seneste svingning fra retsbogen"
            >
              Sving {persuasion.recentSwingDelta > 0 ? `+${persuasion.recentSwingDelta}` : persuasion.recentSwingDelta}
            </span>
          )}
        </div>
      </div>

      {/* Smooth gliding split meter with brass fulcrum marker */}
      <div className="relative w-full h-3.5 bg-[#E3EAF2] border border-[#2A241E] rounded-[2px] overflow-hidden flex">
        <div
          data-testid="jury-bar-prosecution-fill"
          className="h-full bg-[#7C2D2D] transition-[width] duration-700 ease-out"
          style={{ width: `${animatedPct.toFixed(2)}%` }}
          aria-label={`Anklager overbevisning ${persuasion.prosecutionPct}%`}
        />
        <div
          className="h-full bg-[#1E3A5F] flex-1"
          aria-label={`Forsvarer overbevisning ${persuasion.defensePct}%`}
        />
        {/* Brass balance fulcrum indicator */}
        <span
          aria-hidden="true"
          className="absolute top-0 bottom-0 w-1 bg-[#E6C77E] border-x border-[#1C1917] transition-[left] duration-700 ease-out pointer-events-none"
          style={{ left: `calc(${animatedPct.toFixed(2)}% - 2px)` }}
        />
      </div>

      {/* 6 Juror Seat Blocks with staggered vote transitions */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
        <div className="flex items-center gap-1" aria-label="Nævningebænkens 6 stemmer">
          <span className="text-[#5A4F42] mr-1">6 Nævninge:</span>
          {Array.from({ length: 6 }).map((_, idx) => {
            const votesPros = idx < persuasion.juryVotesProsecution;
            return (
              <span
                key={idx}
                style={{ transitionDelay: `${idx * 65}ms` }}
                className={`w-4 h-3.5 border rounded-[1px] inline-flex items-center justify-center text-[9px] font-bold transition-all duration-500 ease-out ${
                  votesPros
                    ? 'bg-[#7C2D2D] border-[#5B1D1D] text-[#F4EFE6]'
                    : 'bg-[#1E3A5F] border-[#12263E] text-[#F4EFE6]'
                }`}
                title={`Nævning ${idx + 1}: hælder mod ${votesPros ? 'Anklager' : 'Forsvarer'}`}
              >
                {votesPros ? 'A' : 'F'}
              </span>
            );
          })}
        </div>

        <div className="text-[#5A4F42] tabular-nums">
          Snit · Anklager {persuasion.prosecutionCoherence}/100 · Forsvarer{' '}
          {persuasion.defenseCoherence}/100
        </div>
      </div>

      <p className="text-[11px] text-[#4A4035] leading-snug border-t border-[#E5DEC9] pt-1.5">
        {persuasion.evidenceMomentumNote}
      </p>
    </div>
  );
}

export function AiCharacterGallery({
  opposingRole,
}: {
  opposingRole: CourtRole;
}) {
  const [filter, setFilter] = useState<'all' | 'counsel' | 'jury'>('all');

  const filtered = AI_CHARACTER_PROFILES.filter((p) =>
    filter === 'all' ? true : p.category === filter
  );

  return (
    <div data-testid="ai-character-gallery" className="space-y-2.5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-[#7C2D2D]" />
          <span className="font-serif font-bold text-sm text-[#1C1917]">
            AI-karaktergalleri · Modparter & Nævningebænk
          </span>
        </div>
        <div className="flex gap-1 font-mono text-[10px]">
          {(
            [
              { id: 'all', label: 'Alle (5)' },
              { id: 'counsel', label: 'AI-Modparter (2)' },
              { id: 'jury', label: 'AI-Juryen (3)' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-2 py-0.5 border rounded-[2px] cursor-pointer ${
                filter === f.id
                  ? 'bg-[#1C1917] text-[#F4EFE6] border-[#1C1917]'
                  : 'bg-[#EAE3D5] text-[#4A4035] border-[#B6A992] hover:bg-[#DFD6C4]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1 court-scroll">
        {filtered.map((char) => {
          const isActiveOpponent =
            (char.id === 'ai-prosecutor' && opposingRole === 'Anklager') ||
            (char.id === 'ai-defender' && opposingRole === 'Forsvarer');

          return (
            <article
              key={char.id}
              data-testid={`character-card-${char.id}`}
              className={`p-2 border rounded-[2px] flex gap-2.5 bg-[#FBF8F3] ${
                isActiveOpponent ? 'border-[#7C2D2D]' : 'border-[#C8BCA8]'
              }`}
            >
              <div className="w-20 h-24 shrink-0 border border-[#8E7F6B] rounded-[2px] overflow-hidden bg-[#EAE3D5] relative">
                <Image
                  src={char.portraitSrc}
                  alt={`${char.name} – ${char.title}`}
                  width={80}
                  height={96}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-top"
                />
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span
                    className={`px-1.5 py-0.5 text-[9px] font-mono uppercase border rounded-[2px] ${
                      char.category === 'counsel'
                        ? char.id === 'ai-prosecutor'
                          ? 'bg-[#F3E5E5] border-[#7C2D2D] text-[#5B1D1D]'
                          : 'bg-[#E3EAF2] border-[#1E3A5F] text-[#162C47]'
                        : 'bg-[#EAE3D5] border-[#9F927E] text-[#4A4035]'
                    }`}
                  >
                    {char.roleBadge}
                  </span>
                  {isActiveOpponent && (
                    <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#7C2D2D] text-[#F4EFE6] rounded-[2px]">
                      Aktiv modpart
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="font-serif font-bold text-xs text-[#1C1917] leading-tight">
                    {char.name}
                  </h4>
                  <p className="text-[10px] font-mono text-[#5A4F42]">
                    {char.title} · {char.seatLabel}
                  </p>
                </div>

                <p className="text-[11px] text-[#2A241E] leading-snug">{char.backstory}</p>

                <div className="pt-1 border-t border-[#E5DEC9] space-y-0.5 text-[10px] leading-snug">
                  <p className="text-[#4A4035]">
                    <span className="font-bold text-[#1C1917]">Stil:</span> {char.rhetoricStyle}
                  </p>
                  <p className="text-[#234E3D] flex items-start gap-1">
                    <Sparkles className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>
                      <strong>Overbevises af:</strong> {char.persuasionTrigger}
                    </span>
                  </p>
                  <p className="text-[#7C2D2D] flex items-start gap-1">
                    <ShieldAlert className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>
                      <strong>Svaghed:</strong> {char.weakness}
                    </span>
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
