import { Routes, Route } from 'react-router';
import { StoreProvider } from '@/lib/store';
import { LanguageProvider } from '@/lib/i18n';
import Layout from '@/components/Layout';
import Landing from '@/pages/Landing';
import Discussion from '@/pages/Discussion';
import IdeaDetail from '@/pages/IdeaDetail';
import CreateIdea from '@/pages/CreateIdea';
import Marketplace from '@/pages/Marketplace';
import Teams from '@/pages/Teams';
import TeamDetail from '@/pages/TeamDetail';
import TeamApply, { TeamCreate } from '@/pages/TeamApply';
import NotFound from '@/pages/NotFound';
import Dashboard from '@/pages/Dashboard';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import Investments from '@/pages/Investments';
import Earnings from '@/pages/Earnings';

export default function App() {
  return (
    <LanguageProvider lang="de">
      <StoreProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/discussion" element={<Discussion />} />
            <Route path="/idea/:id" element={<IdeaDetail />} />
            <Route path="/create-idea" element={<CreateIdea />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/team/:id" element={<TeamDetail />} />
            <Route path="/team-apply" element={<TeamApply />} />
            <Route path="/team-create" element={<TeamCreate />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/investments" element={<Investments />} />
            <Route path="/earnings" element={<Earnings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </StoreProvider>
    </LanguageProvider>
  );
}
