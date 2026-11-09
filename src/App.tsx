import { useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SnackbarProvider } from './components/ui'
import { authService, useCurrentUser } from './services/auth'
import { LoginScreen, OnboardingScreen, RegisterScreen, SplashScreen } from './screens/AuthScreens'
import { MainNavigation } from './screens/MainNavigation'
import { HomeScreen } from './screens/HomeScreen'
import { ChallengeDetailScreen, ChallengeListScreen, CreateChallengeScreen } from './screens/ChallengeScreens'
import { LiveMatchScreen, MatchLobbyScreen } from './screens/MatchScreens'
import { CreateDisputeScreen, DisputeEvidenceScreen, DisputesScreen } from './screens/DisputeScreens'
import {
  AnnouncementsScreen, HistoryScreen, NotificationsScreen, ProfileScreen, SettingsScreen, WalletScreen,
} from './screens/AccountScreens'
import {
  CreateTournamentScreen, FriendsScreen, InfluencerDashboardScreen, LeaderboardScreen, ReferralScreen,
  TournamentDetailScreen, TournamentsScreen,
} from './screens/SocialScreens'
import { LiveStreamScreen, StreamListScreen, WatchStreamScreen } from './screens/StreamScreens'

function Protected({ children }: { children: ReactNode }) {
  const user = useCurrentUser()
  return user ? <>{children}</> : <Navigate to="/onboarding" replace />
}

function PublicOnly({ children }: { children: ReactNode }) {
  const user = useCurrentUser()
  return user ? <Navigate to="/" replace /> : <>{children}</>
}

const P = (el: ReactNode) => <Protected>{el}</Protected>

export default function App() {
  const [splashDone, setSplashDone] = useState(false)
  const [restored, setRestored] = useState(false)
  // Pendant l'écran de démarrage : reprise de la session et chargement des données
  useEffect(() => { authService.restore().finally(() => setRestored(true)) }, [])
  if (!splashDone || !restored) return <div className="app-frame"><SplashScreen onDone={() => setSplashDone(true)} /></div>

  return (
    <BrowserRouter>
      <SnackbarProvider>
        <div className="app-frame">
          <Routes>
            <Route path="/onboarding" element={<PublicOnly><OnboardingScreen /></PublicOnly>} />
            <Route path="/login" element={<PublicOnly><LoginScreen /></PublicOnly>} />
            <Route path="/register" element={<PublicOnly><RegisterScreen /></PublicOnly>} />

            <Route element={P(<MainNavigation />)}>
              <Route index element={<HomeScreen />} />
              <Route path="/defis" element={<ChallengeListScreen />} />
              <Route path="/historique" element={<HistoryScreen />} />
              <Route path="/streaming" element={<StreamListScreen />} />
              <Route path="/profil" element={<ProfileScreen />} />
            </Route>

            <Route path="/challenges/create" element={P(<CreateChallengeScreen />)} />
            <Route path="/challenges/:id" element={P(<ChallengeDetailScreen />)} />
            <Route path="/match/:id/lobby" element={P(<MatchLobbyScreen />)} />
            <Route path="/match/:id/live" element={P(<LiveMatchScreen />)} />
            <Route path="/disputes" element={P(<DisputesScreen />)} />
            <Route path="/disputes/new/:id" element={P(<CreateDisputeScreen />)} />
            <Route path="/disputes/:id/evidence" element={P(<DisputeEvidenceScreen />)} />
            <Route path="/notifications" element={P(<NotificationsScreen />)} />
            <Route path="/announcements" element={P(<AnnouncementsScreen />)} />
            <Route path="/wallet" element={P(<WalletScreen />)} />
            <Route path="/settings" element={P(<SettingsScreen />)} />
            <Route path="/tournaments" element={P(<TournamentsScreen />)} />
            <Route path="/tournaments/create" element={P(<CreateTournamentScreen />)} />
            <Route path="/tournaments/:id" element={P(<TournamentDetailScreen />)} />
            <Route path="/leaderboard" element={P(<LeaderboardScreen />)} />
            <Route path="/referral" element={P(<ReferralScreen />)} />
            <Route path="/influencer" element={P(<InfluencerDashboardScreen />)} />
            <Route path="/friends" element={P(<FriendsScreen />)} />
            <Route path="/stream/:id/live" element={P(<LiveStreamScreen />)} />
            <Route path="/stream/:id/watch" element={P(<WatchStreamScreen />)} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </SnackbarProvider>
    </BrowserRouter>
  )
}
