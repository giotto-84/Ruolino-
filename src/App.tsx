import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/db';
import { Icon } from './components/ui';
import { Onboarding } from './screens/Onboarding';
import { Home } from './screens/Home';
import { ProgramScreen } from './screens/ProgramScreen';
import { Workout } from './screens/Workout';
import { Library } from './screens/Library';
import { ExerciseDetail } from './screens/ExerciseDetail';
import { Progress } from './screens/Progress';
import { CheckinScreen } from './screens/Checkin';
import { Settings } from './screens/Settings';

const TABS = [
  { to: '/', label: 'Oggi', icon: 'home' },
  { to: '/scheda', label: 'Scheda', icon: 'plan' },
  { to: '/esercizi', label: 'Esercizi', icon: 'book' },
  { to: '/progressi', label: 'Progressi', icon: 'chart' },
  { to: '/profilo', label: 'Profilo', icon: 'user' },
];

function Shell() {
  const profile = useLiveQuery(() => db.profile.get('me'), [], null);
  const loc = useLocation();

  if (profile === null) return null; // loading
  const ready = profile && (profile.medicalClearance || !Object.values(profile.parq).some(Boolean));
  if (!ready && !loc.pathname.startsWith('/benvenuto')) return <Navigate to="/benvenuto" replace />;

  const hideTabs = loc.pathname.startsWith('/allenamento') || loc.pathname.startsWith('/benvenuto');

  return (
    <>
      <main className={`app${hideTabs ? ' no-tabs' : ''}`}>
        <Routes>
          <Route path="/benvenuto" element={<Onboarding />} />
          <Route path="/" element={<Home />} />
          <Route path="/scheda" element={<ProgramScreen />} />
          <Route path="/allenamento/:day" element={<Workout />} />
          <Route path="/esercizi" element={<Library />} />
          <Route path="/esercizi/:id" element={<ExerciseDetail />} />
          <Route path="/progressi" element={<Progress />} />
          <Route path="/checkin" element={<CheckinScreen />} />
          <Route path="/profilo" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!hideTabs && (
        <div className="tabs">
          <nav aria-label="Sezioni">
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
                <Icon name={t.icon} size={24} />
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}

export function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
