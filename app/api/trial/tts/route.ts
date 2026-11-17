import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import type { VoiceProfileId } from '@/lib/types';

const VALID_VOICES = new Set<VoiceProfileId>(['Charon', 'Fenrir', 'Kore', 'Puck', 'Zephyr']);

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY mangler til Gemini TTS.' },
        { status: 500 }
      );
    }

    const body = (await req.json()) as {
      text: string;
      voiceName?: VoiceProfileId;
      role?: string;
    };

    const text = (body.text || '').trim().slice(0, 700);
    if (!text) {
      return NextResponse.json({ error: 'Ingen tekst at oplæse.' }, { status: 400 });
    }

    const voiceName: VoiceProfileId =
      body.voiceName && VALID_VOICES.has(body.voiceName) ? body.voiceName : 'Kore';

    const ai = new GoogleGenAI({
      apiKey,
      apiVersion: 'v1beta',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const runTts = (withSpeechConfig: boolean) =>
      Promise.race([
        ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [{ text }],
            },
          ],
          config: withSpeechConfig
            ? {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName },
                  },
                },
              }
            : {
                responseModalities: ['AUDIO'],
              },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TTS timeout')), 5000)
        ),
      ]);

    let response;
    try {
      response = await runTts(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('speechConfig') || msg.includes('INVALID_ARGUMENT')) {
        response = await runTts(false);
      } else {
        throw err;
      }
    }

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return NextResponse.json(
        { error: 'Modtog ingen lyddata fra Gemini TTS.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      voiceName,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'TTS fejlede.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
