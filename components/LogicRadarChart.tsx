'use client';

import React from 'react';
import { Compass, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { LogicRadarMetrics } from '@/lib/types';

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleIndex: number,
  total: number
) {
  const angle = -Math.PI / 2 + (angleIndex * 2 * Math.PI) / total;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

export function LogicRadarChart({ metrics }: { metrics: LogicRadarMetrics }) {
  const cx = 170;
  const cy = 114;
  const maxR = 68;
  const n = metrics.axes.length;

  const gridLevels = [25, 50, 75, 100];

  const buildPolygonPoints = (values: number[]) =>
    values
      .map((val, idx) => {
        const r = (Math.max(6, Math.min(100, val)) / 100) * maxR;
        const pt = polarToCartesian(cx, cy, r, idx, n);
        return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      })
      .join(' ');

  const playerPoints = buildPolygonPoints(metrics.axes.map((a) => a.playerScore));
  const evidencePoints = buildPolygonPoints(metrics.axes.map((a) => a.evidenceBenchmark));

  return (
    <div
      data-testid="logic-radar-panel"
      className="p-2.5 bg-[#FBF8F3] border border-[#C8BCA8] rounded-[2px] space-y-2.5 text-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5DEC9] pb-1.5">
        <div className="flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-[#7C2D2D]" />
          <span className="font-serif font-bold text-sm text-[#1C1917]">
            Logik-radar · Argumentation vs. Bevisvægt
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px]">
          <span className="inline-flex items-center gap-1 text-[#7C2D2D] font-bold">
            <span className="w-2.5 h-2.5 bg-[#7C2D2D]/40 border border-[#7C2D2D] inline-block" />
            Dine argumenter ({metrics.overallStrength}%)
          </span>
          <span className="inline-flex items-center gap-1 text-[#1E3A5F] font-bold">
            <span className="w-2.5 h-2.5 bg-[#1E3A5F]/25 border border-dashed border-[#1E3A5F] inline-block" />
            Bevispålidelighed ({metrics.collectedEvidenceAvgReliability}%)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Pentagon Radar SVG */}
        <div className="md:col-span-5 flex justify-center">
          <svg
            data-testid="logic-radar-svg"
            viewBox="0 0 340 228"
            className="w-full max-w-[300px] h-auto select-none"
            role="img"
            aria-label="Logik-radar der sammenholder argumenter med bevisernes pålidelighed"
          >
            {/* Concentric pentagon grid rings */}
            {gridLevels.map((lvl) => {
              const pts = Array.from({ length: n })
                .map((_, idx) => {
                  const pt = polarToCartesian(cx, cy, (lvl / 100) * maxR, idx, n);
                  return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
                })
                .join(' ');
              return (
                <polygon
                  key={lvl}
                  points={pts}
                  fill={lvl === 100 ? '#F4EFE6' : 'none'}
                  stroke="#D5C9B6"
                  strokeWidth={lvl === 100 ? 1.2 : 0.8}
                />
              );
            })}

            {/* Axis spokes + labels */}
            {metrics.axes.map((axis, idx) => {
              const outer = polarToCartesian(cx, cy, maxR, idx, n);
              const labelPos = polarToCartesian(cx, cy, maxR + 20, idx, n);
              const anchor =
                Math.abs(labelPos.x - cx) < 12
                  ? 'middle'
                  : labelPos.x > cx
                    ? 'start'
                    : 'end';
              return (
                <g key={axis.key}>
                  <line
                    x1={cx}
                    y1={cy}
                    x2={outer.x}
                    y2={outer.y}
                    stroke="#C8BCA8"
                    strokeWidth="0.9"
                  />
                  <text
                    x={labelPos.x}
                    y={labelPos.y + 3}
                    textAnchor={anchor}
                    className="fill-[#2A241E] text-[9px] font-mono font-semibold"
                  >
                    {axis.label}
                  </text>
                </g>
              );
            })}

            {/* Collected Evidence Reliability Benchmark Polygon */}
            <polygon
              data-testid="radar-evidence-polygon"
              points={evidencePoints}
              fill="#1E3A5F"
              fillOpacity="0.16"
              stroke="#1E3A5F"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />

            {/* Player Argument Profile Polygon */}
            <polygon
              data-testid="radar-player-polygon"
              points={playerPoints}
              fill="#7C2D2D"
              fillOpacity="0.28"
              stroke="#7C2D2D"
              strokeWidth="2"
            />

            {/* Vertex data dots */}
            {metrics.axes.map((axis, idx) => {
              const pt = polarToCartesian(
                cx,
                cy,
                (Math.max(6, axis.playerScore) / 100) * maxR,
                idx,
                n
              );
              return (
                <circle
                  key={`dot-${axis.key}`}
                  cx={pt.x}
                  cy={pt.y}
                  r="3"
                  fill="#7C2D2D"
                  stroke="#FBF8F3"
                  strokeWidth="1"
                />
              );
            })}
          </svg>
        </div>

        {/* Axis breakdown + Real-time Strong / Weak diagnostics */}
        <div className="md:col-span-7 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {metrics.axes.map((axis) => (
              <div
                key={axis.key}
                className="px-2 py-1 bg-[#F4EFE6] border border-[#D5C9B6] rounded-[2px]"
              >
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="font-semibold text-[#1C1917]">{axis.label}</span>
                  <span className="tabular-nums">
                    <strong className="text-[#7C2D2D]">{axis.playerScore}</strong>
                    <span className="text-[#8E7F6B]"> / {axis.evidenceBenchmark}</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full bg-[#E5DEC9] rounded-[1px] overflow-hidden relative">
                  <div
                    className="h-full bg-[#1E3A5F]/40 absolute left-0 top-0"
                    style={{ width: `${axis.evidenceBenchmark}%` }}
                  />
                  <div
                    className="h-full bg-[#7C2D2D] relative"
                    style={{ width: `${axis.playerScore}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <div className="p-2 bg-[#F4EFE6] border border-[#234E3D]/40 rounded-[2px] space-y-1">
              <p className="font-mono text-[10px] font-bold uppercase text-[#234E3D] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Stærke punkter
              </p>
              {metrics.strongPoints.length > 0 ? (
                <ul className="space-y-0.5 text-[11px] text-[#1C1917]">
                  {metrics.strongPoints.map((pt, i) => (
                    <li key={i}>• {pt}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-[#5A4F42]">
                  Fremfør dit første argument for at opbygge dokumenterede styrker.
                </p>
              )}
            </div>

            <div className="p-2 bg-[#F4EFE6] border border-[#7C2D2D]/40 rounded-[2px] space-y-1">
              <p className="font-mono text-[10px] font-bold uppercase text-[#7C2D2D] flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Svage punkter
              </p>
              {metrics.weakPoints.length > 0 ? (
                <ul className="space-y-0.5 text-[11px] text-[#1C1917]">
                  {metrics.weakPoints.map((pt, i) => (
                    <li key={i}>• {pt}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-[#234E3D]">
                  Ingen svagheder registreret — bevisførelsen er skarp.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
