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
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { login, logout, type AuthUser } from './src/api/auth';
import { loadRememberedUsername, loadSession, saveSession } from './src/api/session';
import { PunchReminderModal } from './src/components/PunchReminderModal';
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

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(() => loadSession());
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
    if (user?.token) saveSession(user);
  }, [user]);

  useEffect(() => {
    if (!fontsLoaded) return;

    SplashScreen.hideAsync().catch(() => undefined);
    const timer = setTimeout(() => setShowSplash(false), 1800);
    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="dark" />
        {!fontsLoaded || showSplash ? (
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
          <HomeScreen
            user={user}
            onLogout={() => {
              logout();
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
        ) : (
          <LoginScreen
            initialUsername={loadRememberedUsername()}
            onLogin={async (username, password) => setUser(await login(username, password))}
          />
        )}
        {user && fontsLoaded && !showSplash ? (
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
