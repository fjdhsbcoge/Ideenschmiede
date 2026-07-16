import { Link } from 'react-router';
import { Page, EmptyState } from '@/components/bits';

export default function NotFound() {
  return (
    <Page narrow>
      <div style={{ paddingTop: 60 }}>
        <EmptyState
          icon="🔥"
          title="404 – Diese Idee ist (noch) nicht geschmiedet"
          text="Die angefragte Seite existiert nicht. Vielleicht wurde sie verschoben oder der Link ist veraltet."
          action={<Link to="/" className="btn-primary">Zur Startseite</Link>}
        />
      </div>
    </Page>
  );
}
