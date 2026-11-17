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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('503 Timeout under stemmebehandling')), ms)
    ),
  ]);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      audioBase64?: string;
      mimeType?: string;
      directText?: string;
      autoRespond?: boolean;
      legalCase?: LegalCase;
      playerRole?: string;
      opponentRole?: string;
      transcript?: TranscriptEntry[];
      isCrossExam?: boolean;
    };

    const ai = createClient();
    let transcriptText = (body.directText ?? '').trim();

    if (!transcriptText) {
      if (!body.audioBase64) {
        return NextResponse.json(
          { error: 'Ingen lyddata modtaget til stemme-stream.' },
          { status: 400 }
        );
      }

      const transcribeRes = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: body.mimeType || 'audio/webm',
                  data: body.audioBase64,
                },
              },
              {
                text: 'Transskriber denne danske retssals-tale ordret på dansk uden ekstra kommentarer. Hvis lyden kun er stilhed eller støj, svar med en tom streng.',
              },
            ],
          },
        }),
        6000
      );

      transcriptText = (transcribeRes.text ?? '').trim();
    }

    if (!transcriptText) {
      return NextResponse.json({ transcriptText: '', reply: null });
    }

    if (!body.autoRespond || !body.legalCase || transcriptText.length < 5) {
      return NextResponse.json({ transcriptText });
    }

    const oppRole =
      body.opponentRole || (body.playerRole === 'Anklager' ? 'Forsvarer' : 'Anklager');
    const evidenceList = body.legalCase.evidence
      .map(
        (e) =>
          `- ${e.id}: ${e.title} (vægt ${e.reliabilityWeight}/10, støtter ${e.supports}): ${e.summary}`
      )
      .join('\n');

    const recentHistory = (body.transcript ?? [])
      .slice(-6)
      .map((t) => `${t.speakerRole}: "${t.text}"`)
      .join('\n');

    const prompt = `Sag: ${body.legalCase.caseNumber} – ${body.legalCase.title}
Anklage: ${body.legalCase.charge}
Tilgængelige bilag:
${evidenceList}

Seneste retsreferat:
${recentHistory}
${body.playerRole || 'Spiller'}: "${transcriptText}"

Du spiller rollen som ${oppRole} i en live mundtlig forhandling i dansk ret.
Giv et kort, direkte, naturligt talt svar (1-2 sætninger) der reagerer præcist på det, modparten lige sagde.`;

    const genParams = {
      contents: prompt,
      config: {
        systemInstruction:
          'Du er en erfaren dansk procesadvokat eller dommer i fuld-dupleks samtale. Svar skarpt på dansk i JSON.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING },
            citedEvidenceId: { type: Type.STRING },
            isObjection: { type: Type.BOOLEAN },
          },
        },
      },
    };

    let oppResponse;
    try {
      oppResponse = await withTimeout(
        ai.models.generateContent({
          ...genParams,
          model: 'gemini-4-hydrogen',
          config: {
            ...genParams.config,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
        6000
      );
    } catch {
      oppResponse = await withTimeout(
        ai.models.generateContent({
          ...genParams,
          model: 'gemini-3.1-flash-lite',
          config: {
            ...genParams.config,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          },
        }),
        6000
      );
    }

    const parsed = JSON.parse((oppResponse.text ?? '{}').trim()) as {
      reply?: string;
      citedEvidenceId?: string;
      isObjection?: boolean;
    };

    return NextResponse.json({
      transcriptText,
      reply:
        parsed.reply ||
        'Retten noterer det anførte, men modparten fastholder kravet om konkret dokumentation.',
      citedEvidenceId: parsed.citedEvidenceId || '',
      isObjection: Boolean(parsed.isObjection),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stemmestream fejlede.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
