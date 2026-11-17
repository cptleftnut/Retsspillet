import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY mangler til server-transskription.' },
        { status: 500 }
      );
    }

    const body = (await req.json()) as {
      audioBase64: string;
      mimeType?: string;
    };

    if (!body.audioBase64) {
      return NextResponse.json({ error: 'Ingen lyddata modtaget.' }, { status: 400 });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await ai.models.generateContent({
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
            text: 'Transskriber denne danske retssals-indtaling ordret på dansk uden ekstra kommentarer.',
          },
        ],
      },
    });

    return NextResponse.json({ text: (response.text ?? '').trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transskription fejlede.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
