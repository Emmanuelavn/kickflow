import { useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { SnackbarProvider } from './components/ui'
import { authService, useCurrentUser } from './services/auth'
import { ForgotPasswordScreen, LoginScreen, OnboardingScreen, RegisterScreen, ResetPasswordScreen, SplashScreen } from './screens/AuthScreens'
import { MainNavigation } from './screens/MainNavigation'
import { CreateChallengeV2, DefisV2, HomeV2 } from './screens/v2/PlayScreens'
import { MatchScreenV2 } from './screens/v2/MatchScreen'
import { ClassementV2, LivesV2, NotificationsV2, ProfilV2, ReferralV2, TournoisV2, WalletV2 } from './screens/v2/HubScreens'
import { ChallengeDetailScreen } from './screens/ChallengeScreens'
import { CreateDisputeScreen, DisputeEvidenceScreen, DisputesScreen } from './screens/DisputeScreens'
import { SettingsScreen } from './screens/AccountScreens'
import { CreateTournamentScreen, FriendsScreen, TournamentDetailScreen } from './screens/SocialScreens'

function Protected({ children }: { children: ReactNode }) {
  const user = useCurrentUser()
  return user ? <>{children}</> : <Navigate to="/onboarding" replace />
}

function PublicOnly({ children }: { children: ReactNode }) {
  const user = useCurrentUser()
  return user ? <Navigate to="/" replace /> : <>{children}</>
}

/** Anciennes adresses du lobby / match en direct → nouvel écran de match. */
function MatchRedirect() {
  const { id } = useParams()
  return <Navigate to={`/match/${id}`} replace />
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
            <Route path="/forgot" element={<PublicOnly><ForgotPasswordScreen /></PublicOnly>} />
            <Route path="/reset" element={<ResetPasswordScreen />} />

            {/* Onglets */}
            <Route element={P(<MainNavigation />)}>
              <Route index element={<HomeV2 />} />
              <Route path="/defis" element={<DefisV2 />} />
              <Route path="/tournaments" element={<TournoisV2 />} />
              <Route path="/classement" element={<ClassementV2 />} />
              <Route path="/profil" element={<ProfilV2 />} />
            </Route>

            {/* Pages */}
            <Route path="/challenges/create" element={P(<CreateChallengeV2 />)} />
            <Route path="/challenges/:id" element={P(<ChallengeDetailScreen />)} />
            <Route path="/match/:id" element={P(<MatchScreenV2 />)} />
            <Route path="/match/:id/lobby" element={<MatchRedirect />} />
            <Route path="/match/:id/live" element={<MatchRedirect />} />
            <Route path="/notifications" element={P(<NotificationsV2 />)} />
            <Route path="/wallet" element={P(<WalletV2 />)} />
            <Route path="/referral" element={P(<ReferralV2 />)} />
            <Route path="/lives" element={P(<LivesV2 />)} />
            <Route path="/friends" element={P(<FriendsScreen />)} />
            <Route path="/settings" element={P(<SettingsScreen />)} />
            <Route path="/disputes" element={P(<DisputesScreen />)} />
            <Route path="/disputes/new/:id" element={P(<CreateDisputeScreen />)} />
            <Route path="/disputes/:id/evidence" element={P(<DisputeEvidenceScreen />)} />
            <Route path="/tournaments/create" element={P(<CreateTournamentScreen />)} />
            <Route path="/tournaments/:id" element={P(<TournamentDetailScreen />)} />

            {/* Anciennes adresses */}
            <Route path="/historique" element={<Navigate to="/defis?tab=histo" replace />} />
            <Route path="/leaderboard" element={<Navigate to="/classement" replace />} />
            <Route path="/announcements" element={<Navigate to="/notifications?tab=annonces" replace />} />
            <Route path="/influencer" element={<Navigate to="/referral" replace />} />
            <Route path="/streaming" element={<Navigate to="/lives" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </SnackbarProvider>
    </BrowserRouter>
  )
}
