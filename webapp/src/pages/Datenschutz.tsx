import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useT } from '@/lib/i18n';
import { Page, PageHeader } from '@/components/bits';

/**
 * Datenschutzerklärung (Roadmap Phase 2.4).
 *
 * Wichtig: Diese Seite beschreibt ausschließlich den belegbaren Ist-Stand der
 * Anwendung – reine Frontend-SPA, localStorage im Browser, kein Backend.
 * Aussagen zu Auftragsverarbeitung, Analyse oder Drittanbietern, die es nicht
 * gibt, dürfen hier nicht ergänzt werden. Textpflege erfolgt in de.ts.
 */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="is-card reveal" style={{ padding: '26px 28px', marginBottom: 20 }}>
      <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.01em', marginBottom: 14 }}>{title}</h2>
      {children}
    </section>
  );
}

function Body({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>{children}</p>;
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0 8px' }}>{children}</h3>;
}

/** Zweispaltige Liste aus [label, text]-Paaren (Speicherschlüssel, Rechte, Nicht-Erhebungen). */
function EntryList({ items, labelWidth = 210 }: { items: [string, string][]; labelWidth?: number }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {items.map(([label, text]) => (
        <div key={label} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '13px 16px' }}>
          <div className="font-mono" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', flex: `0 0 ${labelWidth}px`, minWidth: labelWidth }}>{label}</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65, flex: 1, minWidth: 240 }}>{text}</div>
        </div>
      ))}
    </div>
  );
}

export default function Datenschutz() {
  const t = useT();
  const T = t.pages.datenschutz;

  return (
    <Page narrow>
      <PageHeader title={T.title} subtitle={T.subtitle} />

      <Section title={T.responsibleTitle}>
        <Body>{T.responsibleIntro}</Body>
        <div style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border-strong)', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{T.responsibleName}</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 4 }}>
            {T.responsibleStreet}<br />{T.responsibleCity}<br />{T.responsibleCountry}
          </div>
          <div style={{ marginTop: 8, fontSize: 13.5 }}>
            <a href={`mailto:${T.responsibleEmail}`} style={{ color: 'var(--accent-primary)' }}>{T.responsibleEmail}</a>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.7, marginTop: 10 }}>{T.responsibleNote}</p>
        </div>
        <div style={{ marginTop: 14 }}>
          <Body>{T.responsiblePrivacy}</Body>
          <Body>{T.responsibleTech}</Body>
        </div>
      </Section>

      <Section title={T.dataTitle}>
        <Body>{T.dataIntro}</Body>
        <SubHeading>{T.dataLocalTitle}</SubHeading>
        <Body>{T.dataLocalText}</Body>
        <div style={{ marginBottom: 16 }}>
          <EntryList items={T.storageKeys} />
        </div>
        <SubHeading>{T.dataWhoTitle}</SubHeading>
        <Body>{T.dataWhoText}</Body>
        <SubHeading>{T.dataDemoTitle}</SubHeading>
        <Body>{T.dataDemoText}</Body>
        <SubHeading>{T.dataDeleteTitle}</SubHeading>
        <Body>{T.dataDeleteText}</Body>
      </Section>

      <Section title={T.notCollectedTitle}>
        <Body>{T.notCollectedIntro}</Body>
        <EntryList items={T.notCollected} />
      </Section>

      <Section title={T.hostingTitle}>
        <Body>{T.hostingText}</Body>
        <Body>{T.hostingLogsText}</Body>
        <Body>{T.hostingBase}</Body>
        <Body>{T.hostingNoOther}</Body>
      </Section>

      <Section title={T.rightsTitle}>
        <Body>{T.rightsIntro}</Body>
        <div style={{ marginBottom: 16 }}>
          <EntryList items={T.rights} labelWidth={170} />
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.75, marginBottom: 12 }}>{T.rightsNote}</p>
        <SubHeading>{T.rightsComplaintTitle}</SubHeading>
        <Body>{T.rightsComplaintText}</Body>
      </Section>

      <Section title={T.statusTitle}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', alignItems: 'baseline', marginBottom: 12 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{T.statusStandLabel}</span>
          <span className="badge badge-orange" style={{ fontSize: 11.5 }}>{T.statusStandValue}</span>
        </div>
        <Body>{T.statusChangeText}</Body>
        <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.7, marginBottom: 18 }}>{T.statusNote}</p>
        <Link to="/" className="btn-secondary" style={{ display: 'inline-block', textDecoration: 'none' }}>{T.backToHome}</Link>
      </Section>
    </Page>
  );
}
