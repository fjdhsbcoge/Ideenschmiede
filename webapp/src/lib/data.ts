export type IdeaStage = 'discussion' | 'voting' | 'funding' | 'building' | 'completed';

export interface Comment {
  id: string;
  author: string;
  role: 'user' | 'subscriber';
  time: string;
  text: string;
  likes: number;
  score: number; // chain-of-thought score
  replies?: Comment[]; // eine Verschachtelungsebene (Thread)
}

export interface RevenueReport {
  month: string;
  revenue: number; // sat
  note: string;
  tx: string; // beispiel-txid
}

export interface TeamUpdate {
  date: string;
  title: string;
  text: string;
}

export interface Shareholder {
  name: string;
  pct: number;
  isLeader?: boolean;
}

export interface TeamApplication {
  id: string;
  applicant: string;
  skills: string;
  hours: number;
  message: string;
  date: string;
  status: 'offen' | 'angenommen' | 'abgelehnt';
}

export interface TeamMember {
  name: string;
  role: string;
}

export interface Team {
  id: string;
  ideaId: string;
  name: string;
  leader: string;
  focus: string;
  members: number;
  fundingGoal: number; // sat
  raised: number; // sat
  skinInGame: number; // sat
  status: 'funding' | 'building' | 'completed';
  milestones: { title: string; done: boolean; dueDate: string; budget: number; deliverables?: string[] }[];
  verified: boolean;
  memberList?: TeamMember[];
  shareholders?: Shareholder[];
  revenueReports?: RevenueReport[];
  updates?: TeamUpdate[];
  incomingApplications?: TeamApplication[];
}

export interface Idea {
  id: string;
  title: string;
  author: string;
  time: string;
  tags: string[];
  stage: IdeaStage;
  description: string;
  problem: string;
  solution: string;
  market: string;
  comments: Comment[];
  votes: { up: number; down: number };
  // marketplace
  fundingGoal?: number;
  raised?: number;
  investors?: number;
  closesIn?: string;
  votingEndsIn?: string;
  sharePrice?: number; // sat per 1k shares
  teams?: Team[];
}

export const STAGE_LABELS: Record<IdeaStage, string> = {
  discussion: 'Diskussion',
  voting: 'Voting',
  funding: 'Funding',
  building: 'Building',
  completed: 'Abgeschlossen',
};

export const ideas: Idea[] = [
  {
    id: 'tubular-linear-motor',
    title: 'Open-Source Röhren-Linearmotor für Makers',
    author: '@senator-thunfisch',
    time: 'vor 2 Tagen',
    tags: ['Hardware', 'Open Source', 'Antriebstechnik'],
    stage: 'funding',
    description:
      'Ein vollständig offener Röhren-Linearmotor (Tubular Linear Motor) mit 3D-druckbaren Komponenten, SimpleFOC-kompatibler Ansteuerung und dokumentierter Wicklungsanleitung. Ziel: Präzise Linearantriebe für <150 € statt >800 € Industriepreisen.',
    problem:
      'Linearmotoren sind für Maker, Laborautomatisierung und kleine Maschinenbauer praktisch unerschwinglich. Kommerzielle Tubular-Motoren kosten 800–3.000 €, Dokumentation ist proprietär, Ersatzteile kaum verfügbar.',
    solution:
      'Open-Source-Bausatz: CFK-Röhre, Neodym-Magnetstab, handwickelbare Dreiphasen-Spulen, SimpleFOC-Shield-Ansteuerung. Alle CAD-Dateien, FEMM-Simulationen und Wickelpläne unter CERN-OHL. Community verbessert Design iterativ.',
    market:
      'Makerszene (>2M aktive Bastler weltweit), Laborautomatisierung, Bildung (MINT), Kleinserien-Maschinenbau. Vergleichsprojekte (SimpleFOC, Voron) zeigen: Open-Hardware erreicht zehntausende Builds.',
    votes: { up: 342, down: 31 },
    fundingGoal: 12_000_000,
    raised: 8_940_000,
    investors: 47,
    closesIn: '9 Tage',
    sharePrice: 120,
    comments: [
      { id: 'c1', author: '@magnetwerk', role: 'subscriber', time: 'vor 1 Tag', text: 'Die FEMM-Simulationen im Repo sind solide. Habe den Motor nachgebaut – 0,3 T am Stab gemessen, passt zu den Angaben. Skin-in-game des Urhebers überzeugt mich.', likes: 28, score: 14,
        replies: [
          { id: 'c1-r1', author: '@tobias_r', role: 'user', time: 'vor 22 h', text: 'Danke für den Nachbau! Hast du die Wicklungsdaten auch ins Repo gepusht? Würde sie gern in die Referenzdoku übernehmen.', likes: 6, score: 3 },
          { id: 'c1-r2', author: '@magnetwerk', role: 'subscriber', time: 'vor 21 h', text: 'Klar – Branch `coil-measurements` ist offen. Thermie-Daten folgen am Wochenende.', likes: 9, score: 4 },
        ] },
      { id: 'c2', author: '@lisa_baut', role: 'user', time: 'vor 20 h', text: 'Wäre eine wassergekühlte Variante denkbar? Für Dauerbetrieb in der Laborautomatisierung wäre das relevant.', likes: 11, score: 6,
        replies: [
          { id: 'c2-r1', author: '@femm_felix', role: 'user', time: 'vor 12 h', text: 'Habe das mal durchgerechnet: Mit 8 mm Kühlkanälen im Trägerrohr halten wir Dauerbetrieb bei 120 % Nennlast. Erhöht aber die Fertigungskosten ~15 %.', likes: 13, score: 7 },
        ] },
      { id: 'c3', author: '@odrive_fan', role: 'subscriber', time: 'vor 8 h', text: 'Alternativ ODrive statt SimpleFOC? Hätte mehr Leistung, aber höhere Komplexität. Eventuell als Stretch-Goal?', likes: 17, score: 9 },
    ],
    teams: [
      {
        id: 'team-kern', ideaId: 'tubular-linear-motor', name: 'Team Kernspalt', leader: '@magnetwerk',
        focus: 'Referenzdesign + Dokumentation', members: 4,
        fundingGoal: 6_000_000, raised: 4_800_000, skinInGame: 600_000,
        status: 'building', verified: true,
        memberList: [
          { name: '@magnetwerk', role: 'Lead · Elektromagnetik' },
          { name: '@coil_chris', role: 'Wicklung & Fertigung' },
          { name: '@doku_dana', role: 'Dokumentation' },
          { name: '@femm_felix', role: 'Simulation' },
        ],
        shareholders: [
          { name: '@magnetwerk (Skin-in-game)', pct: 12.5, isLeader: true },
          { name: '@tobias_r', pct: 6.2 },
          { name: '@odrive_fan', pct: 5.8 },
          { name: '42 weitere Investoren', pct: 75.5 },
        ],
        revenueReports: [
          { month: 'Juni 2026', revenue: 305_000, note: '17 Bausatz-Vorbestellungen + 2 Workshop-Buchungen', tx: 'a1b2c3…f9e8' },
          { month: 'Mai 2026', revenue: 142_000, note: 'Erste 8 Vorbestellungen nach Tutorial-Release', tx: 'd4e5f6…c7b8' },
        ],
        updates: [
          { date: '2026-07-14', title: 'SimpleFOC-Regelung: 80 % erreicht', text: 'Offene Regelschleife läuft stabil bei 24 V. Positionsregelung noch schwierig bei Lastwechseln – wir testen diese Woche Rampen-Profile. Details im GitHub-Repo.' },
          { date: '2026-07-02', title: 'Milestone M2 bestätigt ✅', text: 'Wicklungs-Tutorial + Video sind live. Investoren haben mit 94 % Ja-Stimmen die Tranche freigegeben. Danke für das Vertrauen!' },
          { date: '2026-06-18', title: 'CFK-Röhren: Charge 2 eingetroffen', text: 'Neue CFK-Röhren mit engeren Toleranzen sind da. Magnetismus-Messungen außerhalb des Rohrs: max. 0,3 T – im erwarteten Bereich.' },
        ],
        incomingApplications: [
          { id: 'app1', applicant: '@löt_lisa', skills: 'SMD-Löten, PCB-Design, KiCad', hours: 8, message: 'Ich kann die SimpleFOC-Platinen bestücken und testen. Habe ein eigenes Reflow-Setup.', date: '2026-07-15', status: 'offen' },
          { id: 'app2', applicant: '@cad_karl', skills: 'Fusion360, 3D-Druck (CFK-Nylon)', hours: 5, message: 'Würde gern die Halterungen und Endkappen überarbeiten – die aktuellen STL-Dateien haben Verbesserungspotenzial bei den Toleranzen.', date: '2026-07-13', status: 'offen' },
          { id: 'app3', applicant: '@video_vic', skills: 'Videoproduktion, Motion Design', hours: 4, message: 'Könnte die Bausatz-Anleitung als professionelle Video-Serie aufbereiten.', date: '2026-07-10', status: 'abgelehnt' },
        ],
        milestones: [
          { title: 'Prototyp V2 mit CFK-Röhre', done: true, dueDate: '2026-05-30', budget: 1_500_000, deliverables: ['Funktionsfähiger Prototyp', 'Messbericht (Kraft, Hub, Temperatur)', 'CAD-Dateien v2.0'] },
          { title: 'Wicklungs-Tutorial + Video', done: true, dueDate: '2026-06-20', budget: 1_000_000, deliverables: ['Schriftliche Anleitung (DE/EN)', 'Video-Tutorial 25 min', 'Wickelschema-Poster'] },
          { title: 'SimpleFOC-Regelung stabil', done: false, dueDate: '2026-08-15', budget: 2_000_000, deliverables: ['Firmware v1.0 mit Positionsregelung', 'Testprotokoll Dauerbetrieb 100 h', 'Parameter-Guide'] },
          { title: 'Bausatz-Dokumentation v1.0', done: false, dueDate: '2026-09-30', budget: 1_500_000, deliverables: ['Komplette BOM mit Lieferanten', 'Schritt-für-Schritt-Aufbauanleitung', 'Sicherheitshinweise'] },
        ],
      },
      {
        id: 'team-flux', ideaId: 'tubular-linear-motor', name: 'Team Fluxforge', leader: '@lisa_baut',
        focus: 'Leistungsvariante 500W', members: 3,
        fundingGoal: 5_000_000, raised: 2_150_000, skinInGame: 250_000,
        status: 'funding', verified: false,
        memberList: [
          { name: '@lisa_baut', role: 'Lead · Thermik' },
          { name: '@kühl_kai', role: 'Fluidik' },
          { name: '@power_pia', role: 'Leistungselektronik' },
        ],
        shareholders: [
          { name: '@lisa_baut (Skin-in-game)', pct: 5.0, isLeader: true },
          { name: '@grid_operator', pct: 4.1 },
          { name: '18 weitere Investoren', pct: 90.9 },
        ],
        updates: [
          { date: '2026-07-11', title: 'Thermische Simulation läuft', text: 'Erste CFD-Modelle der Wasserkühlung zeigen: 500 W Dauerleistung ist bei 40 °C Kühlwasser realistisch. Bericht folgt mit Meilenstein M1.' },
        ],
        incomingApplications: [
          { id: 'app4', applicant: '@pumpe_pete', skills: 'Kreislaufdesign, CNC', hours: 6, message: 'Kann den Kühlkreislauf aus Standardkomponenten aufbauen – Pumpe, Radiator, Schläuche alles < 80 €.', date: '2026-07-16', status: 'offen' },
        ],
        milestones: [
          { title: 'Thermische Simulation', done: false, dueDate: '2026-08-01', budget: 1_200_000 },
          { title: 'Wasserkühlung Prototyp', done: false, dueDate: '2026-10-01', budget: 2_300_000 },
          { title: 'Dauerlast-Test 1000h', done: false, dueDate: '2026-12-15', budget: 1_500_000 },
        ],
      },
    ],
  },
  {
    id: 'wellen-lineargenerator',
    title: 'Wellenenergie-Boje mit Dreiphasen-Lineargenerator',
    author: '@nordlicht',
    time: 'vor 5 Tagen',
    tags: ['Energie', 'Hardware', 'Nachhaltigkeit'],
    stage: 'voting',
    description:
      'Kleine Wellenenergie-Boje, die lineare Hubbewegung direkt in Drehstrom wandelt – ohne Getriebe, ohne rotierende Teile im Wasser. Frequenzanpassung ans Netz über aktiven Gleichrichter + Wechselrichter.',
    problem:
      'Wellenenergie scheitert bisher an komplexer Mechanik: Getriebe und rotierende Generatoren korrodieren, Wartung auf See ist extrem teuer. Kleine Anlagen für Küstenregionen existieren kaum.',
    solution:
      'Direktantrieb-Lineargenerator: Der Wellenhub treibt einen Magnetschlitten durch feste Spulen. Frequenz wird elektronisch ans Netz angepasst (DC-Link + Grid-Inverter), Mechanik bleibt minimal und gekapselt.',
    market:
      'Inselnetze, Aquakultur, Forschungsplattformen, Küstenregionen ohne Netzanschluss. Globaler Wellenenergie-Markt wird auf >4 Mrd. € bis 2030 geschätzt.',
    votes: { up: 512, down: 89 },
    votingEndsIn: '3 Tage',
    investors: 0,
    raised: 0,
    fundingGoal: 25_000_000,
    sharePrice: 250,
    comments: [
      { id: 'c4', author: '@senator-thunfisch', role: 'subscriber', time: 'vor 3 Tagen', text: 'Synergie mit dem Tubular-Motor-Projekt: Die Spulenfertigung ist fast identisch. Könnte als zweites Team im selben Ökosystem laufen.', likes: 34, score: 16 },
      { id: 'c5', author: '@grid_operator', role: 'user', time: 'vor 2 Tagen', text: 'Netzanbindung ist der Knackpunkt. Bei 0,5–2 Hz Wellenfrequenz braucht ihr einen ordentlichen Zwischenkreis. Superkaps statt Batterie erwägen?', likes: 22, score: 12,
        replies: [
          { id: 'c5-r1', author: '@senator-thunfisch', role: 'subscriber', time: 'vor 1 Tag', text: 'Superkaps sind im Konzept vorgesehen (siehe Abschnitt Energiekette). Batterie nur als Puffer für den Netzanschlusspunkt.', likes: 8, score: 5 },
        ] },
    ],
    teams: [],
  },
  {
    id: 'polymer-filament',
    title: 'Leitfähiges Polymer-Filament für 3D-Druck',
    author: '@carbonlab',
    time: 'vor 1 Tag',
    tags: ['Materialwissenschaft', '3D-Druck', 'Chemie'],
    stage: 'discussion',
    description:
      'Entwicklung eines 3D-druckbaren Filaments auf Basis leitfähiger Polymere (Polyazetylen-Derivate), mit dem sich Sensoren, Heizelemente und einfache Schaltungen direkt drucken lassen.',
    problem:
      'Leitfähige Filamente existieren, erreichen aber bestenfalls 10²–10³ S/m – für echte Elektronik zu wenig. Kupfer-Verbundfilamente sind abrasiv, teuer und schwer verarbeitbar.',
    solution:
      'Katalytische Polymerisation direkt im Trägermatrix-Verbund: Ziel Leitfähigkeit >10⁴ S/m bei druckbarer Viskosität. Rezeptur und Prozess werden offen dokumentiert.',
    market:
      'Rapid Prototyping Elektronik, Bildungsmarkt, Wearables, Forschung. Markt für Funktionsfilamente wächst ~20 % jährlich.',
    votes: { up: 96, down: 12 },
    comments: [
      { id: 'c6', author: '@polymer_pia', role: 'user', time: 'vor 12 h', text: 'Spannend! Wie stabil ist die Leitfähigkeit unter Oxidation? Polyazetylene degradieren an Luft bekanntermaßen schnell.', likes: 9, score: 5 },
    ],
    teams: [],
  },
  {
    id: 'nas-inventory',
    title: 'Selbstgehostetes Inventar-System für Maker-Werkstätten',
    author: '@werkstatt_willi',
    time: 'vor 3 Tagen',
    tags: ['Software', 'Self-Hosting', 'Open Source'],
    stage: 'discussion',
    description:
      'Ein schlankes, auf Synology/NAS lauffähiges Inventarsystem: Bauteile fotografieren, KI erkennt und kategorisiert sie automatisch, Lagerorte werden vorgeschlagen. Kein Cloud-Zwang.',
    problem:
      'Maker verlieren im Schnitt Stunden pro Woche mit Suchen nach Bauteilen. Bestehende ERP-Systeme sind überdimensioniert, cloudpflichtig oder kostenpflichtig.',
    solution:
      'Docker-Container fürs heimische NAS: Foto → lokale Vision-KI → Etikett + Lagerplatzvorschlag. Barcode-Druck, Reservierung für Projekte, Offline-first.',
    market:
      'Makerspaces (>4.000 weltweit), Heimwerker mit NAS (>10M Synology-Geräte im Feld), kleine Reparaturbetriebe.',
    votes: { up: 154, down: 41 },
    comments: [
      { id: 'c7', author: '@datenschutz_dan', role: 'subscriber', time: 'vor 1 Tag', text: 'Endlich Inventar ohne Cloud. Wenn die Erkennung lokal auf einem DS224 läuft, bin ich dabei. Wie viel RAM braucht das Modell?', likes: 13, score: 7 },
    ],
    teams: [],
  },
  {
    id: 'community-repair',
    title: 'Repair-Café Matching-Plattform mit Ersatzteil-Pool',
    author: '@reparatur_rita',
    time: 'vor 6 Tagen',
    tags: ['Community', 'Nachhaltigkeit', 'Plattform'],
    stage: 'funding',
    description:
      'Plattform, die kaputte Geräte mit Reparatur-Expertise in der Nähe matcht und einen geteilten Ersatzteil-Pool organisiert. Spendenfinanziert, Gewinne aus Vermittlung spezieller Teile fließen zu 20/80 an Idee und Team.',
    problem:
      'Repair-Cafés arbeiten isoliert: Kein gemeinsamer Teilepool, keine Termin-Matching-Software, viele Geräte bleiben unrepariert, obwohl das Teil 20 km entfernt läge.',
    solution:
      'Regionale Cluster mit gemeinsamem Teilelager, Matching-Algorithmus Gerät↔Experte, Versandlogistik für Spezialteile. Integration mit Open-Repair-Datenbanken.',
    market:
      '>3.000 Repair-Cafés in Europa, Recht-auf-Reparatur schafft regulatorischen Rückenwind, Ersatzteilmarkt Haushaltsgeräte >10 Mrd. €.',
    votes: { up: 287, down: 52 },
    fundingGoal: 8_000_000,
    raised: 3_260_000,
    investors: 29,
    closesIn: '16 Tage',
    sharePrice: 80,
    comments: [
      { id: 'c8', author: '@green_gerd', role: 'subscriber', time: 'vor 4 Tagen', text: 'Das Recht auf Reparatur macht das Timing perfekt. Ich würde als Investor einsteigen, wenn das Team Logistik-Erfahrung mitbringt.', likes: 19, score: 10 },
    ],
    teams: [
      {
        id: 'team-fix', ideaId: 'community-repair', name: 'Team Fixhub', leader: '@reparatur_rita',
        focus: 'MVP Matching + Teilepool Berlin', members: 5,
        fundingGoal: 4_000_000, raised: 1_900_000, skinInGame: 400_000,
        status: 'funding', verified: true,
        memberList: [
          { name: '@reparatur_rita', role: 'Lead · Community' },
          { name: '@match_max', role: 'Backend' },
          { name: '@ui_ute', role: 'Frontend' },
          { name: '@logistik_leo', role: 'Teilepool-Logistik' },
          { name: '@recht_rudi', role: 'Vereinsrecht (ehrenamtlich)' },
        ],
        shareholders: [
          { name: '@reparatur_rita (Skin-in-game)', pct: 10.0, isLeader: true },
          { name: '@green_gerd', pct: 7.5 },
          { name: '24 weitere Investoren', pct: 82.5 },
        ],
        updates: [
          { date: '2026-07-08', title: 'Zwei Repair-Cafés für Pilot zugesagt', text: 'Repair-Café Kreuzberg und Wedding Repair sind für den Piloten dabei. Gespräche mit drei weiteren laufen.' },
        ],
        incomingApplications: [],
        milestones: [
          { title: 'MVP Matching-Algorithmus', done: false, dueDate: '2026-08-30', budget: 1_500_000 },
          { title: 'Pilot: 5 Repair-Cafés Berlin', done: false, dueDate: '2026-10-30', budget: 1_500_000 },
          { title: 'Teilepool-Logistik v1', done: false, dueDate: '2026-12-30', budget: 1_000_000 },
        ],
      },
    ],
  },
  {
    id: 'balcony-solar',
    title: 'Balkonkraftwerk-Sharing für Mieter:innen',
    author: '@sonnenseite',
    time: 'vor 4 Tagen',
    tags: ['Energie', 'PropTech', 'Plattform'],
    stage: 'completed',
    description:
      'Verwaltungsplattform, mit der Mieter:innen sich Balkonkraftwerke teilen: Abrechnung pro Wohnung, Messung via Smart Meter, rechtssichere Vorlagen für Vermieter-Kommunikation. Pilot erfolgreich, Team übernommen.',
    problem: 'Viele Mieter können kein eigenes Balkonkraftwerk installieren (Statik, Ausrichtung, Vermieter). Gemeinschaftsnutzung scheitert an Abrechnung.',
    solution: 'Geteilte Anlage + softwarebasierte Verbrauchszuordnung. Der Pilot mit 12 Parteien lief 14 Monate fehlerfrei.',
    market: '>20 Mio. Mietwohnungen in Deutschland, Balkonkraftwerke-Boom >1 Mio. registrierte Anlagen.',
    votes: { up: 623, down: 44 },
    fundingGoal: 15_000_000,
    raised: 15_000_000,
    investors: 112,
    closesIn: 'abgeschlossen',
    sharePrice: 150,
    comments: [],
    teams: [
      {
        id: 'team-sonne', ideaId: 'balcony-solar', name: 'Team Sonnensplitter', leader: '@sonnenseite',
        focus: 'Plattform + Abrechnung', members: 6,
        fundingGoal: 8_000_000, raised: 8_000_000, skinInGame: 800_000,
        status: 'completed', verified: true,
        milestones: [
          { title: 'Pilotanlage 12 Parteien', done: true, dueDate: '2025-10-01', budget: 3_000_000 },
          { title: 'Abrechnungs-SaaS v1', done: true, dueDate: '2026-01-15', budget: 3_000_000 },
          { title: 'Rechtliche Vorlagenbibliothek', done: true, dueDate: '2026-03-01', budget: 2_000_000 },
        ],
      },
    ],
  },
];

export interface Investment {
  id: string;
  ideaId: string;
  ideaTitle: string;
  type: 'Idea-Shares' | 'Team-Shares';
  team?: string;
  amount: number; // sat
  shares: number; // thousands
  date: string;
  status: 'aktiv' | 'pending' | 'abgeschlossen';
  earnings: number; // sat
  roi: number; // %
}

export const myInvestments: Investment[] = [
  { id: 'inv1', ideaId: 'tubular-linear-motor', ideaTitle: 'Open-Source Röhren-Linearmotor', type: 'Idea-Shares', amount: 500_000, shares: 4_167, date: '2026-06-28', status: 'aktiv', earnings: 62_400, roi: 12.5 },
  { id: 'inv2', ideaId: 'tubular-linear-motor', ideaTitle: 'Open-Source Röhren-Linearmotor', type: 'Team-Shares', team: 'Team Kernspalt', amount: 300_000, shares: 2_500, date: '2026-07-02', status: 'aktiv', earnings: 41_100, roi: 13.7 },
  { id: 'inv3', ideaId: 'community-repair', ideaTitle: 'Repair-Café Matching-Plattform', type: 'Idea-Shares', amount: 250_000, shares: 3_125, date: '2026-07-06', status: 'aktiv', earnings: 8_750, roi: 3.5 },
  { id: 'inv4', ideaId: 'balcony-solar', ideaTitle: 'Balkonkraftwerk-Sharing', type: 'Idea-Shares', amount: 400_000, shares: 2_667, date: '2026-03-12', status: 'abgeschlossen', earnings: 312_000, roi: 78.0 },
  { id: 'inv5', ideaId: 'wellen-lineargenerator', ideaTitle: 'Wellenenergie-Boje', type: 'Team-Shares', team: 'Reserviert', amount: 150_000, shares: 0, date: '2026-07-14', status: 'pending', earnings: 0, roi: 0 },
];

export const earningsByMonth = [
  { month: 'Feb', value: 18_000 },
  { month: 'Mär', value: 42_000 },
  { month: 'Apr', value: 55_000 },
  { month: 'Mai', value: 61_500 },
  { month: 'Jun', value: 89_300 },
  { month: 'Jul', value: 112_250 },
];

export const earningsEvents = [
  { date: '2026-07-10', source: 'Balkonkraftwerk-Sharing · Team Sonnensplitter', type: 'Revenue-Share (Idea-Shares)', amount: 38_500 },
  { date: '2026-07-02', source: 'Röhren-Linearmotor · Team Kernspalt', type: 'Milestone-Bonus M2', amount: 21_100 },
  { date: '2026-06-24', source: 'Balkonkraftwerk-Sharing · Team Sonnensplitter', type: 'Revenue-Share (Idea-Shares)', amount: 36_900 },
  { date: '2026-06-05', source: 'Röhren-Linearmotor', type: 'Chain-of-Thought Rewards', amount: 4_750 },
  { date: '2026-05-28', source: 'Balkonkraftwerk-Sharing · Team Sonnensplitter', type: 'Revenue-Share (Idea-Shares)', amount: 34_100 },
  { date: '2026-05-12', source: 'Röhren-Linearmotor · Team Kernspalt', type: 'Revenue-Share (Team-Shares)', amount: 20_000 },
];

export const wallet = {
  address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  balance: 2_847_600, // sat
  subscribedUntil: '2027-03-15',
};

export function getIdea(id: string): Idea | undefined {
  return ideas.find(i => i.id === id);
}

export function votePercent(idea: Idea): number {
  const total = idea.votes.up + idea.votes.down;
  return total === 0 ? 0 : Math.round((idea.votes.up / total) * 100);
}
