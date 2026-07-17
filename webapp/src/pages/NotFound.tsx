import { Link } from 'react-router';
import { useT } from '@/lib/i18n';
import { Page, EmptyState } from '@/components/bits';

export default function NotFound() {
  const t = useT();
  return (
    <Page narrow>
      <div style={{ paddingTop: 60 }}>
        <EmptyState
          icon="🔥"
          title={t.pages.notFound.title}
          text={t.pages.notFound.text}
          action={<Link to="/" className="btn-primary">{t.pages.notFound.cta}</Link>}
        />
      </div>
    </Page>
  );
}
