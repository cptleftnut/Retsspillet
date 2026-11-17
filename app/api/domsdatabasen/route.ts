import { NextRequest, NextResponse } from 'next/server';
import type { LegalCase } from '@/lib/types';

const DOMSDATABASEN_CATALOG: LegalCase[] = [
  {
    id: 'doms-bs-2025-114',
    caseNumber: 'BS-114/2025',
    title: 'Afslag på dækning efter vandskade i kælder',
    category: 'Erstatning & Forsikring',
    difficulty: 'Øvet',
    source: 'Domsdatabasen.dk',
    externalUrl: 'https://domsdatabasen.dk',
    summary:
      'En husejer krævede fuld erstatning efter skybrud i kælder. Forsikringsselskabet afviste delvist med henvisning til manglende vedligeholdelse af højvandslukke.',
    charge: 'Civilt søgsmål om forsikringsdækning på 142.000 kr. jf. forsikringsaftaleloven.',
    prosecutionGoal: 'Dokumenter at højvandslukket ikke var serviceret i 6 år og udgør grov forsømmelse.',
    defenseGoal: 'Vis at skybruddet oversteg det kommunale kloaknets kapacitet uafhængigt af ventilen.',
    defendantName: 'Bygge & Bo Ejendomme ApS',
    coreIssues: ['højvandslukke', 'service', 'skybrud', 'årsagssammenhæng', 'forsikring'],
    rewardCredits: 340,
    witnesses: [
      {
        id: 'w-vvs',
        name: 'Kaj Sørensen',
        roleTitle: 'Autoriseret kloakmester',
        statement: 'Klapventilen sad fast i kalkaflejringer, hvilket tyder på flere års manglende rensning.',
        weakness: 'Kunne ikke udelukke at trykket fra hovedledningen ville have løftet en ren ventil.',
        supports: 'prosecution',
      },
    ],
    evidence: [
      {
        id: 'ev-dmi',
        title: 'DMI Nedbørsrapport (48 mm / 30 min)',
        type: 'document',
        summary: 'Ekstremregn langt over 100-års hændelse i bydelen.',
        detail: 'Bekræfter at vandstanden i gaden steg 45 cm over kælderniveau på 20 minutter.',
        reliabilityWeight: 9,
        supports: 'defense',
        keywords: ['dmi', 'skybrud', '48 mm', 'kapacitet'],
      },
      {
        id: 'ev-syn',
        title: 'Skønsrapport om højvandslukke',
        type: 'physical',
        summary: 'Dokumentation af manglende årligt eftersyn siden 2019.',
        detail: 'Forsikringsbetingelsernes pkt. 4.2 kræver dokumenteret årlig rensning.',
        reliabilityWeight: 9,
        supports: 'prosecution',
        keywords: ['højvandslukke', 'eftersyn', '2019', 'betingelser'],
      },
    ],
  },
  {
    id: 'doms-ss-2025-882',
    caseNumber: 'SS-882/2025',
    title: 'Ulovlig droneflyvning over havneanlæg',
    category: 'Strafferet & Luftfart',
    difficulty: 'Dommer',
    source: 'Domsdatabasen.dk',
    externalUrl: 'https://domsdatabasen.dk',
    summary:
      'En hobbyfotograf blev sigtet for at flyve inden for sikkerhedszonen ved et erhvervshavneanlæg. Tiltalte hævder GPS-drift pga. kraftig vind.',
    charge: 'Overtrædelse af bekendtgørelse om droneflyvning i bymæssig og sikret zone.',
    prosecutionGoal: 'Dokumenter manuel styring ind i zonen ud fra flyveloggens stick-input.',
    defenseGoal: 'Godtgør pludselige vindstød og automatisk RTH-fejl (Return-To-Home).',
    defendantName: 'Emil Krog',
    coreIssues: ['flyvelog', 'vindstød', 'sikkerhedszone', 'stick', 'manuel'],
    rewardCredits: 420,
    witnesses: [
      {
        id: 'w-havn',
        name: 'Bo Lindberg',
        roleTitle: 'Havnevagt',
        statement: 'Dronen hang stille over kajanlægget i næsten to minutter før den fløj væk.',
        weakness: 'Så ikke fjernbetjeningen eller pilotens position.',
        supports: 'prosecution',
      },
    ],
    evidence: [
      {
        id: 'ev-flightlog',
        title: 'Drone Flight Controller Log (.csv)',
        type: 'digital',
        summary: 'Viser aktivt manuelt pitch/throttle-input ind over havnehegnet.',
        detail: 'Flight mode stod i "Sport" (GPS-assisteret manuel), ikke "Atti" eller RTH.',
        reliabilityWeight: 10,
        supports: 'prosecution',
        keywords: ['flyvelog', 'sport', 'manuel', 'input'],
        contradictionHint: 'Modstrider tiltaltes forklaring om passiv vinddrift.',
      },
      {
        id: 'ev-wind',
        title: 'Anemometer måling fra mole',
        type: 'document',
        summary: 'Vindstød op til 13 m/s i kystzonen kl. 16:20.',
        detail: 'Stærk sidevind, men inden for dronens maksimale vindmodstand (15 m/s).',
        reliabilityWeight: 6,
        supports: 'defense',
        keywords: ['vindstød', '13 m/s', 'sidevind'],
      },
    ],
  },
];

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase();
  const filtered = !query
    ? DOMSDATABASEN_CATALOG
    : DOMSDATABASEN_CATALOG.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          c.category.toLowerCase().includes(query) ||
          c.caseNumber.toLowerCase().includes(query) ||
          c.summary.toLowerCase().includes(query)
      );

  return NextResponse.json({
    source: 'Domsdatabasen.dk',
    count: filtered.length,
    cases: filtered,
  });
}
