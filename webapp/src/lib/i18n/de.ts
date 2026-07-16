/**
 * Deutsche Sprachdatei (Referenz-Struktur für alle künftigen Sprachen).
 * Neue Sprache = Kopie dieser Datei, Werte übersetzen, in index.tsx registrieren.
 */
export const de = {
  roles: {
    visitor: { name: 'Visitor', description: 'Nicht angemeldet' },
    user: { name: 'User', description: 'Angemeldet (kostenlos)' },
    subscriber: { name: 'Subscriber', description: '$120/Jahr – Voller Zugriff' },
    switcherNote: 'Demo-Modus: Rolle frei wählbar',
    switcherAria: 'Rolle wechseln',
    switchedToast: (name: string) => `Rolle gewechselt: ${name}`,
  },

  nav: {
    discussion: 'Ideen-Diskussion',
    marketplace: 'Marktplatz',
    teams: 'Meine Teams',
    dashboard: 'Dashboard',
    profile: 'Profil',
    login: 'Anmelden',
    badges: { free: 'Frei', member: 'Mitglied', login: 'Login' },
    menuAria: 'Menü',
  },

  footer: {
    taglineA: 'The Marketplace for Ideas.',
    taglineB: 'Die Wertschöpfungskette von der Idee zum Produkt – neu gedacht.',
    platform: 'Plattform',
    links: { discussion: 'Ideen-Diskussion', marketplace: 'Marktplatz', teams: 'Teams', process: 'Prozess' },
    principlesTitle: 'Prinzipien',
    principles: ['₿ Bitcoin-only', '⚖️ 20/80 Fairness', '🗳️ 1 Person = 1 Stimme', '🔍 Radikale Transparenz'],
    ossTitle: 'Open Source',
    ossRepo: 'GitHub-Repository',
    ossDocs: 'Vision · Architektur · Build-Dokumentation',
    legal: 'Ideenschmiede · Interaktive Demo v1.0 · Alle Daten sind Beispieldaten · Keine echte Zahlungsabwicklung',
  },

  paywall: {
    title: 'Subscriber-Bereich',
    bodyA: 'ist exklusiv für Subscriber verfügbar. Die Subscription finanziert die Plattform, verhindert Sybil-Angriffe und garantiert:',
    bodyHighlight: '1 Person = 1 Stimme',
    price: '$120',
    priceNote: 'pro Jahr · Unbegrenzter Zugang · zahlbar in Bitcoin',
    features: [
      'In alle Marktplatz-Ideen investieren',
      'Gewinnbeteiligung erhalten (20/80-Split)',
      'Über Ideen abstimmen',
      'Teams bewerten und auswählen',
      'Eigene Teams gründen & Funding erhalten',
    ],
    cta: 'Jetzt Subscriber werden (Demo)',
    welcomeToast: 'Willkommen als Subscriber! ⭐ Voller Zugriff freigeschaltet.',
    back: '← Zurück zur Diskussion',
  },

  landing: {
    heroBadge: '⚡ The Marketplace for Ideas',
    heroTitleA: 'Aus Ideen wird hier',
    heroTitleB: 'Wirklichkeit geschmiedet.',
    heroSubA: 'Ideengeber, Macher und Geldgeber an einem Ort: Die Community validiert, Teams bauen im Wettbewerb – und der Ertrag wird fair geteilt.',
    heroSubHighlight: '20 % für die Idee, 80 % für die Macher.',
    heroCtaPrimary: '💡 Ideen entdecken',
    heroCtaSecondary: '🛒 Zum Marktplatz',
    stats: [
      ['127', 'Ideen in Diskussion'],
      ['34', 'aktive Teams'],
      ['₿ 2,41', 'Investitionsvolumen'],
      ['92 %', 'Milestone-Quote'],
    ] as [string, string][],

    problemTitle: 'Warum Ideen heute sterben',
    problemSub: 'Vier Brüche in der Wertschöpfungskette – vier Gründe, warum aus den meisten guten Ideen nie ein Produkt wird.',
    problems: [
      { icon: '🥀', title: 'Ideen sterben in Isolation', text: 'Gute Ideen werden nie gebaut, weil Ideengebern Ressourcen fehlen.' },
      { icon: '🧭', title: 'Machern fehlt die Richtung', text: 'Entwickler wollen bauen, wissen aber nicht, was der Markt braucht.' },
      { icon: '🚪', title: 'Investment ist gatekeept', text: 'Nur akkreditierte Investoren dürfen früh in Ideen investieren.' },
      { icon: '🕳️', title: 'Wertschöpfung ist kaputt', text: 'Ideengeber bekommen nichts, Plattformen nehmen alles.' },
    ],

    rolesTitle: 'So profitierst du',
    rolesSub: 'Drei Rollen, ein Ziel: Ideen, die es verdienen, Realität zu werden.',
    rolesSection: [
      {
        icon: '💡', title: 'Ideengeber',
        text: 'Poste deine Idee kostenlos in der Diskussion. Sammle Feedback, verfeinere das Konzept – und erhalte 15 % jeder Investition sofort plus 20 % Umsatzbeteiligung über Idea-Shares.',
        points: ['Idee kostenlos posten', '15 % jeder Investition sofort', '20 % Revenue-Share via Idea-Shares'],
        cta: 'Idee einreichen',
      },
      {
        icon: '💰', title: 'Investor',
        text: 'Entdecke von der Community validierte Ideen. Kaufe Idea-Shares und verdiene an allen Teams – oder investiere gezielt in ein einzelnes Team. Erste Reihe bei jeder Series A.',
        points: ['Community-validierte Ideen', 'Idea- & Team-Shares', 'Meilenstein-gesichertes Funding'],
        cta: 'Ideen entdecken',
      },
      {
        icon: '🛠️', title: 'Macher',
        text: 'Gründe ein Team, stelle einen Fahrplan mit Meilensteinen auf und erhalte Funding. Du baust – und behältst 80 % des Umsatzes. Umgekehrt zum klassischen Modell.',
        points: ['Funding über Meilensteine', '80 % Umsatzbeteiligung', 'Skin-in-the-game = Vertrauen'],
        cta: 'Team gründen',
      },
    ],

    processTitle: 'Von der Idee zum Profit',
    processSub: 'Sechs Stufen. Kein Gatekeeping. Jede Stufe ist transparent und nachvollziehbar.',
    steps: [
      { title: 'Diskussion', text: 'Idee posten, Feedback sammeln, Konzept verfeinern. Kostenlos und offen für alle.' },
      { title: 'Voting', text: 'Die Community entscheidet: Ist die Idee es wert, gebaut zu werden? 1 Person = 1 Stimme.' },
      { title: 'Idea-Shares', text: 'Investoren kaufen Anteile an der Idee. Der Ideengeber erhält 15 % sofort, 5 % gehen an frühe Mitdenker.' },
      { title: 'Teams', text: 'Macher bewerben sich mit Fahrplan, Budget und Skin-in-the-game. Investoren wählen ihre Teams. Mehrere Teams pro Idee? Ausdrücklich erwünscht.' },
      { title: 'Building', text: 'Meilenstein-basierte Entwicklung. Gelder werden in Tranchen freigegeben, Investoren stimmen über Fortschritt ab.' },
      { title: 'Revenue', text: 'Umsatz fließt: 20 % an Idea-Share-Halter, 80 % an Team-Share-Halter. Transparent, öffentlich, überprüfbar.' },
    ],

    moneyTitle: 'Wohin das Geld fließt',
    moneyInvestTitle: '💸 Bei jeder Investition',
    moneyInvestSub: '100 % der Investition verteilen sich sofort:',
    moneyInvestExamplePre: 'Beispiel ₿ 0,10 Investment:',
    moneyInvestExampleParts: [
      { amount: '₿ 0,015', text: 'an den Ideengeber,' },
      { amount: '₿ 0,005', text: 'an frühe Mitdenker,' },
      { amount: '₿ 0,08', text: 'ins Team-Budget.' },
    ],
    moneyRevenueTitle: '📈 Wenn das Team verdient',
    moneyRevenueSub: '100 % des Team-Umsatzes (und Exits):',
    moneyRevenueIdea: '20 % Idea-Share-Halter',
    moneyRevenueTeam: '80 % Team-Share-Halter',
    moneyRevenueNote: 'Umgekehrt zum klassischen Modell: Die Macher bekommen die Mehrheit – weil sie die Arbeit machen.',
    splitDescs: { creator: 'Sofortige Vergütung', thinkers: 'Chain-of-Thought', team: 'Umsetzungs-Budget' },

    principlesTitle: 'Unverhandelbare Prinzipien',
    principles: [
      { icon: '₿', title: 'Bitcoin-only', text: 'Keine Tokens, keine Altcoins. Nur dezentrales, zensurresistentes Geld.' },
      { icon: '🤝', title: 'Soziale Verträge', text: 'Reputation + Transparenz statt Anwälten. Global nutzbar, ohne Jurisdiktions-Hürden.' },
      { icon: '🗳️', title: '1 Person = 1 Stimme', text: 'Subscription ($120/Jahr) verhindert Sybil-Angriffe – ganz ohne Identitätsprüfung.' },
      { icon: '⚔️', title: 'Parallele Teams', text: 'Mehrere Teams pro Idee. Wettbewerb erhöht die Erfolgswahrscheinlichkeit.' },
      { icon: '⚖️', title: 'Macher bekommen die Mehrheit', text: '80 % an die Teams, 20 % an die Ideengeber. Wer die Arbeit macht, bekommt den Lohn.' },
      { icon: '🔍', title: 'Radikale Transparenz', text: 'Alle Umsatzberichte öffentlich, alle Transaktionen verifizierbar. Vertrauen durch Sichtbarkeit.' },
    ],

    subscription: {
      badge: '🗳️ Sybil-Schutz ohne Gängelung',
      title: 'Dein Abo ist dein Stimmrecht.',
      body: 'Voting, Investieren und Team-Gründung kosten $120 pro Jahr – zahlbar in Bitcoin, pseudonym, jederzeit kündbar. Das ist der ganze Trick: Wer 100 Fake-Identitäten will, zahlt $12.000 jährlich und kauft Stimmen zum Marktpreis. Ökonomisch sinnlos.',
      bodyHighlight: 'Wir wollen nichts über dich wissen. Die Zahlung ist der Nachweis – mehr nicht.',
      tableTitle: 'Warum Subscription statt Ausweis?',
      tableHead: ['Mechanismus', 'Was er von dir verlangt'],
      tableRows: [
        ['KYC / Ausweis', '❌ Identität, Dokumente, Datenkrake'],
        ['Telefonnummer / Captcha', '❌ Datenabgabe, Botfarmen kosten Cents'],
        ['Einladungen / Web-of-Trust', '❌ Die Gruppe entscheidet, wer dazugehört'],
        ['Biometrie (Iris-Scan & Co.)', '❌ Orwell-Hardware, zentrale Register'],
        ['Subscription (unser Weg)', '✅ Nur Geld. Kein Name, keine Prüfung, kein Gatekeeper'],
      ],
      promise: 'Keine Identitätsprüfung. Keine Biometrie. Dein Abo ist dein Stimmrecht – bezahlt in Bitcoin, pseudonym, kündbar jederzeit.',
    },

    federation: {
      badge: '🌐 Keine zentrale Plattform',
      title: 'Tausend Schmieden statt einer Plattform.',
      body: 'Wir bauen keine Plattform, die alles besitzt – wir bauen das Protokoll für tausend unabhängige Schmieden. Jede Community betreibt ihre eigene Instanz: mit eigener Sprache, eigenen Regeln, eigener Subscription.',
      points: [
        { icon: '🗣️', title: 'Jede Kultur ihre Sprache', text: 'Die deutsche Schmiede spricht Deutsch, die französische Französisch. Sprache ist keine Übersetzungsschicht, sondern gelebte Kultur.' },
        { icon: '🔑', title: 'Deine Identität gehört dir', text: 'Identität als Schlüsselpaar statt Account. Kein Lock-in: Du kannst jede Instanz verlassen und nimmst alles mit.' },
        { icon: '🏅', title: 'Reputation ist portierbar', text: 'Signierte Attestierungen („Meilenstein erfüllt, bestätigt von 47 Investoren") gelten instanzübergreifend. Dein Track Record gehört dir, nicht uns.' },
        { icon: '⚡', title: 'Geld war nie zentral', text: 'Investitionen sind direkte Bitcoin-Zahlungen zwischen Wallets. Non-custodial von Tag eins – wir halten niemals deine Keys.' },
      ],
      vision: 'Wir bauen nicht die nächste Plattform. Wir bauen das Protokoll für tausend Schmieden.',
      startNote: 'Der Start: Ideenschmiede Deutschland – deutschsprachig, erste Instanz des Netzwerks.',
    },

    ctaTitle: 'Überzeugt? Dann leg los.',
    ctaSubA: 'Stöbere in der Diskussion – kostenlos und ohne Anmeldung.',
    ctaSubB: 'Wenn du mitgestalten willst, ist der Einstieg einen Klick entfernt.',
    ctaPrimary: 'Zur Ideen-Diskussion',
    ctaSecondary: '⭐ Subscriber werden',
  },
};

export type Dictionary = typeof de;
