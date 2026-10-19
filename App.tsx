import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { login, logout, type AuthUser } from './src/api/auth';
import { loadRememberedUsername, loadSession, saveSession } from './src/api/session';
import { PunchReminderModal } from './src/components/PunchReminderModal';
import { ScreenErrorBoundary } from './src/components/ScreenErrorBoundary';
import { usePunchReminder } from './src/hooks/usePunchReminder';
import { BarcodeInformationScreen } from './src/screens/BarcodeInformationScreen';
import { EditProfileScreen } from './src/screens/EditProfileScreen';
import { HelpDeskScreen } from './src/screens/HelpDeskScreen';
import { AttendanceScreen } from './src/screens/AttendanceScreen';
import { ConveyanceChargesScreen } from './src/screens/ConveyanceChargesScreen';
import { HRHelpdeskScreen } from './src/screens/HRHelpdeskScreen';
import { LeaveManagementScreen } from './src/screens/LeaveManagementScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { MyProfileScreen } from './src/screens/MyProfileScreen';
import { SiteVisitsScreen } from './src/screens/SiteVisitsScreen';
import { SplashScreen as BrandSplash } from './src/screens/SplashScreen';
import { TicketDashboardScreen } from './src/screens/TicketDashboardScreen';
import { VendorRegistrationScreen } from './src/screens/VendorRegistrationScreen';
import { WorkFromHomeScreen } from './src/screens/WorkFromHomeScreen';
import { AttendanceRegularizationScreen } from './src/screens/AttendanceRegularizationScreen';
import { AttendanceHistoryScreen } from './src/screens/AttendanceHistoryScreen';
import { EmployeeKpiScreen } from './src/screens/EmployeeKpiScreen';
import { WorkZoneScreen } from './src/screens/WorkZoneScreen';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const LOGIN_PATH = '/loginScreen';

function webPathname() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.location) return null;
  return window.location.pathname;
}

function replaceWebPath(pathname: string) {
  const current = webPathname();
  if (current == null || current === pathname) return;
  window.history.replaceState(window.history.state, '', `${pathname}${window.location.search}${window.location.hash}`);
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  const [fontWaitExpired, setFontWaitExpired] = useState(false);
  const fontsReady = fontsLoaded || fontError != null || fontWaitExpired;
  const [showSplash, setShowSplash] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [initialUsername, setInitialUsername] = useState('');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [showTickets, setShowTickets] = useState(false);
  const [showSiteVisits, setShowSiteVisits] = useState(false);
  const [showMappedAssets, setShowMappedAssets] = useState(false);
  const [showWorkZone, setShowWorkZone] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);
  const [showConveyance, setShowConveyance] = useState(false);
  const [showHrHelpdesk, setShowHrHelpdesk] = useState(false);
  const [showWfh, setShowWfh] = useState(false);
  const [showRegularization, setShowRegularization] = useState(false);
  const [showEmployeeKpi, setShowEmployeeKpi] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSpeakUp, setShowSpeakUp] = useState(false);
  const [showVendors, setShowVendors] = useState(false);
  const punchReminder = usePunchReminder(user);

  const openAttendanceFromReminder = () => {
    punchReminder.dismiss();
    setShowEditProfile(false);
    setShowMyProfile(false);
    setShowTickets(false);
    setShowSiteVisits(false);
    setShowMappedAssets(false);
    setShowLeave(false);
    setShowAttendance(true);
  };

  useEffect(() => {
    const timer = setTimeout(() => setFontWaitExpired(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([loadSession(), loadRememberedUsername()])
      .then(([saved, name]) => {
        if (!active) return;
        if (saved) setUser(saved);
        setInitialUsername(name);
      })
      .finally(() => {
        if (active) setSessionReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (user?.token) void saveSession(user);
  }, [user]);

  useEffect(() => {
    if (!fontsReady || !sessionReady) return;

    SplashScreen.hideAsync().catch(() => undefined);
    const timer = setTimeout(() => setShowSplash(false), 1800);
    return () => clearTimeout(timer);
  }, [fontsReady, sessionReady]);

  useEffect(() => {
    if (!fontsReady || !sessionReady || showSplash) return;
    if (!user) {
      replaceWebPath(LOGIN_PATH);
      return;
    }
    if (webPathname() === LOGIN_PATH) {
      replaceWebPath('/');
    }
  }, [fontsReady, sessionReady, showSplash, user]);

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="dark" />
        {!fontsReady || !sessionReady || showSplash ? (
          <BrandSplash />
        ) : user && showEditProfile ? (
          <EditProfileScreen
            user={user}
            onBack={() => setShowEditProfile(false)}
            onSave={(updated) => {
              setUser(updated);
              setShowEditProfile(false);
            }}
          />
        ) : user && showMyProfile ? (
          <MyProfileScreen
            user={user}
            onBack={() => setShowMyProfile(false)}
            onEditProfile={() => setShowEditProfile(true)}
            onHome={() => {
              setShowMyProfile(false);
              setShowWorkZone(false);
            }}
            onOpenTickets={() => {
              setShowMyProfile(false);
              setShowWorkZone(false);
              setShowTickets(true);
            }}
            onUpdateUser={setUser}
          />
        ) : user && showTickets ? (
          <TicketDashboardScreen user={user} onBack={() => setShowTickets(false)} />
        ) : user && showSiteVisits ? (
          <SiteVisitsScreen user={user} onBack={() => setShowSiteVisits(false)} />
        ) : user && showMappedAssets ? (
          <BarcodeInformationScreen onBack={() => setShowMappedAssets(false)} />
        ) : user && showLeave ? (
          <LeaveManagementScreen user={user} onBack={() => setShowLeave(false)} />
        ) : user && showAttendance ? (
          <AttendanceScreen user={user} onBack={() => setShowAttendance(false)} />
        ) : user && showConveyance ? (
          <ConveyanceChargesScreen user={user} onBack={() => setShowConveyance(false)} />
        ) : user && showHrHelpdesk ? (
          <HRHelpdeskScreen
            user={user}
            onBack={() => setShowHrHelpdesk(false)}
            onHome={() => {
              setShowHrHelpdesk(false);
              setShowWorkZone(false);
            }}
          />
        ) : user && showWfh ? (
          <WorkFromHomeScreen user={user} onBack={() => setShowWfh(false)} />
        ) : user && showRegularization ? (
          <AttendanceRegularizationScreen user={user} onBack={() => setShowRegularization(false)} />
        ) : user && showEmployeeKpi ? (
          <EmployeeKpiScreen user={user} onBack={() => setShowEmployeeKpi(false)} />
        ) : user && showHistory ? (
          <AttendanceHistoryScreen user={user} onBack={() => setShowHistory(false)} />
        ) : user && showWorkZone ? (
          <WorkZoneScreen
            user={user}
            onBack={() => setShowWorkZone(false)}
            onOpenProfile={() => setShowMyProfile(true)}
            onOpenLeave={() => setShowLeave(true)}
            onOpenAttendance={() => setShowAttendance(true)}
            onOpenConvenience={() => setShowConveyance(true)}
            onOpenHrHelpdesk={() => setShowHrHelpdesk(true)}
            onOpenWfh={() => setShowWfh(true)}
            onOpenRegularization={() => setShowRegularization(true)}
            onOpenEmployeeKpi={() => setShowEmployeeKpi(true)}
            onOpenHistory={() => setShowHistory(true)}
          />
        ) : user && showSpeakUp ? (
          <HelpDeskScreen user={user} onBack={() => setShowSpeakUp(false)} />
        ) : user && showVendors ? (
          <VendorRegistrationScreen user={user} onBack={() => setShowVendors(false)} />
        ) : user ? (
          <ScreenErrorBoundary title="Home couldn't open">
          <HomeScreen
            user={user}
            onLogout={() => {
              void logout();
              setShowEditProfile(false);
              setShowMyProfile(false);
              setShowTickets(false);
              setShowSiteVisits(false);
              setShowMappedAssets(false);
              setShowWorkZone(false);
              setShowLeave(false);
              setShowAttendance(false);
              setShowConveyance(false);
              setShowHrHelpdesk(false);
              setShowWfh(false);
              setShowRegularization(false);
              setShowEmployeeKpi(false);
              setShowHistory(false);
              setShowSpeakUp(false);
              setShowVendors(false);
              setUser(null);
            }}
            onOpenProfile={() => setShowMyProfile(true)}
            onOpenTickets={() => setShowTickets(true)}
            onOpenSiteVisits={() => setShowSiteVisits(true)}
            onOpenMappedAssets={() => setShowMappedAssets(true)}
            onOpenWorkZone={() => setShowWorkZone(true)}
            onOpenSpeakUp={() => setShowSpeakUp(true)}
            onOpenVendors={() => setShowVendors(true)}
          />
          </ScreenErrorBoundary>
        ) : (
          <LoginScreen
            initialUsername={initialUsername}
            onLogin={async (username, password) => setUser(await login(username, password))}
          />
        )}
        {user && fontsReady && sessionReady && !showSplash ? (
          <PunchReminderModal time={punchReminder.ringingTime} onPunchIn={openAttendanceFromReminder} onDismiss={punchReminder.dismiss} />
        ) : null}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
