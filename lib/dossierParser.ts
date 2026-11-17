import type { EvidenceItem, LearningLevel, LegalCase, WitnessItem } from './types';

export interface ParsedDossierResult {
  legalCase: LegalCase;
  rawTextLength: number;
  extractedExhibitsCount: number;
  extractedWitnessesCount: number;
}

/**
 * Intelligent parser that turns uploaded case documents, legal files,
 * or raw dossier text into a fully structured, playable LegalCase for Retsspillet.
 */
export function parseDossierText(
  rawText: string,
  fileName = 'Uploadet_sagsakt.txt'
): ParsedDossierResult {
  const cleaned = rawText.trim();
  const lines = cleaned.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // 1. Detect Title
  let title = '';
  const titleLine = lines.find((l) =>
    /^(sag|titel|sagstitel|retsag|emne):\s*(.+)/i.test(l)
  );
  if (titleLine) {
    title = titleLine.replace(/^(sag|titel|sagstitel|retsag|emne):\s*/i, '').trim();
  } else {
    // Check first non-empty line
    const first = lines[0] ?? 'Brugerdefineret Retssag';
    title = first.replace(/^#+\s*/, '').slice(0, 60);
  }
  if (!title || title.length < 3) {
    title = fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
  }

  // 2. Detect Case Number
  const caseNumLine = lines.find((l) => /^(?:sagsnummer|sagsnr|case\s*no):\s*(.+)/i.test(l));
  let caseNumber = '';
  if (caseNumLine) {
    const rawNum = caseNumLine.replace(/^(?:sagsnummer|sagsnr|case\s*no):\s*/i, '').trim();
    caseNumber = rawNum.startsWith('#') ? rawNum : `#${rawNum}`;
  } else {
    const caseNumMatch = cleaned.match(/#([A-Z0-9_-]{3,16})/i);
    caseNumber = caseNumMatch
      ? `#${caseNumMatch[1].toUpperCase()}`
      : `#CUST-${Math.floor(100 + Math.random() * 900)}`;
  }

  // 3. Detect Charges / Straffelovsovertrædelse
  let charge = '';
  const chargeMatch = cleaned.match(
    /(?:straffelovens?\s*§\s*\d+[a-z]?(?:\s*stk\.\s*\d+)?|overtrædelse\s*af[^.\n]+|anklage:\s*[^.\n]+)/i
  );
  if (chargeMatch) {
    charge = chargeMatch[0].replace(/^anklage:\s*/i, '').trim();
  } else {
    charge = 'Straffelovens § 276 (Berigelsesforbrydelse / Tyveri)';
  }

  // 4. Detect Defendant
  let defendantName = 'Tiltalte';
  const defLine = lines.find((l) => /^(?:tiltalte|sigtede|anklagede):\s*(.+)/i.test(l));
  if (defLine) {
    defendantName = defLine.replace(/^(?:tiltalte|sigtede|anklagede):\s*/i, '').trim();
  }

  // 5. Detect Summary
  let summary = '';
  const summaryBlock = cleaned.match(/(?:resumé|faktum|hændelsesforløb|sagsbeskrivelse):\s*([^]+?)(?=\n\s*(?:bilag|vidner|anklage|$))/i);
  if (summaryBlock) {
    summary = summaryBlock[1].trim().slice(0, 450);
  } else {
    // Pick the longest paragraph
    const paragraphs = cleaned.split(/\n\s*\n/).map((p) => p.trim());
    const candidate = paragraphs.find((p) => p.length > 80 && !p.startsWith('Bilag') && !p.startsWith('Vidne'));
    summary = candidate ? candidate.slice(0, 400) : cleaned.slice(0, 300);
  }

  // 6. Extract Exhibits / Bilag
  const exhibits: EvidenceItem[] = [];
  // Match patterns like: "Bilag A: ...", "Bilag 1: ...", "Dokument 1: ..."
  const exhibitRegex = /(?:bilag|exhibit|dokument)\s+([A-Z0-9]+)[:\s-]+([^\n]+)(?:\n\s*([^]+?)(?=(?:bilag|exhibit|dokument|vidne|$)))?/gi;
  let exMatch: RegExpExecArray | null;

  while ((exMatch = exhibitRegex.exec(cleaned)) !== null) {
    const letterOrNum = exMatch[1].toUpperCase();
    const exTitle = `Bilag ${letterOrNum}: ${exMatch[2].trim()}`;
    const exBody = exMatch[3] ? exMatch[3].trim() : exMatch[2].trim();

    // Determine type
    const lower = `${exTitle} ${exBody}`.toLowerCase();
    const type: EvidenceItem['type'] =
      /kamera|overvågning|foto|billede|video/i.test(lower)
        ? 'surveillance'
        : /log|nøgle|adgang|server|gps|signal|tele/i.test(lower)
          ? 'technical'
          : /vidne|forklaring|udsagn/i.test(lower)
            ? 'testimony'
            : /kvittering|faktura|kontoudtog|mail/i.test(lower)
              ? 'document'
              : 'document';

    // Reliability weight
    let weight = 7;
    if (/primærbevis|adgangslog|dna|fingeraftryk|kamera kl\.|stempling/i.test(lower)) weight = 9;
    else if (/kvittering|kontoudtog|tidsstempel/i.test(lower)) weight = 8;
    else if (/gammel|udateret|uoverensstemmelse|usikker/i.test(lower)) weight = 4;

    const isIrrelevant = /gammel|uvedkommende|irrelevant|ikke relateret/i.test(lower);
    const supports = /usikker|alibi|frifindelse|modbevis|fravær/i.test(lower)
      ? 'defense'
      : /gerningssted|matchende|skyld|pågrebet|nøglekort/i.test(lower)
        ? 'prosecution'
        : 'neutral';

    exhibits.push({
      id: `ev-cust-${exhibits.length + 1}-${Date.now()}`,
      title: exTitle.slice(0, 55),
      type,
      summary: exBody.slice(0, 120),
      detail: exBody.slice(0, 350),
      reliabilityWeight: isIrrelevant ? 3 : weight,
      isIrrelevant,
      supports,
      contradictionHint: /modstrid|men kl|uoverensstemmelse/i.test(lower)
        ? 'Indeholder tidsmæssig eller fysisk uoverensstemmelse med sagens øvrige forklaringer.'
        : undefined,
      keywords: exTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 3).slice(0, 4),
    });
  }

  // Fallback: If no explicit "Bilag" was detected, create 3 structured exhibits from lines/paragraphs
  if (exhibits.length === 0) {
    const paragraphs = cleaned.split(/\n\s*\n/).filter((p) => p.length > 25);
    exhibits.push({
      id: `ev-cust-1-${Date.now()}`,
      title: 'Bilag A: Hovedrapport & Gerningsstedsnotat',
      type: 'document',
      summary: (paragraphs[0] || summary).slice(0, 110),
      detail: (paragraphs[0] || summary).slice(0, 350),
      reliabilityWeight: 9,
      supports: 'prosecution',
      keywords: ['rapport', 'gerningssted', 'hændelse'],
    });

    if (paragraphs[1]) {
      exhibits.push({
        id: `ev-cust-2-${Date.now()}`,
        title: 'Bilag B: Tidsstempling & Registrering',
        type: 'technical',
        summary: paragraphs[1].slice(0, 110),
        detail: paragraphs[1].slice(0, 350),
        reliabilityWeight: 8,
        supports: 'neutral',
        keywords: ['tidsstempel', 'registrering', 'log'],
      });
    }

    if (paragraphs[2]) {
      exhibits.push({
        id: `ev-cust-3-${Date.now()}`,
        title: 'Bilag C: Modforklaring & Alibidokument',
        type: 'document',
        summary: paragraphs[2].slice(0, 110),
        detail: paragraphs[2].slice(0, 350),
        reliabilityWeight: 6,
        supports: 'defense',
        keywords: ['alibi', 'forklaring', 'forsvar'],
      });
    }
  }

  // 7. Extract Witnesses
  const witnesses: WitnessItem[] = [];
  const witnessRegex = /vidne(?:\s*\d+)?:\s*([A-ZÆØÅ][a-zæøå]+(?:\s+[A-ZÆØÅ][a-zæøå]+)*)\s*(?:\(([^)]+)\))?[:\s-]+([^\n]+)/gi;
  let witMatch: RegExpExecArray | null;

  while ((witMatch = witnessRegex.exec(cleaned)) !== null) {
    const name = witMatch[1].trim();
    const roleTitle = witMatch[2] ? witMatch[2].trim() : 'Nøglevidne';
    const statement = witMatch[3].trim();
    witnesses.push({
      id: `wit-cust-${witnesses.length + 1}-${Date.now()}`,
      name,
      roleTitle,
      statement: statement.slice(0, 250),
      weakness: 'Forklaringen bærer præg af subjektiv observation og kan udfordres på belysningsforhold eller tidsnøjagtighed.',
      supports: /alibi|hjemme|ikke set/i.test(statement) ? 'defense' : 'prosecution',
    });
  }

  // Build LegalCase
  const legalCase: LegalCase = {
    id: `custom-case-${Date.now()}`,
    caseNumber,
    title,
    category: 'Brugerdefineret Sag',
    difficulty: 'Øvet' as LearningLevel,
    source: 'Egen sag',
    summary,
    charge,
    defendantName,
    prosecutionGoal: 'Dokumentér gerningsindholdet og tiltaltes tilstedeværelse via de fremlagte primærbeviser.',
    defenseGoal: 'Skab rimelig tvivl gennem påvisning af modstridende tidsangivelser og manglende entydig identifikation.',
    coreIssues: [
      'Identifikation af gerningsmand',
      'Tidslinjens sammenhæng',
      'Beviskraft i tekniske registreringer',
    ],
    rewardCredits: 350,
    witnesses,
    evidence: exhibits,
  };

  return {
    legalCase,
    rawTextLength: cleaned.length,
    extractedExhibitsCount: exhibits.length,
    extractedWitnessesCount: witnesses.length,
  };
}

/**
 * Built-in demo template for Custom Gamemode so users can instantly test uploading
 * a complex real-world legal dossier with multiple forensic documents.
 */
export const DEMO_CUSTOM_DOSSIER = `SAG: Kunsttyveriet på Glyptoteket
SAGSNUMMER: #KUNST-882
ANKLAGE: Straffelovens § 276a (Grovt tyveri af historisk bronzestatue til værdi 420.000 kr.)
TILTALTE: Emilie Vestergaard

RESUMÉ:
Natten til lørdag kl. 01:45 blev museets alarmsensor i Fløj B udløst. En antik fransk bronzestatue blev fjernet fra sin sokkel. Tiltalte blev anholdt to gader derfra kl. 02:08 med en sportstaske, men hævder at have været på vej hjem fra et atelier i nabogaden.

BILAG A: Sikkerhedsvagtens Logbog kl. 01:45
Vagten noterede alarmsignal i Fløj B kl. 01:45:12. Nøddøren mod baggården stod ulåst.

BILAG B: Overvågningskamera Fløj B kl. 01:43
Kameraet viser en hætteklædt skikkelse med højde ca. 175 cm og mørk rygsæk forlade rummet kl. 01:43:50. Billedet er kornet grundet dæmpet natbelysning.

BILAG C: Metro-stempling kl. 01:15
Rejsekort-udskrift viser stempling på Kongens Nytorv station kl. 01:15:30. Tiltalte hævder at have taget metroen direkte mod sit hjem.

BILAG D: Gammelt kaffebar-menukort
Menukort fra en café i Århus fundet i lommen, dateret for to måneder siden. Uden relevans for gerningstidspunktet.

VIDNE: Lars Brixen (Natvægter)
"Jeg hørte en metallisk lyd kl. 01:44 og løb mod Fløj B, hvor montren var tom og døren smækket i."
`;
