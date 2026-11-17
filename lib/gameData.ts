import type {
  AiCharacterProfile,
  JudgeIntroModule,
  LearningLevel,
  LegalCase,
  LegalTerm,
  RoleTutorialStepDef,
  ShopItem,
  TutorialRolePath,
} from './types';

export const ROLE_TUTORIAL_PATHS: Record<TutorialRolePath, RoleTutorialStepDef[]> = {
  Anklager: [
    {
      stepNumber: 1,
      rolePath: 'Anklager',
      title: '1. Bevisbyrde & Anklagestrategi',
      objective: 'Som anklager skal du bevise tiltaltes skyld ud over rimelig tvivl — tom snak giver minuspoint.',
      strategyTip: 'Start med stærke tekniske primærbeviser frem for gæt.',
      hint: 'Løs den interaktive øvelse nedenfor for at gå til næste trin.',
      requiredAction: 'ack',
      levelFocus: 'Begynder',
      simulation: {
        prompt: 'Du åbner anklagen i Sag #0001. Hvilket åbningsprincip giver højest retlig vægt?',
        options: [
          {
            label: 'Fremlæg straks bagerkvitteringen for at have mange bilag',
            isBest: false,
            feedback: 'Irrelevante bilag udløser advarsel fra dommeren og sænker din kohærensscore.',
          },
          {
            label: 'Byg en tidslinje fra adgangslog (21:12) til overvågning (21:14)',
            isBest: true,
            feedback: 'Korrekt. En stram kronologisk kæde med primærbeviser løfter bevisbyrden.',
          },
          {
            label: 'Gentag "tiltalte er skyldig" fem gange for at presse juryen',
            isBest: false,
            feedback: 'Gentagelser straffes automatisk af pointalgoritmen.',
          },
        ],
      },
    },
    {
      stepNumber: 2,
      rolePath: 'Anklager',
      title: '2. Analyser tiltalen i Sagsmappe',
      objective: 'Identificer hvad du konkret skal bevise under straffelovens § 276.',
      strategyTip: 'Kend både anklagerens og forsvarerens mål før du taler.',
      hint: 'Åbn fanen "Sagsmappe & Rolle" eller løs øvelsen herunder.',
      requiredAction: 'read_case',
      levelFocus: 'Begynder',
      simulation: {
        prompt: 'Hvad er anklagerens vigtigste mål i Sag #0001?',
        options: [
          {
            label: 'Koble nøglekort #14 og sene spærring til adgangen kl. 21:12',
            isBest: true,
            feedback: 'Præcist. Hvis kortet først blev spærret dagen efter, svækkes alibiet.',
          },
          {
            label: 'Bede vidnet Sofie Kragh om at ændre sin forklaring uden bevis',
            isBest: false,
            feedback: 'Udokumenteret pres uden modbevis giver lav evidensvægt.',
          },
        ],
      },
    },
    {
      stepNumber: 3,
      rolePath: 'Anklager',
      title: '3. Sorter primærbeviser fra støj',
      objective: 'Udpeg de bærende spor på bevisbordet og udelad bagerkvitteringen.',
      strategyTip: 'Maks 1-2 relevante bilag pr. indlæg giver den skarpeste vægtning.',
      hint: 'Klik på Bilag A (Adgangslog) i 3D-salen eller i fanen "Beviser".',
      requiredAction: 'inspect_evidence',
      levelFocus: 'Begynder',
      simulation: {
        prompt: 'Hvilket bilag på bordet har højest bevismæssig pålidelighed (vægt 9/10) for anklagen?',
        options: [
          {
            label: 'Bilag A: Elektronisk adgangslog for nøglekort #14 kl. 21:12:08',
            isBest: true,
            feedback: 'Korrekt. Elektroniske logdata med præcist tidsstempel er et stærkt primærbevis.',
          },
          {
            label: 'Bilag D: Gammel bagerkvittering fra tre dage før',
            isBest: false,
            feedback: 'Bilag D er et irrelevant vildspor (støj).',
          },
        ],
      },
    },
    {
      stepNumber: 4,
      rolePath: 'Anklager',
      title: '4. Byg et kausalt hovedargument',
      objective: 'Forbind bilaget logisk med årsagsord som "dokumenterer", "fordi" eller "sammenholdt".',
      strategyTip: 'Brug både tekstfeltet eller Fuld-dupleks / Indtal (Mic).',
      hint: 'Vælg Bilag A, fremfør dit argument i "Procedure & Indtal", og klik "Fremlæg".',
      requiredAction: 'submit_argument',
      levelFocus: 'Øvet',
      simulation: {
        prompt: 'Hvilken formulering scorer højest på logisk kohærens?',
        options: [
          {
            label: 'Jeg synes Mads tog cyklen fordi han har en hættetrøje.',
            isBest: false,
            feedback: 'Mangler direkte tidsstempel og dokumentation.',
          },
          {
            label: 'Bilag A dokumenterer oplåsning med kort #14 kl. 21:12, hvilket sammenholdt med overvågningen kl. 21:14 beviser uafbrudt adgang.',
            isBest: true,
            feedback: 'Fremragende. Præcis kobling mellem log, tidsstempel og kausalitet.',
          },
        ],
      },
    },
    {
      stepNumber: 5,
      rolePath: 'Anklager',
      title: '5. Afdæk modsigelser i krydsforhør',
      objective: 'Udfordr tiltaltes forklaring om tabt nøglekort via Krydsforhør.',
      strategyTip: 'Spørg ind til hvorfor kortet først blev meldt tabt næste morgen kl. 09:30.',
      hint: 'Aktiver "Krydsforhør" i Procedure-fanen og fremlæg et skarpt modspørgsmål.',
      requiredAction: 'cross_exam',
      levelFocus: 'Øvet',
      simulation: {
        prompt: 'Forsvareren hævder kortet var mistet kl. 20:55. Hvad er det skarpeste krydsforhør?',
        options: [
          {
            label: 'Hvorfor blev kort #14 først spærret kl. 09:30 dagen efter, hvis det manglede aftenen før?',
            isBest: true,
            feedback: 'Direkte modsigelse mellem påstået tab og sen spærring giver maksimal rebuttal-bonus.',
          },
          {
            label: 'Hvad spiste De til aftensmad kl. 19:00?',
            isBest: false,
            feedback: 'Uden relevans for adgangen kl. 21:12.',
          },
        ],
      },
    },
    {
      stepNumber: 6,
      rolePath: 'Anklager',
      title: '6. Fasthold fokus mod modpartens tvivl',
      objective: 'Vis at viceværtens iagttagelse kl. 21:15 flugter med tidsforløbet trods regn.',
      strategyTip: 'Anerkend sløret video som støttebevis (indicium), ikke enebærende bevis.',
      hint: 'Svar på modpartens indlæg uden at gentage dine tidligere ord ordret.',
      requiredAction: 'submit_argument',
      levelFocus: 'Øvet',
      simulation: {
        prompt: 'Hvordan håndterer du bedst, at overvågningen (Bilag B) er sløret?',
        options: [
          {
            label: 'Erklær at billedet er knivskarpt, selvom linsen var våd',
            isBest: false,
            feedback: 'At benægte åbenlyse fakta i bilaget skader din troværdighed.',
          },
          {
            label: 'Brug Bilag B til at fastslå tidspunktet 21:14, mens Bilag A dokumenterer nøgleadgangen 21:12',
            isBest: true,
            feedback: 'Rigtigt. Kombination af teknisk log og tidsfæstet indicium holder.',
          },
        ],
      },
    },
    {
      stepNumber: 7,
      rolePath: 'Anklager',
      title: '7. Afslut bevisførelsen på toppen',
      objective: 'Erklær "Ingen flere relevante argumenter", når hovedspørgsmålene er belyst.',
      strategyTip: 'Overflødige runder øger risikoen for gentagelsesstraf.',
      hint: 'Klik "Afslut sag" når dine centrale argumenter står stærkt i retsbogen.',
      requiredAction: 'rest_case',
      levelFocus: 'Dommer',
      simulation: {
        prompt: 'Hvornår bør anklageren afslutte sagen?',
        options: [
          {
            label: 'Når alle hovedbeviser og alibiets svagheder er fremført klart uden gentagelser',
            isBest: true,
            feedback: 'Korrekt. Skarphed slår udmattelsesrunder.',
          },
          {
            label: 'Først efter mindst 12 gentagne indlæg',
            isBest: false,
            feedback: 'Gentagelser giver minuspoint og advarer dommeren.',
          },
        ],
      },
    },
    {
      stepNumber: 8,
      rolePath: 'Anklager',
      title: '8. Votering, dom & oplåsning',
      objective: 'Gennemgå AI-juryens votering og lås op for hele sagsarkivet og multiplayer.',
      strategyTip: 'Høj kohærens øger både sejrssandsynlighed og bonus-credits.',
      hint: 'Fuldfør sagen via "Afslut sag" for at modtage din dom og credits.',
      requiredAction: 'judge_verdict',
      levelFocus: 'Dommer',
      simulation: {
        prompt: 'Hvis anklager og forsvarer ender helt lige i kohærens (68 mod 68), hvem vinder?',
        options: [
          {
            label: 'Anklageren vinder altid uafgjort',
            isBest: false,
            feedback: 'Forkert. Strafferetten beskytter tiltalte ved rimelig tvivl.',
          },
          {
            label: 'Forsvareren vinder pga. bevisbyrden (In dubio pro reo)',
            isBest: true,
            feedback: 'Korrekt! Som anklager skal du skabe et klart forspring i dokumentation.',
          },
        ],
      },
    },
  ],
  Forsvarer: [
    {
      stepNumber: 1,
      rolePath: 'Forsvarer',
      title: '1. In Dubio Pro Reo – Rimelig Tvivl',
      objective: 'Som forsvarer skal du ikke bevise tiltaltes uskyld 100%, men påvise rimelig tvivl i anklagen.',
      strategyTip: 'Enhver begrundet tvivl om identifikation eller nøglekort skal komme tiltalte til gode.',
      hint: 'Vælg det rigtige forsvarer-princip i øvelsen nedenfor.',
      requiredAction: 'ack',
      levelFocus: 'Begynder',
      simulation: {
        prompt: 'Hvad er nok til at vinde en straffesag som forsvarer?',
        options: [
          {
            label: 'At skabe dokumenteret, sammenhængende rimelig tvivl om gerningsmandens identitet',
            isBest: true,
            feedback: 'Korrekt. Kan anklager ikke løfte bevisbyrden fuldt ud, skal tiltalte frifindes.',
          },
          {
            label: 'At benægte alt uden at læse bilagene',
            isBest: false,
            feedback: 'Tom benægtelse uden modbeviser giver svag kohærens.',
          },
        ],
      },
    },
    {
      stepNumber: 2,
      rolePath: 'Forsvarer',
      title: '2. Kortlæg tiltaltes alibi & vidner',
      objective: 'Gennemgå nabo Sofie Kraghs udsagn og forsvarerens mål i Sag #0001.',
      strategyTip: 'Kombiner vidner med fysiske/tidsstemplede dokumenter.',
      hint: 'Åbn fanen "Sagsmappe & Rolle" eller løs kontrolspørgsmålet.',
      requiredAction: 'read_case',
      levelFocus: 'Begynder',
      simulation: {
        prompt: 'Hvad støtter nabo Sofie Kraghs vidneudsagn fra kl. 20:55?',
        options: [
          {
            label: 'At Mads ledte efter sit nøglekort allerede før tyveriet, hvilket passer med et tabt kort',
            isBest: true,
            feedback: 'Præcist. Det giver anklagens nøglelog en alternativ, troværdig forklaring.',
          },
          {
            label: 'At Mads var på ferie i udlandet',
            isBest: false,
            feedback: 'Faktuelt forkert ifølge sagens oplysninger.',
          },
        ],
      },
    },
    {
      stepNumber: 3,
      rolePath: 'Forsvarer',
      title: '3. Find modbeviser på bevisbordet',
      objective: 'Inspicer Bilag C (Vaskeri-kvittering) og svaghederne i Bilag B (Overvågning).',
      strategyTip: 'Brug både direkte alibispor og tvivl om billedkvaliteten.',
      hint: 'Klik på Bilag C eller Bilag B på 3D-bordet eller i fanen "Beviser".',
      requiredAction: 'inspect_evidence',
      levelFocus: 'Begynder',
      simulation: {
        prompt: 'Hvorfor er Bilag C (Vaskeri-kvittering kl. 20:58) vigtigt for forsvaret?',
        options: [
          {
            label: 'Det dokumenterer objektivt tiltaltes tilstedeværelse i vaskekælderen tæt på vidnets observation',
            isBest: true,
            feedback: 'Korrekt. Objektiv kvittering + vidneudsagn skaber en stærk alternativ tidslinje.',
          },
          {
            label: 'Det beviser at cyklen aldrig har eksisteret',
            isBest: false,
            feedback: 'Hold dig præcist til, hvad bilaget faktisk dokumenterer.',
          },
        ],
      },
    },
    {
      stepNumber: 4,
      rolePath: 'Forsvarer',
      title: '4. Fremlæg alternativ tidslinje',
      objective: 'Vis at vaskekælder-brik (20:58) og manglende ansigtsgenkendelse skaber tvivl.',
      strategyTip: 'Brug ord som "tvivl", "vaskekælder", "sløret" og "modstrider".',
      hint: 'Vælg Bilag C i Procedure-fanen og klik "Fremlæg".',
      requiredAction: 'submit_argument',
      levelFocus: 'Øvet',
      simulation: {
        prompt: 'Hvilket forsvarsindlæg er stærkest mod Bilag B (Overvågningsbilledet)?',
        options: [
          {
            label: 'Regn på linsen gør ansigtet ulæseligt kl. 21:14, og sammenholdt med vaskekvittering kl. 20:58 skaber det rimelig tvivl om identiteten',
            isBest: true,
            feedback: 'Skarpt og præcist. Knytter svagheden i Bilag B sammen med Bilag C.',
          },
          {
            label: 'Overvågningskameraer virker aldrig om aftenen',
            isBest: false,
            feedback: 'Udokumenteret påstand uden støtte i bilaget.',
          },
        ],
      },
    },
    {
      stepNumber: 5,
      rolePath: 'Forsvarer',
      title: '5. Krydsforhør anklagens vidne & log',
      objective: 'Test viceværtens synsafstand (30m i regn uden briller) under krydsforhør.',
      strategyTip: 'Angrib konkrete observationsbetingelser frem for personangreb.',
      hint: 'Aktiver "Krydsforhør" og udfordr viceværtens observation eller adgangsloggen.',
      requiredAction: 'cross_exam',
      levelFocus: 'Øvet',
      simulation: {
        prompt: 'Hvad er vicevært Henrik Møllers største troværdighedssvaghed?',
        options: [
          {
            label: 'Han stod 30 meter væk i kraftig regn uden briller og så kun en mørk hættetrøje',
            isBest: true,
            feedback: 'Korrekt! Det gør positiv identifikation af tiltalte usikker.',
          },
          {
            label: 'At han arbejder som vicevært i boligforeningen',
            isBest: false,
            feedback: 'Ikke relevant for observationens nøjagtighed.',
          },
        ],
      },
    },
    {
      stepNumber: 6,
      rolePath: 'Forsvarer',
      title: '6. Undgå bevis-fælden (Bilag D)',
      objective: 'Vedhæft aldrig irrelevante dokumenter for at fylde sagen ud.',
      strategyTip: 'Hvis anklager indbringer støj, påpeg den manglende relevans.',
      hint: 'Fremfør endnu et skarpt modargument mod anklagerens sidste punkt.',
      requiredAction: 'submit_argument',
      levelFocus: 'Øvet',
      simulation: {
        prompt: 'Anklageren vedhæfter Bilag D (bagerkvittering). Hvordan reagerer du som forsvarer?',
        options: [
          {
            label: 'Påpeg at bagerkvitteringen fra tre dage før intet beviser om tyveriet kl. 21:14',
            isBest: true,
            feedback: 'Rigtigt. Du afslører irrelevansen og styrker din egen troværdighed.',
          },
          {
            label: 'Brug selv bagerkvitteringen som hovedbevis',
            isBest: false,
            feedback: 'Så rammes du selv af irrelevans-straf.',
          },
        ],
      },
    },
    {
      stepNumber: 7,
      rolePath: 'Forsvarer',
      title: '7. Erklær forsvaret sluttet',
      objective: 'Når tvivlen er etableret klart, afslut bevisførelsen før sagen bliver gentagende.',
      strategyTip: 'Ligesom anklager straffes forsvareren for unødvendige gentagelser.',
      hint: 'Klik "Afslut sag" i Procedure-fanen for at sende sagen til juryen.',
      requiredAction: 'rest_case',
      levelFocus: 'Dommer',
      simulation: {
        prompt: 'Hvad sker der, hvis du afslutter sagen efter klare modbeviser mod identifikationen?',
        options: [
          {
            label: 'Juryen vurderer, om anklagerens beviser overvandt din rimelige tvivl',
            isBest: true,
            feedback: 'Korrekt. Ved tæt løb falder tvivlen ud til frifindelse.',
          },
          {
            label: 'Forsvareren taber automatisk ved at afslutte',
            isBest: false,
            feedback: 'Tværtimod — rettidig afslutning bevarer høj gennemsnitskohærens.',
          },
        ],
      },
    },
    {
      stepNumber: 8,
      rolePath: 'Forsvarer',
      title: '8. Dom & Løsladelse af fuld adgang',
      objective: 'Modtag dommens begrundelse og lås op for nye sager og multiplayer.',
      strategyTip: 'Gennemgå dommerens forbedringspunkter for at mestre Øvet- og Dommer-sager.',
      hint: 'Gennemfør domsafsigelsen for at afslutte forsvarer-træningen.',
      requiredAction: 'judge_verdict',
      levelFocus: 'Dommer',
      simulation: {
        prompt: 'Hvorfor er forsvarerens rolle afgørende i Retsspillet?',
        options: [
          {
            label: 'Fordi den tester bevisernes holdbarhed og sikrer, at ingen dømmes på løse indicier',
            isBest: true,
            feedback: 'Korrekt. Velkommen til fuld sagspraksis!',
          },
          {
            label: 'Fordi forsvareren må råbe højere end anklageren',
            isBest: false,
            feedback: 'Retsspillet belønner udelukkende logik og evidensvægt.',
          },
        ],
      },
    },
  ],
  Dommer: [
    {
      stepNumber: 1,
      rolePath: 'Dommer',
      title: '1. Habilitet & Upartisk Procesledelse',
      objective: 'Som dommer styrer du retssalen neutralt — du hverken gætter eller favoriserer.',
      strategyTip: 'En dommers magt ligger i processtyring, relevanskontrol og begrundet dom.',
      hint: 'Bekræft dommerens grundprincip i simulationen nedenfor.',
      requiredAction: 'ack',
      levelFocus: 'Dommer',
      simulation: {
        prompt: 'Hvordan bevarer du din habilitet i en retssag med stærke følelser?',
        options: [
          {
            label: 'Byg udelukkende vurderingen på dokumenterede bilag, tidslinje og kontradiktion',
            isBest: true,
            feedback: 'Korrekt. Upartiskhed og faktabaseret skøn er dommerens fundament.',
          },
          {
            label: 'Følg blot folkets (tilskuernes) højeste råb',
            isBest: false,
            feedback: 'Folket kan give et fingerpeg i tætte sager, men dommeren skal vurdere beviserne.',
          },
        ],
      },
    },
    {
      stepNumber: 2,
      rolePath: 'Dommer',
      title: '2. Gennemgå anklage & rammer',
      objective: 'Sæt dig ind i begge parters mål og sagens nøglespørgsmål før parterne taler.',
      strategyTip: 'Dommeren skal kende både anklagerens bevisbyrde og forsvarerens tvivlspunkter.',
      hint: 'Åbn "Sagsmappe & Rolle" eller besvar sagsøvelsen her.',
      requiredAction: 'read_case',
      levelFocus: 'Dommer',
      simulation: {
        prompt: 'Hvad er dommerens første opgave, når en ny sag åbnes?',
        options: [
          {
            label: 'Fastlægge anklagens kerne og sikre at begge parter kender bevistemaet',
            isBest: true,
            feedback: 'Præcist. En skarp ramme forhindrer sidespor.',
          },
          {
            label: 'Afsige dom inden bevisførelsen er begyndt',
            isBest: false,
            feedback: 'Kontradiktionsprincippet kræver at begge sider høres først.',
          },
        ],
      },
    },
    {
      stepNumber: 3,
      rolePath: 'Dommer',
      title: '3. Relevanskontrol af bilag',
      objective: 'Bedøm hvilke bilag på bordet der er primærbeviser, indicier eller ren støj.',
      strategyTip: 'Kend forskellen på teknisk log (Bilag A) og irrelevant bagerkvittering (Bilag D).',
      hint: 'Klik på et bilag på bevisbordet eller i "Beviser" for at vurdere dets vægt.',
      requiredAction: 'inspect_evidence',
      levelFocus: 'Dommer',
      simulation: {
        prompt: 'En part forsøger at bruge Bilag D (3 dage gammel bagerkvittering). Hvad gør du?',
        options: [
          {
            label: 'Afvis bilaget som irrelevant for at beskytte retssalens fokus',
            isBest: true,
            feedback: 'Korrekt. Relevanskriteriet holder bevisførelsen skarp.',
          },
          {
            label: 'Giv det samme vægt som adgangsloggen kl. 21:12',
            isBest: false,
            feedback: 'Irrelevante bilag må aldrig vægtes som primærbeviser.',
          },
        ],
      },
    },
    {
      stepNumber: 4,
      rolePath: 'Dommer',
      title: '4. Brug dommerhammer & orden',
      objective: 'Åbn fanen "Dommer & Folket" og afprøv dommerens procesværktøjer.',
      strategyTip: 'Brug "Slå hammeren" og "Afvis irrelevant bilag" når parterne mister fokus.',
      hint: 'Gå til fanen "Dommer & Folket" og klik "Slå hammeren" eller "Afvis irrelevant bilag".',
      requiredAction: 'judge_control',
      levelFocus: 'Dommer',
      simulation: {
        prompt: 'Hvornår bør du slå hammeren eller afvise et indlæg i multiplayer?',
        options: [
          {
            label: 'Når en part gentager sig selv, afbryder uden grund eller bringer usaglig støj ind',
            isBest: true,
            feedback: 'Korrekt. Procesledelse skaber en disciplineret retssal.',
          },
          {
            label: 'Hver gang forsvareren stiller et kritisk spørgsmål',
            isBest: false,
            feedback: 'Kritisk krydsforhør er en lovlig og vigtig del af processen.',
          },
        ],
      },
    },
    {
      stepNumber: 5,
      rolePath: 'Dommer',
      title: '5. Styr sagens fremdrift & tilførsler',
      objective: 'Noter en processuel bemærkning eller vejledning til parterne i retsbogen.',
      strategyTip: 'Bed parterne forbinde deres påstande til konkrete tidspunkter og bilag.',
      hint: 'Skriv eller indtal en kort dommerbemærkning i "Procedure & Indtal" og klik "Fremlæg".',
      requiredAction: 'submit_argument',
      levelFocus: 'Dommer',
      simulation: {
        prompt: 'Hvilken dommerbemærkning hæver kvaliteten i retssalen mest?',
        options: [
          {
            label: 'Parterne bedes forholde sig konkret til tidsforskellen mellem kl. 20:58 og kl. 21:12 i Bilag A og C.',
            isBest: true,
            feedback: 'Fremragende. Du tvinger parterne ind på sagens afgørende akse.',
          },
          {
            label: 'Jeg keder mig, skynd jer lidt.',
            isBest: false,
            feedback: 'Ikke værdigt eller sagligt for en retspræsident.',
          },
        ],
      },
    },
    {
      stepNumber: 6,
      rolePath: 'Dommer',
      title: '6. Vurder modstridende forklaringer',
      objective: 'Sammenhold vidners svagheder med tekniske spor under krydsforhør.',
      strategyTip: 'Test om uoverensstemmelser skyldes hukommelse, sigtbarhed eller bevidst usandhed.',
      hint: 'Prøv "Krydsforhør" eller løs vurderingsøvelsen herunder.',
      requiredAction: 'cross_exam',
      levelFocus: 'Dommer',
      simulation: {
        prompt: 'Viceværten så en hættetrøje på 30m i regn, mens nøglekort #14 åbnede døren. Hvordan vægtes det?',
        options: [
          {
            label: 'Adgangsloggen har høj teknisk vægt, mens vidnets observation svækkes af sigtbarhed og regn',
            isBest: true,
            feedback: 'Balanceret og juridisk korrekt bevisvurdering.',
          },
          {
            label: 'Begge dele ses bort fra automatisk',
            isBest: false,
            feedback: 'Tekniske indicier indgår stadig i den samlede vurdering.',
          },
        ],
      },
    },
    {
      stepNumber: 7,
      rolePath: 'Dommer',
      title: '7. Afvej juryens votering',
      objective: 'Kontroller AI-juryens samlede kohærensmåling før endelig domsafsigelse.',
      strategyTip: 'Husk at tvivl i straffesager altid skal komme tiltalte til gode.',
      hint: 'Brug "Døm Anklager" / "Døm Frifindelse" under "Dommer & Folket" eller "Afslut sag".',
      requiredAction: 'rest_case',
      levelFocus: 'Dommer',
      simulation: {
        prompt: 'AI-juryen viser 3-3 og næsten ens kohærensscore. Hvilken kendelse er juridisk rigtig?',
        options: [
          {
            label: 'Frifindelse, fordi anklageren ikke har løftet bevisbyrden ud over rimelig tvivl',
            isBest: true,
            feedback: 'Helt korrekt. Grundstenen i retsstaten og i Retsspillet.',
          },
          {
            label: 'Domfældelse fordi sagen tog lang tid',
            isBest: false,
            feedback: 'Tidsforbrug skaber aldrig skyld.',
          },
        ],
      },
    },
    {
      stepNumber: 8,
      rolePath: 'Dommer',
      title: '8. Begrundet dom & fuld retssal',
      objective: 'Afsig en klar, begrundet dom der nævner de afgørende fakta og lås hele spillet op.',
      strategyTip: 'Du kan nu lede både solo-sager og multiplayer-rum som menneskelig dommer.',
      hint: 'Fuldfør domsafsigelsen for at afslutte Dommer-stien.',
      requiredAction: 'judge_verdict',
      levelFocus: 'Dommer',
      simulation: {
        prompt: 'Hvad adskiller en stærk domsafgørelse fra en svag?',
        options: [
          {
            label: 'At den konkret forklarer hvilke bilag der vejede tungest, og hvorfor modpartens synspunkt blev forkastet',
            isBest: true,
            feedback: 'Korrekt. Du er nu klar til at præsidere over hele Retsspillet.',
          },
          {
            label: 'At den kun består af ét ord uden begrundelse',
            isBest: false,
            feedback: 'En dom skal altid være gennemsigtig og begrundet.',
          },
        ],
      },
    },
  ],
};

export const TUTORIAL_STEPS: RoleTutorialStepDef[] = ROLE_TUTORIAL_PATHS.Anklager;

export const BUILT_IN_CASES: LegalCase[] = [
  {
    id: 'case-0001',
    caseNumber: '#0001',
    title: 'Den forsvundne cykel',
    category: 'Øvelsessag · Tyveri',
    difficulty: 'Begynder',
    source: 'Indbygget',
    isTutorial: true,
    summary:
      'En dyr elcykel er forsvundet fra et aflåst cykelskur ved boligforeningen Kløverparken kl. 21:14. Beboeren Mads Lind er tiltalt, men overvågningen er sløret, og nøgleloggen rejser spørgsmål.',
    charge: 'Overtrædelse af straffelovens § 276 (tyveri af elcykel til værdi 18.500 kr.).',
    prosecutionGoal:
      'Dokumenter at Mads Lind havde adgang via nøglekort #14 og modsig hans alibi med video- og tidsstempler.',
    defenseGoal:
      'Påvis at nøglekortet kan have været mistet, at billedet er sløret, og skab rimelig tvivl.',
    defendantName: 'Mads Lind',
    coreIssues: ['nøglekort', '21:12', '21:14', 'overvågning', 'hættetrøje', 'kvittering', 'alibi'],
    rewardCredits: 250,
    witnesses: [
      {
        id: 'w-vicevaert',
        name: 'Henrik Møller',
        roleTitle: 'Vicevært',
        statement:
          'Jeg så en person i mørk hættetrøje trække en hvid elcykel ud gennem gården omkring kl. 21:15. Skurets lås var ikke brudt op.',
        weakness: 'Det regnede kraftigt, og han var 30 meter væk uden briller.',
        supports: 'prosecution',
      },
      {
        id: 'w-nabo',
        name: 'Sofie Kragh',
        roleTitle: 'Nabo i opgang B',
        statement:
          'Jeg mødte Mads i vaskekælderen kl. 20:55, hvor han ledte efter sit nøglekort i sin jakkelomme.',
        weakness: 'Hun så ham ikke efter kl. 21:05.',
        supports: 'defense',
      },
    ],
    evidence: [
      {
        id: 'ev-keylog',
        title: 'Bilag A: Adgangslog for nøglekort #14',
        type: 'digital',
        summary: 'Registrerer oplåsning af cykelskur kl. 21:12:08.',
        detail:
          'Elektronisk adgangslog viser, at kort #14 (udstedt til Mads Lind) åbnede skuret kl. 21:12:08. Kortet blev først spærret dagen efter kl. 09:30.',
        reliabilityWeight: 9,
        supports: 'prosecution',
        keywords: ['nøglekort', '21:12', 'log', 'spærret', 'adgang'],
        contradictionHint: 'Tiltalte meldte først kortet tabt dagen efter, ikke samme aften.',
      },
      {
        id: 'ev-cctv',
        title: 'Bilag B: Overvågningsbillede kl. 21:14',
        type: 'video',
        summary: 'Kornet stillbillede af skikkelse i mørk hættetrøje ved porten.',
        detail:
          'Kameraet fanger en ca. 180 cm høj person i mørk hættetrøje med cyklen kl. 21:14. Regndråber på linsen gør ansigtet ulæseligt.',
        reliabilityWeight: 6,
        supports: 'neutral',
        keywords: ['21:14', 'overvågning', 'sløret', 'hættetrøje', 'ansigt'],
        contradictionHint: 'Billedet identificerer ikke ansigtet entydigt – støtter både identifikationstidspunkt og rimelig tvivl.',
      },
      {
        id: 'ev-laundry',
        title: 'Bilag C: Vaskeri-kvittering kl. 20:58',
        type: 'document',
        summary: 'Booking og start af vaskemaskine 2 på tiltaltes brik kl. 20:58.',
        detail:
          'Viser aktivitet i vaskekælderen 14 minutter før tyveriet. Vaskekælderen ligger 40 meter fra cykelskuret.',
        reliabilityWeight: 7,
        supports: 'defense',
        keywords: ['vaskekælder', '20:58', 'brik', 'nabo', 'mistet'],
        contradictionHint: 'Understøtter at tiltalte opholdt sig i vaskekælderen og allerede kl. 20:55 nævnte et manglende kort.',
      },
      {
        id: 'ev-bakery',
        title: 'Bilag D: Gammel bagerkvittering',
        type: 'document',
        summary: 'Kvittering for kaffe og rundstykker fra tre dage før hændelsen.',
        detail: 'Fundet i skraldespanden ved porten. Har ingen tidsmæssig forbindelse til cykelskuret.',
        reliabilityWeight: 1,
        supports: 'neutral',
        keywords: ['rundstykker', 'kaffe'],
        isIrrelevant: true,
      },
    ],
  },
  {
    id: 'case-0042',
    caseNumber: '#0042',
    title: 'El-løbehjulet i gågaden',
    category: 'Færdselsret & Erstatning',
    difficulty: 'Øvet',
    source: 'Domsdatabasen.dk',
    summary:
      'En fodgænger blev påkørt i en travl gågade en lørdag eftermiddag. Føreren af udlejningsløbehjulet hævder bremsefejl, mens GPS-telemetrien viser høj fart.',
    charge: 'Uagtsom legemsbeskadigelse og overtrædelse af færdselsloven (kørsel på gågade).',
    prosecutionGoal: 'Dokumenter uforsvarlig fart via telemetri og afvis påstanden om pludselig bremsefejl.',
    defenseGoal: 'Godtgør teknisk fejl på udlejningsløbehjulet eller medskyld fra fodgængeren.',
    defendantName: 'Jonas Vestergaard',
    coreIssues: ['24 km/t', 'bremse', 'telemetri', 'gågade', 'skilte', 'udlejning'],
    rewardCredits: 320,
    witnesses: [
      {
        id: 'w-butik',
        name: 'Camilla Bjerre',
        roleTitle: 'Butiksindehaver',
        statement:
          'Løbehjulet kom susende forbi mit vindue hurtigere end en cykel. Føreren kiggede ned på sin telefon.',
        weakness: 'Hun så kun de sidste 2 sekunder før sammenstødet.',
        supports: 'prosecution',
      },
    ],
    evidence: [
      {
        id: 'ev-gps',
        title: 'Bilag 1: GPS- & Bremsetelemetri',
        type: 'digital',
        summary: 'Log viser 23,8 km/t 3 sekunder før kollision; bremsen aktiveret 0,4s før stød.',
        detail:
          'Udlejningsfirmaets sorte boks registrerede fuld gashåndtag til 0,4 sekunder før sammenstødet, og bremsekaliberen fungerede ved efterfølgende værkstedstest.',
        reliabilityWeight: 10,
        supports: 'prosecution',
        keywords: ['telemetri', '23,8', '24', 'bremse', 'værkstedstest', 'gashåndtag'],
        contradictionHint: 'Modstrider tiltaltes forklaring om, at bremsen svigtede 15 meter før fodgængeren.',
      },
      {
        id: 'ev-sign',
        title: 'Bilag 2: Foto af midlertidigt vejarbejde',
        type: 'physical',
        summary: 'Skiltet "Gågade – kørsel forbudt" var delvist dækket af stillads.',
        detail: 'Taget samme dag. Viser at indkørslen fra sidegaden havde nedsat skiltesynlighed.',
        reliabilityWeight: 7,
        supports: 'defense',
        keywords: ['skilt', 'stillads', 'gågade', 'synlighed'],
      },
      {
        id: 'ev-shoe',
        title: 'Bilag 3: Foto af gågadebelægning',
        type: 'physical',
        summary: 'Almindelige brosten i tørvejr.',
        detail: 'Ingen glatføre eller huller i belægningen.',
        reliabilityWeight: 3,
        supports: 'neutral',
        keywords: ['brosten', 'tørvejr'],
        isIrrelevant: true,
      },
    ],
  },
  {
    id: 'case-0108',
    caseNumber: '#0108',
    title: 'Den lækkede kundeliste',
    category: 'Erhvervsret & Databrud',
    difficulty: 'Dommer',
    source: 'Domsdatabasen.dk',
    summary:
      'En tidligere salgschef står anklaget for at have eksporteret 1.400 erhvervskunder umiddelbart før sin opsigelse. Forsvaret gør gældende, at eksporten var rutinebackup.',
    charge: 'Overtrædelse af lov om forretningshemmeligheder § 4 og straffelovens § 263.',
    prosecutionGoal: 'Bevis forsætlig tilegnelse via tidspunktet for USB-eksport og konkurrerende brug.',
    defenseGoal: 'Vis legitim arbejdsrelateret backup-rutine uden dokumenteret videresendelse.',
    defendantName: 'Nanna Lindholm',
    coreIssues: ['eksport', 'usb', '23:40', 'backup', 'forretningshemmelighed', 'tilbud'],
    rewardCredits: 450,
    witnesses: [
      {
        id: 'w-it',
        name: 'Rasmus Dalgaard',
        roleTitle: 'IT-sikkerhedsansvarlig',
        statement:
          'Eksporten på 1.400 rækker skete kl. 23:40 søndag aften – to timer før opsigelsen blev sendt.',
        weakness: 'IT-systemet havde ingen skriftlig politik om forbud mod lokal backup.',
        supports: 'prosecution',
      },
    ],
    evidence: [
      {
        id: 'ev-audit',
        title: 'Bilag A: CRM Audit Log',
        type: 'digital',
        summary: 'CSV-eksport kl. 23:40 til krypteret USB-enhed.',
        detail: 'Brugerkontoen hentede hele kundedatabasen inkl. marginer og udløbsdatoer på kontrakter.',
        reliabilityWeight: 10,
        supports: 'prosecution',
        keywords: ['23:40', 'usb', 'eksport', 'marginer', 'opsigelse'],
        contradictionHint: 'Almindelig backup omfatter ikke konkurrencefølsomme marginer for hele landet.',
      },
      {
        id: 'ev-mail',
        title: 'Bilag B: Intern mail om hjemmearbejde',
        type: 'document',
        summary: 'Leder bad tre uger tidligere teamet om at sikre offline-adgang før rejse.',
        detail: 'Viser at offline-CSV tidligere har været brugt i salgsafdelingen.',
        reliabilityWeight: 7,
        supports: 'defense',
        keywords: ['offline', 'rejse', 'backup', 'politik', 'leder'],
      },
    ],
  },
];

export const JUDGE_INTRO_MODULES: JudgeIntroModule[] = [
  {
    id: 1,
    title: 'Velkommen til Retsspillet',
    subtitle: 'Fra hurtig snak til skarp jura',
    body: 'Retsspillet handler ikke om at råbe højest eller sende flest beskeder. Hver sag afgøres efter argumenternes logiske sammenhæng, relevante beviser og evnen til at afdække modsigelser.',
    keyPrinciple: 'Kvalitet og kohærens vægtes altid højere end ordmængde.',
    interactiveCheck: {
      question: 'Hvad belønner Retsspillets pointalgoritme mest?',
      options: [
        'At skrive så lange indlæg som muligt',
        'At fremlægge mange tilfældige bilag på én gang',
        'Logisk sammenhængende argumenter støttet af præcise primærbeviser',
      ],
      correctIndex: 2,
      explanation: 'Algoritmen giver høj score for årsagssammenhæng + præcis bevisvægt og straffer støj.',
    },
  },
  {
    id: 2,
    title: 'Dommerens ansvar & Habilitet',
    subtitle: 'Upartisk procesledelse',
    body: 'Som dommer styrer du slagets gang: du sikrer at parterne holder sig til sagen, afviser irrelevante bilag og træffer en begrundet afgørelse uden personlig forudindtagethed.',
    keyPrinciple: 'En dommer dømmer kun på det, der er dokumenteret i retten.',
    interactiveCheck: {
      question: 'Hvornår bør dommeren gribe ind med en advarsel?',
      options: [
        'Når en part bruger et irrelevant bilag eller gentager det samme argument',
        'Når anklageren stiller et skarpt spørgsmål',
        'Når tiltalte benægter skyld',
      ],
      correctIndex: 0,
      explanation: 'Dommeren beskytter retssalens fokus ved at afvise støj og gentagelser.',
    },
  },
  {
    id: 3,
    title: 'Hvordan sager fungerer',
    subtitle: 'De 6 faser i en retssag',
    body: 'Enhver sag bevæger sig gennem: 1) Sagens åbning, 2) Bevisførelse, 3) Krydsforhør, 4) Afslutning ("Ingen flere relevante argumenter"), 5) AI-juryens vurdering og 6) Dommerens afgørelse.',
    keyPrinciple: 'Begge parter har ret til kontradiktion – at svare på modpartens påstande.',
    interactiveCheck: {
      question: 'Hvad sker der, når parterne erklærer sig færdige?',
      options: [
        'Sagen nulstilles',
        'AI-juryen vurderer bevisvægt og kohærens før dommerens endelige kendelse',
        'Den sidste taler vinder automatisk',
      ],
      correctIndex: 1,
      explanation: 'Afslutning udløser juryens samlede evaluering og dommerens begrundede afgørelse.',
    },
  },
  {
    id: 4,
    title: 'Bevisførelse og relevans',
    subtitle: 'Primærbeviser vs. støj',
    body: 'Et direkte tidsstemplet log- eller videobevis (høj vægt) vejer tungere end andenhåndsformodninger. At vedhæfte irrelevante bilag ("red herrings") sænker din troværdighed.',
    keyPrinciple: 'Et stærkt bilag med klar forklaring slår fire svage bilag.',
    interactiveCheck: {
      question: 'Hvorfor giver det minuspoint at vedhæfte 4 bilag uden sammenhæng?',
      options: [
        'Fordi systemet straffer bevis-spam og manglende relevans',
        'Fordi kun anklageren må bruge mere end ét bilag',
        'Fordi bilag slet ikke tæller i spillet',
      ],
      correctIndex: 0,
      explanation: 'Fokus og præcision belønnes; bevis-spam udløser advarsel fra dommeren.',
    },
  },
  {
    id: 5,
    title: 'Modstridende forklaringer',
    subtitle: 'Krydsforhørets kunst',
    body: 'Når et vidne eller tiltalte siger én ting, og et objektivt bilag viser noget andet, opstår en modsigelse. Påpeg den direkte i krydsforhør for maksimal effekt.',
    keyPrinciple: 'Sammenhold tidsstempel og forklaring for at afsløre uoverensstemmelser.',
    interactiveCheck: {
      question: 'Hvordan udnytter du en modsigelse bedst?',
      options: [
        'Ignorer den og tal om noget andet',
        'Kobl modpartens udsagn direkte til det modstridende bilag i krydsforhør',
        'Sig blot "du lyver" uden bevis',
      ],
      correctIndex: 1,
      explanation: 'Konkret kobling mellem udsagn og bilag giver højeste rebuttal-bonus.',
    },
  },
  {
    id: 6,
    title: 'AI-juryens rolle',
    subtitle: '6 virtuelle lægdommere',
    body: 'AI-juryen analyserer hele transskriptionen: bevisbyrde, logisk struktur, uimodsagte argumenter og relevans. I tvivlstilfælde falder tvivlen tiltalte til gode.',
    keyPrinciple: 'In dubio pro reo – enhver rimelig tvivl kommer tiltalte til gode.',
    interactiveCheck: {
      question: 'Hvem vinder ved helt lige argumentationsstyrke?',
      options: [
        'Anklageren',
        'Forsvareren / Tiltalte pga. bevisbyrden',
        'Ingen – sagen aflyses',
      ],
      correctIndex: 1,
      explanation: 'Anklageren bærer bevisbyrden og skal løfte sagen over rimelig tvivl.',
    },
  },
  {
    id: 7,
    title: 'Hvordan en afgørelse træffes',
    subtitle: 'Den begrundede dom',
    body: 'En god dom nævner: hvilke fakta der er lagt til grund, hvilke beviser der blev tillagt vægt, hvorfor modargumenter blev forkastet, og det endelige resultat.',
    keyPrinciple: 'Gennemsigtig begrundelse skaber retssikkerhed.',
    interactiveCheck: {
      question: 'Hvad skal en dommerafgørelse altid indeholde?',
      options: [
        'Kun ordet "Skyldig" eller "Frifundet"',
        'En konkret begrundelse baseret på beviser og parternes argumenter',
        'En afstemning blandt tilskuerne alene',
      ],
      correctIndex: 1,
      explanation: 'Retsspillet kræver en begrundet afgørelse knyttet til sagens kerne.',
    },
  },
  {
    id: 8,
    title: 'Eksempel på en komplet retssag',
    subtitle: 'Fra åbning til dom i praksis',
    body: 'I Sag #0001 åbner anklager med nøglekort #14 (21:12), forsvarer modargumenterer med vaskeribrik (20:58) og sløret video (21:14). Begge erklærer sig færdige, juryen voterer, og dommeren afsiger dom.',
    keyPrinciple: 'Korte, præcise runder giver et skarpt og spændende retsforløb.',
    interactiveCheck: {
      question: 'Hvad er forsvarerens stærkeste træk i Sag #0001?',
      options: [
        'At fremlægge bagerkvitteringen',
        'At kombinere vaskerikvittering kl. 20:58 med naboens udsagn og det slørede billede',
        'At nægte at udtale sig',
      ],
      correctIndex: 1,
      explanation: 'Kombinationen skaber en sammenhængende alternativ forklaring og rimelig tvivl.',
    },
  },
  {
    id: 9,
    title: 'Multiplayer-dommerens værktøjer',
    subtitle: 'Ledelse af menneskelige spillere',
    body: 'Når du spiller som menneskelig dommer i multiplayer, har du adgang til Hammer-slaget, "Tildel Indsigelse" (Godkendt/Afvist), fjernelse af irrelevante bilag, kohærens-bonus og endelig domsafsigelse.',
    keyPrinciple: 'Multiplayer-dommeren balancerer tempo, fairness og afgørelse.',
    interactiveCheck: {
      question: 'Hvad gør knappen "Afvis irrelevant bilag" for multiplayer-dommeren?',
      options: [
        'Fjerner støj og holder parterne til sagens fakta',
        'Sletter hele sagen',
        'Giver begge sider 100 point',
      ],
      correctIndex: 0,
      explanation: 'Dommeren bruger procesværktøjer til at holde høj standard i multiplayer.',
    },
  },
  {
    id: 10,
    title: 'Afsluttende dommerprøve',
    subtitle: 'Klar til prøvesag og fuld retssal',
    body: 'Du kender nu spillets regler: beløn logik, straf spam, respekter bevisbyrden og brug kontradiktion aktivt. Gennemfør nu den interaktive prøvesag for at låse hele spillet op.',
    keyPrinciple: 'Retfærdighed afgøres gennem struktur, ikke volumen.',
    interactiveCheck: {
      question: 'Er du klar til at lede eller føre din første sag i 3D-retssalen?',
      options: [
        'Ja – start Sag #0001 i 3D-retssalen nu',
        'Ja – med fokus på kohærens og bevisvægt',
      ],
      correctIndex: 1,
      explanation: 'Fremragende. Præcision og logik vinder retssalen.',
    },
  },
];

export const LEGAL_GLOSSARY: LegalTerm[] = [
  {
    id: 'term-bevisbyrde',
    term: 'Bevisbyrde',
    category: 'Bevisret',
    shortDefinition: 'Pligten til at godtgøre, at en påstand er sand. I straffesager bærer anklageren bevisbyrden.',
    courtroomExample: 'Hvis anklager ikke beviser skyld ud over rimelig tvivl, skal tiltalte frifindes.',
  },
  {
    id: 'term-rimelig-tvivl',
    term: 'Rimelig tvivl (In dubio pro reo)',
    category: 'Strafferet',
    shortDefinition: 'Princippet om, at enhver begrundet tvivl om skyldspørgsmålet skal komme den tiltalte til gode.',
    courtroomExample: 'Et sløret overvågningsbillede alene er ofte ikke nok til domfældelse.',
  },
  {
    id: 'term-kontradiktion',
    term: 'Kontradiktionsprincippet',
    category: 'Procesret',
    shortDefinition: 'Begge parter har ret til at kende og kommentere alle beviser og påstande, som modparten fremlægger.',
    courtroomExample: 'Forsvareren får mulighed for at udfordre anklagerens nye bilag.',
  },
  {
    id: 'term-habilitet',
    term: 'Habilitet',
    category: 'Roller',
    shortDefinition: 'Kravet om at dommeren eller nævninge er upartiske og uden personlig interesse i sagens udfald.',
    courtroomExample: 'En dommer må ikke dømme i en sag, hvor vedkommende kender tiltalte privat.',
  },
  {
    id: 'term-primaerbevis',
    term: 'Primærbevis (Direkte bevis)',
    category: 'Bevisret',
    shortDefinition: 'Et originalt og uforvansket bevis som f.eks. adgangslog, video eller underskrevet kontrakt.',
    courtroomExample: 'Tidsstemplet fra nøglekort #14 er et stærkt teknisk spor.',
  },
  {
    id: 'term-indicium',
    term: 'Indiciebevis',
    category: 'Bevisret',
    shortDefinition: 'En omstændighed der ikke direkte beviser forbrydelsen, men sammen med andre spor peger i en bestemt retning.',
    courtroomExample: 'En mørk hættetrøje på et kornet foto er et indicium, ikke et fuldt bevis.',
  },
  {
    id: 'term-krydsforhoer',
    term: 'Krydsforhør (Modafhøring)',
    category: 'Procesret',
    shortDefinition: 'Modpartens udspørgen af et vidne eller tiltalte for at teste troværdighed og afsløre modsigelser.',
    courtroomExample: 'Forsvareren spørger viceværten ind til afstanden og regnvejret.',
  },
  {
    id: 'term-kohaerens',
    term: 'Logisk kohærens',
    category: 'Bevisret',
    shortDefinition: 'Indre sammenhæng mellem påstande, tidslinje og dokumenterede fakta uden modstrid.',
    courtroomExample: 'Tidslinjen fra 20:55 til 21:14 hænger sammen uden huller.',
  },
  {
    id: 'term-anklager',
    term: 'Anklager',
    category: 'Roller',
    shortDefinition: 'Den part, der på vegne af det offentlige eller sagsøger skal bevise anklagen.',
    courtroomExample: 'Anklageren fremlægger tiltalen og fører de bærende beviser først.',
  },
  {
    id: 'term-forsvarer',
    term: 'Forsvarer',
    category: 'Roller',
    shortDefinition: 'Tiltaltes juridiske repræsentant, hvis opgave er at varetage tiltaltes tarv og teste beviserne.',
    courtroomExample: 'Forsvareren påpeger alternative forklaringer og manglende bevisvægt.',
  },
  {
    id: 'term-forsaet',
    term: 'Forsæt vs. Uagtsomhed',
    category: 'Strafferet',
    shortDefinition: 'Forsæt betyder at handle med vilje/viden; uagtsomhed betyder at handle skødesløst uden den fornødne agtpågivenhed.',
    courtroomExample: 'At køre for stærkt i gågade kan være groft uagtsomt.',
  },
  {
    id: 'term-relevans',
    term: 'Relevanskriterium',
    category: 'Procesret',
    shortDefinition: 'Et bevis må kun tillægges vægt, hvis det kan belyse et omtvistet punkt i sagen.',
    courtroomExample: 'Dommeren afviser en tre dage gammel bagerkvittering som irrelevant.',
  },
];

export const SHOP_ITEMS: ShopItem[] = [
  // Hats
  { id: 'hat-none', name: 'Ingen hovedbeklædning', category: 'hat', price: 0, description: 'Naturlig frisure i retssalen.', value: 'none' },
  { id: 'hat-wig', name: 'Klassisk Dommerparyk', category: 'hat', price: 150, description: 'Traditionel hvid krøllet paryk til højtidelige sager.', value: 'wig' },
  { id: 'hat-fedora', name: 'Forsvarer-baret', category: 'hat', price: 220, description: 'Skarp mørkegrå dommer-/advokatbaret.', value: 'beret' },
  { id: 'hat-tophat', name: 'Højesterets Cylinderhat', category: 'hat', price: 420, description: 'Eksklusiv sort silkehat med messingbånd.', value: 'tophat' },
  // Outfits
  { id: 'outfit-classic', name: 'Klassisk Retssalskappe', category: 'outfit', price: 0, description: 'Standard sort advokat- eller dommerkappe.', value: 'classic' },
  { id: 'outfit-suit', name: 'Nordisk Skræddersæt', category: 'outfit', price: 180, description: 'Moderne uldjakkesæt med hvid flip.', value: 'suit' },
  { id: 'outfit-ermine', name: 'Højesteretskappe m. Trim', category: 'outfit', price: 380, description: 'Bred skulderkappe med hvidt hermelin-bånd.', value: 'ermine' },
  // Colors
  { id: 'color-burgundy', name: 'Justits-Bordeaux', category: 'color', price: 0, description: 'Dyb rødbrun accentfarve.', previewHex: '#7C2D2D', value: '#7C2D2D' },
  { id: 'color-navy', name: 'Sø- & Handelsret Blå', category: 'color', price: 120, description: 'Mørk maritim skiferblå.', previewHex: '#1E3A5F', value: '#1E3A5F' },
  { id: 'color-gold', name: 'Gylden Messing', category: 'color', price: 260, description: 'Varm forgyldt kant på kappe og revers.', previewHex: '#A87C2D', value: '#A87C2D' },
  { id: 'color-emerald', name: 'Nordisk Skovgrøn', category: 'color', price: 200, description: 'Dæmpet mørkegrøn accent.', previewHex: '#234E3D', value: '#234E3D' },
  // Animations
  { id: 'anim-gavel', name: 'Autoritativ Gestus', category: 'animation', price: 0, description: 'Rolig, fast håndføring under procedure.', value: 'authoritative' },
  { id: 'anim-point', name: 'Skarp Indsigelse', category: 'animation', price: 160, description: 'Dramatisk fremadpegende gestikulation ved indlæg.', value: 'dramatic' },
  { id: 'anim-bow', name: 'Værdigt Nik', category: 'animation', price: 240, description: 'Højtideligt buk og hånd på hjerte før afslutning.', value: 'dignified' },
  // Courtroom Themes
  { id: 'court-oak', name: 'Klassisk Dansk Eg', category: 'courtroom', price: 0, description: 'Varmt egetræ, mørke paneler og messinglamper.', value: 'oak' },
  { id: 'court-birch', name: 'Lys Nordisk Birk', category: 'courtroom', price: 300, description: 'Lyst skandinavisk byret-design i birk og uld.', value: 'birch' },
  { id: 'court-marble', name: 'Højesteret Marmor', category: 'courtroom', price: 500, description: 'Monumental sal i mørk skifer og hvid marmor.', value: 'marble' },
];

export const AI_CHARACTER_PROFILES: AiCharacterProfile[] = [
  {
    id: 'ai-prosecutor',
    name: 'Statsadvokat Birgitte Lind',
    title: 'Modstående AI-Anklager',
    category: 'counsel',
    roleBadge: 'AI-Anklager',
    seatLabel: 'Anklagerpult (Venstre)',
    portraitSrc: '/portraits/ai-prosecutor.jpg',
    backstory:
      'Tidligere senioranklager ved Østre Landsret med 14 års erfaring i økonomisk kriminalitet og tekniske logdata. Kendt for sin metodiske gennemgang af tidsstempler.',
    rhetoricStyle:
      'Kølig, kronologisk og nådesløs mod uafklarede huller i tiltaltes alibi. Griber straks efter digitale primærspor.',
    persuasionTrigger:
      'Taber terræn, når du dokumenterer objektive modbeviser eller påpeger svage observationsforhold (regn, afstand, uklare fotos).',
    weakness:
      'Stoler undertiden for tungt på indicier og tekniske logs uden at afdække alternative brugerforhold.',
  },
  {
    id: 'ai-defender',
    name: 'Advokat Mikkel Højgaard',
    title: 'Modstående AI-Forsvarer',
    category: 'counsel',
    roleBadge: 'AI-Forsvarer',
    seatLabel: 'Forsvarerpult (Højre)',
    portraitSrc: '/portraits/ai-defender.jpg',
    backstory:
      'Erfaren forsvarsadvokat fra Aarhus med speciale i bevisvurdering og krydsforhør. Har vundet flere nævningesager på teknisk tvivl og processuel præcision.',
    rhetoricStyle:
      'Skarp, spørgende og konsekvent fokuseret på "in dubio pro reo" – enhver rimelig tvivl skal komme tiltalte til gode.',
    persuasionTrigger:
      'Svækkes, når du forbinder uafhængige bilag i en ubrydelig kausal kæde og afviser hans alternative forklaringer direkte.',
    weakness:
      'Kan overse helheden, hvis du binder flere primærbeviser sammen med præcise krydsforhørsspørgsmål.',
  },
  {
    id: 'juror-astrid',
    name: 'Astrid Holm',
    title: 'Retsrevisor & Logikanalytiker',
    category: 'jury',
    roleBadge: 'Jury-plads 1–2',
    seatLabel: 'Lægdommer · Teknisk fløj',
    portraitSrc: '/portraits/juror-astrid.jpg',
    backstory:
      'Statsautoriseret revisor fra Odense med blik for bilagsrækker, kvitteringer og regnskabsmæssig orden. Irriteres straks af irrelevante dokumenter.',
    rhetoricStyle:
      'Søger stram kausalitet mellem tidspunkt og dokumentation – belønner præcise citater af højest 1–2 bilag pr. indlæg.',
    persuasionTrigger:
      'Overbevises af skarpe tidsstempler og tydelige årsagsord som "dokumenterer", "sammenholdt" og "beviser".',
    weakness:
      'Straffer øjeblikkeligt bevis-spam, gentagelser og løse påstande uden bilagsnummer.',
  },
  {
    id: 'juror-bent',
    name: 'Bent Kjeldsen',
    title: 'Skoleinspektør & Vidnepsykolog',
    category: 'jury',
    roleBadge: 'Jury-plads 3–4',
    seatLabel: 'Lægdommer · Troværdighed',
    portraitSrc: '/portraits/juror-bent.jpg',
    backstory:
      'Tidligere efterskoleforstander med 30 års erfaring i at vurdere menneskers forklaringer under pres. Vægter vidners motiver og sigtbarhed højt.',
    rhetoricStyle:
      'Lytter efter ægte modsigelser i forklaringer og tester, om et vidne reelt kunne se det påståede.',
    persuasionTrigger:
      'Overbevises af velrettet krydsforhør, der blidt men præcist udstiller uoverensstemmelser i modpartens forklaring.',
    weakness:
      'Mister tillid ved aggressive personangreb uden faktuel forankring i vidneforklaringen.',
  },
  {
    id: 'juror-layla',
    name: 'Layla Mansour',
    title: 'Civilingeniør & Teknologirådgiver',
    category: 'jury',
    roleBadge: 'Jury-plads 5–6',
    seatLabel: 'Lægdommer · Bevisstandard',
    portraitSrc: '/portraits/juror-layla.jpg',
    backstory:
      'Systemsikkerheds-ingeniør i København, vant til adgangslogs, telemetri og videokvalitet. Skelner benhårdt mellem målte data og menneskelige gæt.',
    rhetoricStyle:
      'Stiller krav om, at anklageren løfter bevisbyrden objektivt – og accepterer aldrig et kornet billede som enebærende bevis.',
    persuasionTrigger:
      'Overbevises af teknisk sammenhæng mellem sensor-/logdata og verificerbare fysiske spor.',
    weakness:
      'Skeptisk over for skråsikre konklusioner, hvis modparten kan opstille en plausibel teknisk fejl eller forsinkelse.',
  },
];

