import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { LegalCase, TranscriptEntry } from '@/lib/types';

function createClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY er ikke konfigureret på serveren.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('503') || raw.includes('UNAVAILABLE')) {
    return 'AI-modellen oplever midlertidig spidsbelastning (503). Prøv igen om et øjeblik.';
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return 'Kvotegrænse nået (429). Vent et øjeblik eller kontroller API-nøglen under Settings > Secrets.';
  }
  if (raw.includes('403') || raw.includes('400') || raw.includes('API_KEY_INVALID')) {
    return 'Ugyldig eller manglende Gemini API-nøgle under Settings > Secrets.';
  }
  return raw;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('503 Timeout under AI-kald')), ms)
    ),
  ]);
}

async function generateFastWithFallback(
  ai: GoogleGenAI,
  params: Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'>
) {
  // Try gemini-4-hydrogen with ThinkingLevel.LOW for lowest latency,
  // then immediately fall back to gemini-3.1-flash-lite if overloaded/timed out.
  try {
    return await withTimeout(
      ai.models.generateContent({
        ...params,
        model: 'gemini-4-hydrogen',
        config: {
          ...params.config,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      }),
      6500
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTransient =
      msg.includes('503') ||
      msg.includes('UNAVAILABLE') ||
      msg.includes('429') ||
      msg.includes('Timeout');
    if (!isTransient) throw err;

    return await withTimeout(
      ai.models.generateContent({
        ...params,
        model: 'gemini-3.1-flash-lite',
        config: {
          ...params.config,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
      }),
      6500
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      mode: 'opponent_turn' | 'final_verdict';
      legalCase: LegalCase;
      playerRole: string;
      opponentRole?: string;
      transcript: TranscriptEntry[];
      playerLastText?: string;
      isCrossExam?: boolean;
    };

    const ai = createClient();

    if (body.mode === 'opponent_turn') {
      const oppRole =
        body.opponentRole || (body.playerRole === 'Anklager' ? 'Forsvarer' : 'Anklager');
      const evidenceList = body.legalCase.evidence
        .map(
          (e) =>
            `- ${e.id}: ${e.title} (vægt ${e.reliabilityWeight}/10, støtter ${e.supports}): ${e.summary}`
        )
        .join('\n');

      const transcriptText = body.transcript
        .slice(-8)
        .map((t) => `${t.speakerRole}: "${t.text}"`)
        .join('\n');

      const prompt = `Sag: ${body.legalCase.caseNumber} – ${body.legalCase.title}
Anklage: ${body.legalCase.charge}
Resumé: ${body.legalCase.summary}
Tilgængelige bilag:
${evidenceList}

Seneste retsbog:
${transcriptText}

Du spiller rollen som ${oppRole} i en dansk retssal.
Svar kort, skarpt og logisk sammenhængende på dansk (maks 2-3 sætninger) direkte på modpartens seneste indlæg. Henvis kun til faktiske bilag, hvis det giver logisk mening. Brug ikke floskler.`;

      const response = await generateFastWithFallback(ai, {
        contents: prompt,
        config: {
          systemInstruction:
            'Du er en erfaren dansk procesadvokat eller dommer i spillet Retsspillet. Svar altid på præcist, professionelt dansk i JSON.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: 'Kort, skarpt og logisk dansk indlæg i retten.',
              },
              citedEvidenceId: {
                type: Type.STRING,
                description: 'ID på det mest relevante bilag hvis nævnt, ellers tom streng.',
              },
              isObjection: {
                type: Type.BOOLEAN,
                description: 'True hvis indlægget er en formel indsigelse mod irrelevans.',
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        reply?: string;
        citedEvidenceId?: string;
        isObjection?: boolean;
      };

      return NextResponse.json({
        reply:
          parsed.reply ||
          'Retten noterer modpartens synspunkt, men fastholder at bevisbyrden ikke er løftet.',
        citedEvidenceId: parsed.citedEvidenceId || '',
        isObjection: Boolean(parsed.isObjection),
      });
    }

    if (body.mode === 'final_verdict') {
      const transcriptSummary = body.transcript
        .map(
          (t) =>
            `[${t.phase}] ${t.speakerRole} (kohærens=${t.evaluation?.turnScore ?? '-'}): ${t.text}`
        )
        .join('\n');

      const prompt = `Sag: ${body.legalCase.caseNumber} – ${body.legalCase.title}
Anklage: ${body.legalCase.charge}
Nøglespørgsmål: ${body.legalCase.coreIssues.join(', ')}

Fuldt retsreferat:
${transcriptSummary}

Vurder som uafhængig AI-jury og dansk dommer hvem der har ført den mest logisk sammenhængende og bedst underbyggede sag. Husk: ordmængde og irrelevante bilag giver IKKE point – kun logisk kohærens, primærbevisers vægt og afdækning af modsigelser. I straffesager kræver anklagerens sejr overbevisning ud over rimelig tvivl.`;

      const response = await generateFastWithFallback(ai, {
        contents: prompt,
        config: {
          systemInstruction:
            'Du er både den 6-mand store danske AI-jury og den præsiderende dommer. Returner udelukkende struktureret JSON på dansk.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              juryReasoning: {
                type: Type.STRING,
                description: 'Juryens samlede vurdering af bevisvægt og argumenter (2-3 sætninger).',
              },
              judgeReasoning: {
                type: Type.STRING,
                description: 'Dommerens begrundede afgørelse (2-4 sætninger).',
              },
              strengths: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2 konkrete styrker ved spillerens argumentation.',
              },
              improvements: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '1-2 konkrete forbedringspunkter til næste sag.',
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return NextResponse.json(parsed);
    }

    return NextResponse.json({ error: 'Ukendt evalueringstilstand.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: formatGeminiError(err) }, { status: 500 });
  }
}
