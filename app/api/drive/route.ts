import { NextRequest, NextResponse } from 'next/server';
import type { EvidenceItem, LegalCase } from '@/lib/types';

interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) return null;
  return header.slice(7).trim() || null;
}

async function fetchDriveFileText(file: DriveFileMeta, token: string): Promise<string> {
  const isGoogleDoc = file.mimeType === 'application/vnd.google-apps.document';
  const url = isGoogleDoc
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=text/plain`
    : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Kunne ikke læse filen "${file.name}" (${res.status}).`);
  }
  return await res.text();
}

function extractKeywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 4)
    )
  ).slice(0, 6);
}

export async function GET(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json(
      { error: 'Manglende Google Drive Authorization Bearer token.' },
      { status: 401 }
    );
  }

  const folderId = req.nextUrl.searchParams.get('folderId') || 'root';
  const safeFolderId = folderId.replace(/[^a-zA-Z0-9_-]/g, '') || 'root';
  const q = encodeURIComponent(
    `'${safeFolderId}' in parents and trashed = false and (` +
      `mimeType = 'application/vnd.google-apps.folder' or ` +
      `mimeType = 'application/vnd.google-apps.document' or ` +
      `mimeType = 'text/plain' or ` +
      `mimeType = 'text/markdown' or ` +
      `mimeType = 'text/csv' or ` +
      `mimeType = 'application/json'` +
      `)`
  );

  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,modifiedTime)&orderBy=folder,modifiedTime desc&pageSize=40`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return NextResponse.json(
      { error: `Google Drive API fejl (${res.status}): ${errText || 'Log venligst ind igen.'}` },
      { status: res.status }
    );
  }

  const data = (await res.json()) as { files?: DriveFileMeta[] };
  return NextResponse.json({ files: data.files ?? [] });
}

export async function POST(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json(
      { error: 'Manglende Google Drive Authorization Bearer token.' },
      { status: 401 }
    );
  }

  try {
    const body = (await req.json()) as
      | { mode: 'file'; file: DriveFileMeta }
      | { mode: 'folder'; folderId: string; folderName: string };

    if (body.mode === 'file') {
      const rawText = await fetchDriveFileText(body.file, token);
      const snippet =
        rawText.trim().slice(0, 420) || 'Importeret sagsdokument fra Google Drive.';
      const legalCase: LegalCase = {
        id: `drive-${body.file.id}`,
        caseNumber: `#GD-${body.file.id.slice(0, 4).toUpperCase()}`,
        title: body.file.name.replace(/\.[^.]+$/, ''),
        category: 'Google Drive Import',
        difficulty: 'Øvet',
        source: 'Google Drive',
        summary: snippet,
        charge: `Sagsforhold baseret på dokumentet "${body.file.name}".`,
        prosecutionGoal:
          'Fremlæg sammenhængende argumentation ud fra dokumentets faktiske oplysninger.',
        defenseGoal:
          'Påvis manglende bevisvægt eller alternative fortolkninger i dokumentet.',
        defendantName: 'Indklagede part',
        coreIssues: extractKeywords(snippet),
        rewardCredits: 300,
        witnesses: [],
        evidence: [
          {
            id: `ev-drive-${body.file.id}`,
            title: `Bilag 1: ${body.file.name}`,
            type: 'document',
            summary: snippet.slice(0, 120),
            detail: rawText.slice(0, 1800),
            reliabilityWeight: 8,
            supports: 'neutral',
            keywords: extractKeywords(rawText),
          },
        ],
      };
      return NextResponse.json({ legalCase });
    }

    if (body.mode === 'folder') {
      const safeFolderId = body.folderId.replace(/[^a-zA-Z0-9_-]/g, '');
      const q = encodeURIComponent(
        `'${safeFolderId}' in parents and trashed = false and (` +
          `mimeType = 'application/vnd.google-apps.document' or ` +
          `mimeType = 'text/plain' or ` +
          `mimeType = 'text/markdown' or ` +
          `mimeType = 'text/csv' or ` +
          `mimeType = 'application/json'` +
          `)`
      );
      const listUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,modifiedTime)&pageSize=10`;
      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!listRes.ok) {
        return NextResponse.json(
          { error: `Kunne ikke læse sagsmappe (${listRes.status}).` },
          { status: listRes.status }
        );
      }

      const { files = [] } = (await listRes.json()) as { files?: DriveFileMeta[] };
      if (files.length === 0) {
        return NextResponse.json(
          { error: 'Mappen indeholder ingen læsbare Google Docs eller tekstfiler.' },
          { status: 400 }
        );
      }

      const evidence: EvidenceItem[] = [];
      const combinedSnippets: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const text = await fetchDriveFileText(f, token);
        const cleaned = text.trim();
        combinedSnippets.push(`${f.name}: ${cleaned.slice(0, 180)}`);
        evidence.push({
          id: `ev-drive-${f.id}`,
          title: `Bilag ${i + 1}: ${f.name.replace(/\.[^.]+$/, '')}`,
          type: f.mimeType === 'application/json' ? 'digital' : 'document',
          summary: cleaned.slice(0, 120) || 'Importeret bilag fra sagsmappe.',
          detail: cleaned.slice(0, 1600) || 'Ingen læsbar tekst.',
          reliabilityWeight: i === 0 ? 9 : 7,
          supports: 'neutral',
          keywords: extractKeywords(cleaned || f.name),
        });
      }

      const summaryText = combinedSnippets.join(' | ').slice(0, 480);
      const legalCase: LegalCase = {
        id: `drive-folder-${safeFolderId}`,
        caseNumber: `#GDM-${safeFolderId.slice(0, 4).toUpperCase()}`,
        title: body.folderName || 'Google Drive Sagsmappe',
        category: `Google Drive Sagsmappe (${evidence.length} bilag)`,
        difficulty: 'Øvet',
        source: 'Google Drive',
        summary: summaryText,
        charge: `Samlet sagsmappe "${body.folderName}" med ${evidence.length} importerede sagsakter.`,
        prosecutionGoal:
          'Sammenkæd mappens bærende bilag kronologisk og dokumenter påstanden.',
        defenseGoal:
          'Udpeg huller, svage bilag eller uoverensstemmelser mellem mappens dokumenter.',
        defendantName: 'Indklagede part',
        coreIssues: extractKeywords(summaryText),
        rewardCredits: 340,
        witnesses: [],
        evidence,
      };

      return NextResponse.json({ legalCase });
    }

    return NextResponse.json({ error: 'Ugyldig importtype.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Google Drive import fejlede.' },
      { status: 500 }
    );
  }
}
