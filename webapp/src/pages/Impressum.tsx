import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useT } from '@/lib/i18n';
import { Page, PageHeader } from '@/components/bits';

/**
 * Impressum (Roadmap Phase 2.4).
 *
 * Pflichtangaben nach § 5 DDG (vormals § 5 TMG). Auf dieser Seite stehen
 * ausschließlich die vom Betreiber gelieferten Angaben: Name, Anschrift und
 * E-Mail-Adresse. Telefonnummer, Umsatzsteuer-Identifikationsnummer,
 * Berufsbezeichnung, Kammer und Aufsichtsbehörde liegen nicht vor und dürfen
 * hier nicht ergänzt werden. Textpflege erfolgt in de.ts.
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

/** Anschriftblock aus einer einzelnen Angabe je Zeile (Name, Straße, PLZ/Ort, Land). */
function AddressBlock({ lines }: { lines: string[] }) {
  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border-strong)', borderRadius: 12, padding: '16px 18px' }}>
      {lines.map(line => (
        <div key={line} style={{ fontSize: 14.5, color: 'var(--text-primary)', lineHeight: 1.7 }}>{line}</div>
      ))}
    </div>
  );
}

export default function Impressum() {
  const t = useT();
  const T = t.pages.impressum;

  return (
    <Page narrow>
      <PageHeader title={T.title} subtitle={T.subtitle} />

      <Section title={T.providerTitle}>
        <Body>{T.providerIntro}</Body>
        <AddressBlock lines={[T.providerName, T.providerStreet, T.providerCity, T.providerCountry]} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '13px 16px', margin: '14px 0' }}>
          <div className="font-mono" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', flex: '0 0 210px', minWidth: 210 }}>{T.providerEmailLabel}</div>
          <a href={`mailto:${T.providerEmail}`} style={{ fontSize: 13.5, color: 'var(--accent-primary)', lineHeight: 1.65, flex: 1, minWidth: 240 }}>{T.providerEmail}</a>
        </div>
        <Body>{T.providerContactNote}</Body>
      </Section>

      <Section title={T.contentTitle}>
        <Body>{T.contentText}</Body>
      </Section>

      <Section title={T.projectTitle}>
        <Body>{T.projectText}</Body>
      </Section>

      <Section title={T.liabilityTitle}>
        <Body>{T.liabilityIntro}</Body>
        <Body>{T.liabilityCheck}</Body>
        <Body>{T.liabilityRemove}</Body>
      </Section>

      <Section title={T.copyrightTitle}>
        <Body>{T.copyrightCode}</Body>
        <Body>{T.copyrightContent}</Body>
      </Section>

      <Section title={T.statusTitle}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', alignItems: 'baseline', marginBottom: 12 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{T.statusStandLabel}</span>
          <span className="badge badge-orange" style={{ fontSize: 11.5 }}>{T.statusStandValue}</span>
        </div>
        <Body>{T.statusChangeText}</Body>
        <Link to="/" className="btn-secondary" style={{ display: 'inline-block', textDecoration: 'none', marginTop: 6 }}>{T.backToHome}</Link>
      </Section>
    </Page>
  );
}
