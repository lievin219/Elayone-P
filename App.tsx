import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { AttendanceReport, AttendanceResponseStatus, AttendanceSummary, createMemberAccount, createRehearsal, createSong, deleteAnnouncement, DirectoryUser, EventType, getAllUsers, getAttendanceReport, getAttendanceSummary, getRehearsals, getReminders, getSongs, getStoredSession, publishAnnouncement, removeChoirMember, ReminderRecord, RehearsalRecord, Session, signIn, signOut, updateAttendance, updateUserRole } from './src/api';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Tab = 'Home' | 'Calendar' | 'Rehearsals' | 'People' | 'Songs' | 'Reports' | 'Admin';

type Rehearsal = RehearsalRecord & { color: string };

function formatRehearsalDate(input: string) {
  const date = new Date(input);
  const day = date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
  const dateNumber = date.toLocaleDateString(undefined, { day: '2-digit' });
  const month = date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
  const start = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return { day, dateNumber, month, start };
}

const rehearsalColors = ['#1c1c1c', '#c9b99a', '#82746a', '#8c9d85', '#c7916d'];

const people = [
  { id: 'director-id', name: 'Serge', role: 'Choir director', initials: 'AM', tone: '#d7c5af', part: 'Soprano', availability: 'YES' },
  { id: 'worship-leader-id', name: 'Prince', role: 'Worship leader', initials: 'DN', tone: '#b9c2b0', part: 'Tenor', availability: 'YES' },
  { id: 'soprano-lead-id', name: 'Alain', role: 'Soprano lead', initials: 'MG', tone: '#d9b7b0', part: 'Soprano', availability: 'MAYBE' },
  { id: 'tenor-lead-id', name: 'Nzera', role: 'Tenor lead', initials: 'EI', tone: '#b3bdc9', part: 'Tenor', availability: 'NO' },
];

const attendanceRoster = [
  { name: 'Aline Mukamana', part: 'Soprano', status: 'Coming', tone: '#d7c5af' },
  { name: 'Daniel Niyonzima', part: 'Tenor', status: 'Coming', tone: '#b9c2b0' },
  { name: 'Munezero Grace', part: 'Soprano', status: 'Maybe', tone: '#d9b7b0' },
  { name: 'Eric Ishimwe', part: 'Tenor', status: 'Away', tone: '#b3bdc9' },
];

type AnnouncementItem = {
  id: string;
  title: string;
  message: string;
  priority: 'NORMAL' | 'IMPORTANT';
  createdAt: string;
  author?: { name: string } | null;
  authorName?: string;
};

type SongItem = {
  id?: string;
  title: string;
  key: string | null;
  status: string;
  notes?: string | null;
  previewUrl?: string | null;
  icon?: IconName;
};

const seedSongs: SongItem[] = [
  { title: 'Iminsi yose', key: 'Key of D', status: 'READY', icon: 'musical-notes-outline', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { title: 'None urabikoze', key: 'Key of G', status: 'LEARN', icon: 'book-outline', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { title: 'Jambo', key: 'Key of F', status: 'READY', icon: 'musical-notes-outline', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { title: 'umvugutire', key: 'Key of F', status: 'READY', icon: 'musical-notes-outline', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('Home');
  const [selectedRehearsal, setSelectedRehearsal] = useState<string>('');
  const [checkedIn, setCheckedIn] = useState(false);
  const [visiblePeople, setVisiblePeople] = useState(people);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary>({ total: 0, confirmed: 0, rate: 0, upcoming: 0 });
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [reminders, setReminders] = useState<ReminderRecord[]>([]);
  const [songs, setSongs] = useState<SongItem[]>(seedSongs);
  const [hasNewAnnouncements, setHasNewAnnouncements] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, interruptionModeIOS: InterruptionModeIOS.DoNotMix, interruptionModeAndroid: InterruptionModeAndroid.DoNotMix, shouldDuckAndroid: true });
    return () => {
      clearInterval(timer);
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => undefined);
      }
    };
  }, []);

  async function playSong(songTitle: string, previewUrl: string) {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync({ uri: previewUrl }, { shouldPlay: true, isLooping: false, volume: 1 });
      soundRef.current = sound;
      setNowPlaying(songTitle);
      setIsPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!('isLoaded' in status) || !status.isLoaded) return;
        if (status.didJustFinish) {
          setIsPlaying(false);
          setNowPlaying(null);
        }
      });
    } catch {
      Alert.alert('Playback unavailable', 'This song preview could not be played right now.');
    }
  }

  async function togglePlayback(songTitle: string, previewUrl: string) {
    if (nowPlaying === songTitle && isPlaying) {
      if (soundRef.current) {
        await soundRef.current.pauseAsync();
      }
      setIsPlaying(false);
      return;
    }

    await playSong(songTitle, previewUrl);
  }

  const showHome = activeTab === 'Home';
  const isAdmin = session?.user.role === 'ADMIN' || session?.user.role === 'LEADER';
  const welcomeName = session?.user.name?.split(' ')[0] ?? 'Choir member';
  const orderedRehearsals = [...rehearsals].sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
  const activeRehearsal = orderedRehearsals.find((item) => {
    const start = new Date(item.startsAt).getTime();
    const end = new Date(item.endsAt).getTime();
    return currentTime.getTime() >= start && currentTime.getTime() <= end;
  }) ?? null;
  const nextRehearsal = activeRehearsal ?? orderedRehearsals.find((item) => new Date(item.startsAt).getTime() > currentTime.getTime()) ?? orderedRehearsals[0] ?? null;
  const nextRehearsalParts = nextRehearsal ? formatRehearsalDate(nextRehearsal.startsAt) : null;
  const upcomingRehearsalCount = orderedRehearsals.filter((item) => new Date(item.startsAt).getTime() >= currentTime.getTime()).length;
  const eventTypeLabel = nextRehearsal?.title?.toLowerCase().includes('worship') ? 'WORSHIP NIGHT' : nextRehearsal?.title?.toLowerCase().includes('service') ? 'SUNDAY SERVICE' : nextRehearsal?.title?.toLowerCase().includes('rehearsal') ? 'REHEARSAL' : nextRehearsal?.title?.toLowerCase().includes('event') ? 'SPECIAL EVENT' : 'ASSIGNMENT';
  const liveEventLabel = activeRehearsal ? 'ACTIVE SERVICE' : 'NEXT ASSIGNMENT';
  const liveEventState = activeRehearsal ? 'LIVE' : nextRehearsal ? 'UPCOMING' : 'NO EVENT';
  const formattedDate = currentTime.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dailyVerse = [
    '“Trust in the Lord with all your heart and lean not on your own understanding.” — Proverbs 3:5',
    '“Let everything that has breath praise the Lord.” — Psalm 150:6',
    '“I can do all things through Christ who strengthens me.” — Philippians 4:13',
    '“The Lord is my strength and my song.” — Exodus 15:2',
  ][currentTime.getDate() % 4];

  React.useEffect(() => {
    getStoredSession().then(setSession).finally(() => setAuthReady(true));
  }, []);

  function handleAuthenticated(nextSession: Session) {
    setSession(nextSession);
    setActiveTab('Home');
    setShowNotifications(false);
  }

  React.useEffect(() => {
    if (!session) {
      setAnnouncements([]);
      setReminders([]);
      setHasNewAnnouncements(false);
      setShowNotifications(false);
      return;
    }

    Promise.all([
      getAttendanceSummary('elayone-main-choir'),
      getRehearsals('elayone-main-choir'),
      import('./src/api').then(({ getAnnouncements, getSongs }) => Promise.all([
        getAnnouncements('elayone-main-choir'),
        getSongs('elayone-main-choir'),
        getReminders('elayone-main-choir')
      ]))
    ])
      .then(([summary, nextRehearsals, [nextAnnouncements, nextSongs, nextReminders]]) => {
        const normalizedAnnouncements: AnnouncementItem[] = nextAnnouncements.map((item) => ({
          ...item,
          authorName: item.author?.name ?? 'Elayone team',
        }));
        setAttendanceSummary(summary);
        setRehearsals(nextRehearsals.map((rehearsal, index) => ({ ...rehearsal, color: rehearsalColors[index % rehearsalColors.length] })));
        if (!selectedRehearsal && nextRehearsals[0]) {
          setSelectedRehearsal(nextRehearsals[0].id);
        }
        setAnnouncements(normalizedAnnouncements);
        setReminders(nextReminders);
        setHasNewAnnouncements(normalizedAnnouncements.length > 0 || nextReminders.length > 0);
        setSongs(nextSongs.length > 0 ? nextSongs.map((song) => ({ ...song, icon: song.status === 'LEARN' ? 'book-outline' : 'musical-notes-outline' })) : seedSongs);
      })
      .catch(() => {
        setAttendanceSummary({ total: 0, confirmed: 0, rate: 0, upcoming: 0 });
        setRehearsals([]);
        setAnnouncements([]);
        setReminders([]);
        setSongs(seedSongs);
      });
  }, [session]);

  React.useEffect(() => {
    if (!session) return;
    const refreshReminders = async () => {
      try {
        const nextReminders = await getReminders('elayone-main-choir');
        setReminders(nextReminders);
        setHasNewAnnouncements((current) => current || nextReminders.length > 0);
      } catch {
        // Keep existing reminders when the API is temporarily unavailable.
      }
    };
    const interval = setInterval(refreshReminders, 60_000);
    return () => clearInterval(interval);
  }, [session]);

  function handleNotificationsPress() {
    setHasNewAnnouncements(false);
    setShowNotifications(true);
  }

  if (!authReady) return <View style={styles.loadingScreen}><ActivityIndicator color={COLORS.ink} /></View>;
  if (!session) return <AuthScreen onAuthenticated={handleAuthenticated} />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.appShell}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <View style={styles.brandMark}>
              <Image source={require('./elayone.jpg')} style={styles.brandLogo} resizeMode="cover" />
            </View>
            <View style={styles.brandCopy}>
              <Text style={styles.brandName}>ELAYONE MUSIC</Text>
              <Text style={styles.brandSub}>GOSPEL MUSIC MINISTRY</Text>
            </View>
            <TouchableOpacity style={styles.notificationButton} accessibilityLabel="View announcements" onPress={handleNotificationsPress}>
              <Ionicons name="notifications-outline" size={21} color={COLORS.ink} />
              {hasNewAnnouncements && <View style={styles.notificationDot} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.signOutButton} accessibilityLabel="Sign out" onPress={() => signOut().then(() => setSession(null))}>
              <Ionicons name="log-out-outline" size={18} color={COLORS.ink} />
            </TouchableOpacity>
          </View>

          {showNotifications ? (
            <NotificationsPanel announcements={announcements} reminders={reminders} onClose={() => setShowNotifications(false)} />
          ) : showHome ? (
            <>
              <View style={styles.hero}>
                <Text style={styles.eyebrow}>{formattedDate.toUpperCase()} • {formattedTime}</Text>
                <Text style={styles.heroTitle}>Welcome, {welcomeName}.{`\n`}Serve with one voice.</Text>
                <Text style={styles.heroBody}>{dailyVerse}</Text>
              </View>

              <View style={styles.nextRehearsalCard}>
                <View style={styles.cardTopLine}>
                  <Text style={styles.cardEyebrow}>{liveEventLabel}</Text>
                  <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>{liveEventState}</Text></View>
                </View>
                <Text style={styles.rehearsalTitle}>{nextRehearsal?.title ?? 'No rehearsals scheduled yet'}</Text>
                <Text style={[styles.cardEyebrow, { marginTop: 8, marginBottom: 0 }]}> {eventTypeLabel}</Text>
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={16} color={COLORS.muted} />
                  <Text style={styles.detailText}>{nextRehearsal ? `${nextRehearsalParts?.start ?? ''} - ${new Date(nextRehearsal.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Add a rehearsal'}</Text>
                  <Ionicons name="location-outline" size={16} color={COLORS.muted} style={styles.detailIcon} />
                  <Text style={styles.detailText}>{nextRehearsal?.location ?? 'No location yet'}</Text>
                </View>
                <View style={styles.cardFooter}>
                  <View style={styles.avatarStack}>
                    {['A', 'D', 'G', '+'].map((letter, index) => <View key={letter} style={[styles.avatar, { marginLeft: index === 0 ? 0 : -7, backgroundColor: index === 3 ? COLORS.ink : ['#d7c5af', '#b9c2b0', '#d9b7b0'][index] }]}><Text style={[styles.avatarText, index === 3 && { color: COLORS.white }]}>{letter}</Text></View>)}
                  </View>
                  <Text style={styles.attendanceText}>{attendanceSummary.confirmed} confirmed attendance</Text>
                  <TouchableOpacity style={styles.checkInButton} onPress={() => setCheckedIn(!checkedIn)}>
                    <Text style={styles.checkInText}>{checkedIn ? 'Checked in' : 'Check in'}</Text>
                    <Ionicons name={checkedIn ? 'checkmark' : 'arrow-forward'} size={15} color={COLORS.white} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.sectionHeader}>
                <View><Text style={styles.sectionTitle}>This week</Text><Text style={styles.sectionCaption}>Keep the rhythm going</Text></View>
                <TouchableOpacity onPress={() => setActiveTab('Calendar')}><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
              </View>
              <View style={styles.weekGrid}>
                <View style={styles.weekMetric}><Text style={styles.metricNumber}>{String(upcomingRehearsalCount).padStart(2, '0')}</Text><Text style={styles.metricLabel}>REHEARSALS</Text><View style={styles.metricRule} /><Text style={styles.metricFoot}>upcoming</Text></View>
                <View style={styles.weekMetric}><Text style={styles.metricNumber}>{attendanceSummary.rate}<Text style={styles.metricPercent}>%</Text></Text><Text style={styles.metricLabel}>ATTENDANCE</Text><View style={[styles.metricRule, { backgroundColor: COLORS.olive }]} /><Text style={styles.metricFoot}>{attendanceSummary.total} responses</Text></View>
                <View style={styles.weekMetric}><Text style={styles.metricNumber}>{String(songs.length).padStart(2, '0')}</Text><Text style={styles.metricLabel}>SONGS</Text><View style={[styles.metricRule, { backgroundColor: COLORS.clay }]} /><Text style={styles.metricFoot}>in the library</Text></View>
              </View>

              <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Quick access</Text><Text style={styles.sectionCaption}>What do you need today?</Text></View></View>
              <View style={styles.quickGrid}>
                <QuickAction icon="calendar-outline" label="Open calendar" onPress={() => setActiveTab('Calendar')} />
                <QuickAction icon="people-outline" label="View choir" onPress={() => setActiveTab('People')} />
                <QuickAction icon="musical-notes-outline" label="Song library" onPress={() => setActiveTab('Songs')} />
                <QuickAction icon="chatbubble-ellipses-outline" label="Send update" onPress={() => setCheckedIn(true)} />
              </View>
            </>
          ) : activeTab === 'Calendar' ? <CalendarScreen events={orderedRehearsals} canManage={isAdmin} onRefresh={async () => {
            const updatedEvents = await getRehearsals('elayone-main-choir');
            setRehearsals(updatedEvents.map((event, index) => ({ ...event, color: rehearsalColors[index % rehearsalColors.length] })));
          }} onEventCreated={(event) => {
            const nextRehearsal: Rehearsal = { ...event, color: rehearsalColors[rehearsals.length % rehearsalColors.length] };
            setRehearsals((current) => [...current, nextRehearsal]);
            setSelectedRehearsal(nextRehearsal.id);
          }} onRespond={async (eventId, status) => {
            try {
              await updateAttendance('elayone-main-choir', eventId, status);
              const updatedEvents = await getRehearsals('elayone-main-choir');
              setRehearsals(updatedEvents.map((event, index) => ({ ...event, color: rehearsalColors[index % rehearsalColors.length] })));
            } catch (error) {
              throw error;
            }
          }} /> : activeTab === 'Reports' ? <AttendanceReportScreen canManage={isAdmin} /> : activeTab === 'Admin' ? <AdminPanel announcements={announcements} onAnnouncementPublished={(nextAnnouncement) => { setAnnouncements((current) => [{ ...nextAnnouncement, authorName: nextAnnouncement.authorName ?? session?.user.name ?? 'Admin' }, ...current]); setHasNewAnnouncements(true); }} onAnnouncementDeleted={(id) => { setAnnouncements((current) => {
            const next = current.filter((announcement) => announcement.id !== id);
            setHasNewAnnouncements(next.length > 0);
            return next;
          }); }} onSongAdded={(nextSong) => setSongs((current) => [nextSong, ...current])} onRehearsalAdded={(nextRehearsal) => { setRehearsals((current) => [nextRehearsal, ...current]); setSelectedRehearsal(nextRehearsal.id); }} /> : (
            <TabView tab={activeTab} rehearsals={rehearsals} selectedRehearsal={selectedRehearsal} setSelectedRehearsal={setSelectedRehearsal} peopleList={visiblePeople} canManage={isAdmin} onOpenCalendar={() => setActiveTab('Calendar')} onRemovePerson={(id) => setVisiblePeople((current) => current.filter((person) => person.id !== id))} songList={songs} />
          )}
        </ScrollView>
        <View style={styles.bottomNav}>
          {(['Home', 'Calendar', 'People', 'Songs', 'Reports', ...(isAdmin ? ['Admin' as Tab] : [])] as Tab[]).map((tab) => {
            const icon: IconName = tab === 'Home' ? 'home-outline' : tab === 'Calendar' ? 'calendar-outline' : tab === 'People' ? 'people-outline' : tab === 'Songs' ? 'musical-notes-outline' : tab === 'Reports' ? 'stats-chart-outline' : 'shield-checkmark-outline';
            const active = activeTab === tab;
            return <TouchableOpacity key={tab} style={styles.navItem} onPress={() => setActiveTab(tab)}><View style={[styles.navIconWrap, active && styles.navIconActive]}><Ionicons name={icon} size={21} color={active ? COLORS.white : COLORS.muted} /></View><Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab}</Text></TouchableOpacity>;
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

function AttendanceReportScreen({ canManage }: { canManage: boolean }) {
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [needsResponseOnly, setNeedsResponseOnly] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getAttendanceReport('elayone-main-choir')
      .then((result) => { if (active) setReport(result); })
      .catch((requestError) => { if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load attendance reports.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  const personalMember = report?.members[0] ?? null;
  const pendingMemberCount = report?.members.filter((member) => member.stats.pending > 0).length ?? 0;
  const filteredMembers = (report?.members ?? []).filter((member) => {
    const query = memberSearch.trim().toLowerCase();
    const matchesSearch = !query || `${member.name} ${member.email ?? ''} ${member.vocalPart ?? ''}`.toLowerCase().includes(query);
    return matchesSearch && (!needsResponseOnly || member.stats.pending > 0);
  });
  const summary = report?.summary;
  const statusCounts = summary ? { YES: summary.yes, MAYBE: summary.maybe, NO: summary.no, PENDING: summary.pending } : null;

  return (
    <View>
      <View style={styles.reportHeadingRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageEyebrow}>ELAYONE / REPORTS</Text>
          <Text style={styles.pageTitle}>{canManage ? 'Choir reports' : 'My attendance'}</Text>
        </View>
        <TouchableOpacity style={styles.reportRefresh} onPress={() => setReloadKey((current) => current + 1)} accessibilityLabel="Refresh attendance report">
          <Ionicons name="refresh-outline" size={19} color={COLORS.ink} />
        </TouchableOpacity>
      </View>
      <Text style={styles.pageCaption}>{canManage ? 'See availability and response history across the whole choir.' : 'Review your responses and how consistently you have replied.'}</Text>

      {loading ? <View style={styles.reportLoading}><ActivityIndicator color={COLORS.ink} /><Text style={styles.reportHint}>Loading attendance report…</Text></View> : error ? (
        <View style={styles.reportError}><Text style={styles.reportErrorText}>{error}</Text><TouchableOpacity onPress={() => setReloadKey((current) => current + 1)}><Text style={styles.reportRetry}>Try again</Text></TouchableOpacity></View>
      ) : report && summary ? (
        <>
          <View style={styles.reportNotice}>
            <Ionicons name="information-circle-outline" size={17} color={COLORS.olive} />
            <Text style={styles.reportNoticeText}>These are availability responses: “Available” means the member selected YES. No response is shown separately from “Unavailable.”</Text>
          </View>

          {canManage && <View style={styles.reportMetricGrid}>
            <ReportMetric value={String(summary.members)} label="CHOIR MEMBERS" />
            <ReportMetric value={String(summary.rehearsals)} label="EVENTS" />
            <ReportMetric value={`${summary.responseRate}%`} label="RESPONSE RATE" />
          </View>}

          {!canManage && personalMember && <>
            <View style={styles.reportSectionHeader}><Text style={styles.reportSectionTitle}>Your report snapshot</Text><Text style={styles.reportSectionMeta}>{personalMember.events.length} events</Text></View>
            <View style={styles.reportMetricGrid}>
              <ReportMetric value={`${personalMember.stats.responseRate}%`} label="REPLIED" />
              <ReportMetric value={String(personalMember.stats.yes)} label="AVAILABLE" />
              <ReportMetric value={String(personalMember.stats.no)} label="UNAVAILABLE" />
              <ReportMetric value={String(personalMember.stats.pending)} label="NO REPLY" />
            </View>
          </>}

          <View style={styles.reportCard}>
            <View style={styles.reportCardHeader}>
              <View><Text style={styles.reportCardTitle}>{canManage ? 'Choir availability' : 'Your responses'}</Text><Text style={styles.reportCardCaption}>{summary.total} member/event responses</Text></View>
              <Text style={styles.reportRate}>{summary.responseRate}%</Text>
            </View>
            {statusCounts && <StatusDistribution counts={statusCounts} />}
            <View style={styles.reportLegend}>
              <ReportLegend color={COLORS.olive} label={`Available ${summary.yes}`} />
              <ReportLegend color="#c3a877" label={`Maybe ${summary.maybe}`} />
              <ReportLegend color={COLORS.clay} label={`Unavailable ${summary.no}`} />
              <ReportLegend color="#c9c9c4" label={`No response ${summary.pending}`} />
            </View>
          </View>

          {canManage ? (
            <>
              <View style={styles.reportSectionHeader}><Text style={styles.reportSectionTitle}>Event breakdown</Text><Text style={styles.reportSectionMeta}>{report.events.length} total</Text></View>
              {report.events.length === 0 ? <ReportEmpty text="Event response summaries will appear after you add a rehearsal or service." /> : report.events.map((event) => (
                <View key={event.id} style={styles.reportEventCard}>
                  <View style={styles.reportEventTop}>
                    <View style={{ flex: 1 }}><Text style={styles.reportEventTitle}>{event.title}</Text><Text style={styles.reportEventMeta}>{new Date(event.startsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {event.location}</Text></View>
                    <Text style={styles.reportEventType}>{event.eventType.replace('_', ' ')}</Text>
                  </View>
                  <StatusDistribution counts={{ YES: event.totals.yes, MAYBE: event.totals.maybe, NO: event.totals.no, PENDING: event.totals.pending }} />
                  <View style={styles.reportEventCounts}><Text style={styles.reportAvailableText}>{event.totals.yes} available</Text><Text style={styles.reportMaybeText}>{event.totals.maybe} maybe</Text><Text style={styles.reportUnavailableText}>{event.totals.no} unavailable</Text><Text style={styles.reportPendingText}>{event.totals.pending} no reply</Text></View>
                </View>
              ))}

              <View style={styles.reportSectionHeader}><Text style={styles.reportSectionTitle}>Individual reports</Text><Text style={styles.reportSectionMeta}>{report.members.length} members</Text></View>
              <View style={styles.reportSearchWrap}>
                <Ionicons name="search-outline" size={17} color={COLORS.muted} />
                <TextInput value={memberSearch} onChangeText={setMemberSearch} placeholder="Find a member or vocal part" placeholderTextColor={COLORS.muted} accessibilityLabel="Search member reports" style={styles.reportSearchInput} />
                {memberSearch.length > 0 && <TouchableOpacity onPress={() => setMemberSearch('')} accessibilityLabel="Clear member search"><Ionicons name="close-circle" size={17} color={COLORS.muted} /></TouchableOpacity>}
              </View>
              <View style={styles.reportFilterRow}>
                <TouchableOpacity style={[styles.reportFilterChip, !needsResponseOnly && styles.reportFilterChipActive]} onPress={() => setNeedsResponseOnly(false)}>
                  <Text style={[styles.reportFilterText, !needsResponseOnly && styles.reportFilterTextActive]}>All members · {report.members.length}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.reportFilterChip, needsResponseOnly && styles.reportFilterChipActive]} onPress={() => setNeedsResponseOnly(true)}>
                  <Text style={[styles.reportFilterText, needsResponseOnly && styles.reportFilterTextActive]}>Needs reply · {pendingMemberCount}</Text>
                </TouchableOpacity>
              </View>
              {report.members.length === 0 ? <ReportEmpty text="Choir members will appear here once they join." /> : filteredMembers.length === 0 ? <ReportEmpty text={memberSearch ? 'No member matches that search.' : 'No members are waiting to respond.'} /> : filteredMembers.map((member) => {
                const expanded = selectedMemberId === member.id;
                return <View key={member.id} style={styles.reportMemberCard}>
                  <TouchableOpacity style={styles.reportMemberTop} onPress={() => setSelectedMemberId(expanded ? null : member.id)} accessibilityRole="button" accessibilityLabel={`${expanded ? 'Hide' : 'View'} ${member.name}'s report`}>
                    <View style={styles.reportMemberAvatar}><Text style={styles.reportMemberInitial}>{member.name.slice(0, 1).toUpperCase()}</Text></View>
                    <View style={{ flex: 1 }}><Text style={styles.reportMemberName}>{member.name}</Text><Text style={styles.reportMemberMeta}>{member.vocalPart ?? 'Choir member'} · {member.stats.responseRate}% replied</Text></View>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.muted} />
                  </TouchableOpacity>
                  <StatusDistribution counts={{ YES: member.stats.yes, MAYBE: member.stats.maybe, NO: member.stats.no, PENDING: member.stats.pending }} />
                  <View style={styles.reportMiniCounts}><Text style={styles.reportAvailableText}>YES {member.stats.yes}</Text><Text style={styles.reportMaybeText}>MAYBE {member.stats.maybe}</Text><Text style={styles.reportUnavailableText}>NO {member.stats.no}</Text><Text style={styles.reportPendingText}>PENDING {member.stats.pending}</Text></View>
                  {expanded && <View style={styles.reportHistory}>
                    <View style={styles.reportHistoryHeading}><Text style={styles.reportHistoryTitle}>{member.name} · event-by-event</Text><Text style={styles.reportSectionMeta}>{member.events.length} events</Text></View>
                    {member.events.length === 0 ? <Text style={styles.reportHint}>No events recorded yet.</Text> : member.events.map((event) => <ReportHistoryRow key={event.rehearsalId} title={event.title} date={event.startsAt} location={event.location} status={event.status} />)}
                  </View>}
                </View>;
              })}
            </>
          ) : (
            <>
              <View style={styles.reportSectionHeader}><Text style={styles.reportSectionTitle}>Your event history</Text><Text style={styles.reportSectionMeta}>{report.members[0]?.events.length ?? 0} events</Text></View>
              {(personalMember?.events.length ?? 0) === 0 ? <ReportEmpty text="Your event response history will appear here when rehearsals and services are scheduled." /> : personalMember?.events.map((event) => <ReportHistoryRow key={event.rehearsalId} title={event.title} date={event.startsAt} location={event.location} status={event.status} />)}
            </>
          )}
          <Text style={styles.reportGenerated}>Updated {new Date(report.generatedAt).toLocaleString()}</Text>
        </>
      ) : <ReportEmpty text="No attendance report is available yet." />}
    </View>
  );
}

function ReportMetric({ value, label }: { value: string; label: string }) {
  return <View style={styles.reportMetric}><Text style={styles.reportMetricValue}>{value}</Text><Text style={styles.reportMetricLabel}>{label}</Text></View>;
}

function StatusDistribution({ counts }: { counts: Record<AttendanceResponseStatus, number> }) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const segments: Array<{ key: AttendanceResponseStatus; color: string }> = [
    { key: 'YES', color: COLORS.olive }, { key: 'MAYBE', color: '#c3a877' }, { key: 'NO', color: COLORS.clay }, { key: 'PENDING', color: '#c9c9c4' },
  ];
  return <View style={styles.reportBar}>{segments.map(({ key, color }) => <View key={key} style={{ width: `${total ? (counts[key] / total) * 100 : 0}%`, height: '100%', backgroundColor: color }} />)}</View>;
}

function ReportLegend({ color, label }: { color: string; label: string }) {
  return <View style={styles.reportLegendItem}><View style={[styles.reportLegendDot, { backgroundColor: color }]} /><Text style={styles.reportLegendText}>{label}</Text></View>;
}

function ReportHistoryRow({ title, date, location, status }: { title: string; date: string; location: string; status: AttendanceResponseStatus }) {
  const labels: Record<AttendanceResponseStatus, string> = { YES: 'Available', MAYBE: 'Maybe', NO: 'Unavailable', PENDING: 'No response' };
  const pillStyle = status === 'YES' ? styles.reportPillYes : status === 'MAYBE' ? styles.reportPillMaybe : status === 'NO' ? styles.reportPillNo : styles.reportPillPending;
  return <View style={styles.reportHistoryRow}>
    <View style={{ flex: 1 }}><Text style={styles.reportEventTitle}>{title}</Text><Text style={styles.reportEventMeta}>{new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · {location}</Text></View>
    <View style={[styles.reportPill, pillStyle]}><Text style={styles.reportPillText}>{labels[status]}</Text></View>
  </View>;
}

function ReportEmpty({ text }: { text: string }) {
  return <View style={styles.reportEmpty}><Ionicons name="bar-chart-outline" size={22} color={COLORS.muted} /><Text style={styles.reportEmptyText}>{text}</Text></View>;
}

function CalendarScreen({ events, canManage, onRefresh, onEventCreated, onRespond }: { events: Rehearsal[]; canManage: boolean; onRefresh: () => Promise<void>; onEventCreated: (event: RehearsalRecord) => void; onRespond: (eventId: string, status: 'YES' | 'MAYBE' | 'NO') => Promise<void> }) {
  const [viewDate, setViewDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [localResponses, setLocalResponses] = useState<Record<string, 'YES' | 'MAYBE' | 'NO'>>({});
  const [responseNotice, setResponseNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventStartTime, setEventStartTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [eventType, setEventType] = useState<EventType>('REHEARSAL');
  const [customEventType, setCustomEventType] = useState('');
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState(() => new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarCells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  const isSameDay = (dateString: string, day: Date) => {
    const date = new Date(dateString);
    return date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate();
  };
  const monthEvents = events.filter((event) => {
    const date = new Date(event.startsAt);
    return date.getFullYear() === year && date.getMonth() === month;
  });
  const dayEvents = monthEvents.filter((event) => isSameDay(event.startsAt, selectedDay));
  const upcomingEvents = events.filter((event) => new Date(event.endsAt).getTime() >= Date.now());

  useEffect(() => {
    if (!canManage) return;
    const refreshResponses = async () => {
      try {
        await onRefresh();
        setLastCheckedAt(new Date());
      } catch {
        // Keep the current response counts when a background refresh cannot connect.
      }
    };
    const interval = setInterval(refreshResponses, 10000);
    return () => clearInterval(interval);
  }, [canManage, onRefresh]);

  async function refreshNow() {
    setRefreshing(true);
    try {
      await onRefresh();
      setLastCheckedAt(new Date());
    } catch (error) {
      setResponseNotice({ type: 'error', message: error instanceof Error ? error.message : 'Could not refresh event responses.' });
    } finally {
      setRefreshing(false);
    }
  }

  async function saveResponse(eventId: string, status: 'YES' | 'MAYBE' | 'NO') {
    setBusyEventId(eventId);
    setResponseNotice(null);
    try {
      await onRespond(eventId, status);
      setLocalResponses((current) => ({ ...current, [eventId]: status }));
      setResponseNotice({ type: 'success', message: `Your response was saved: ${status === 'YES' ? 'you accepted' : status === 'MAYBE' ? 'you marked maybe' : 'you declined'} this event.` });
    } catch (error) {
      setResponseNotice({ type: 'error', message: error instanceof Error ? error.message : 'We could not save your response. Please try again.' });
    } finally {
      setBusyEventId(null);
    }
  }

  function shiftMonth(offset: number) {
    const next = new Date(year, month + offset, 1);
    setViewDate(next);
    setSelectedDay(new Date(next.getFullYear(), next.getMonth(), 1));
  }

  async function addEvent() {
    if (!eventTitle.trim() || !eventLocation.trim() || !eventDate || !eventStartTime || !eventEndTime) {
      setResponseNotice({ type: 'error', message: 'Add a title, location, date, start time, and end time.' });
      return;
    }
    if (eventType === 'CUSTOM' && !customEventType.trim()) {
      setResponseNotice({ type: 'error', message: 'Enter a name for the custom event type.' });
      return;
    }
    const startDate = new Date(`${eventDate}T${eventStartTime}:00`);
    const endDate = new Date(`${eventDate}T${eventEndTime}:00`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      setResponseNotice({ type: 'error', message: 'Choose a valid schedule, with the end time after the start time.' });
      return;
    }
    setCreatingEvent(true);
    setResponseNotice(null);
    try {
      const created = await createRehearsal('elayone-main-choir', {
        title: eventTitle.trim(),
        location: eventLocation.trim(),
        startsAt: startDate.toISOString(),
        endsAt: endDate.toISOString(),
        eventType,
        customEventType: eventType === 'CUSTOM' ? customEventType.trim() : undefined,
      });
      onEventCreated(created);
      setShowCreateForm(false);
      setEventTitle('');
      setEventLocation('');
      setEventDate('');
      setEventStartTime('');
      setEventEndTime('');
      setEventType('REHEARSAL');
      setCustomEventType('');
      setResponseNotice({ type: 'success', message: 'Event added to the choir calendar.' });
    } catch (error) {
      setResponseNotice({ type: 'error', message: error instanceof Error ? error.message : 'We could not add this event.' });
    } finally {
      setCreatingEvent(false);
    }
  }

  return <View>
    <Text style={styles.pageEyebrow}>ELAYONE / SCHEDULE</Text>
    <Text style={styles.pageTitle}>Choir calendar</Text>
    <Text style={styles.pageCaption}>{canManage ? 'View scheduled events and track invite responses.' : 'Your invitations, schedule, and availability in one place.'}</Text>
    {canManage && <View style={styles.calendarResponseHeader}>
      <Text style={styles.calendarResponseHeaderText}>Member responses update automatically · checked {lastCheckedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      <TouchableOpacity style={styles.calendarRefreshButton} onPress={refreshNow} disabled={refreshing} accessibilityLabel="Refresh event responses">
        {refreshing ? <ActivityIndicator size="small" color={COLORS.ink} /> : <Ionicons name="refresh-outline" size={17} color={COLORS.ink} />}
      </TouchableOpacity>
    </View>}
    {canManage && <TouchableOpacity style={styles.addButton} onPress={() => setShowCreateForm((current) => !current)}>
      <Ionicons name={showCreateForm ? 'close' : 'add'} size={19} color={COLORS.white} />
      <Text style={styles.addButtonText}>{showCreateForm ? 'Cancel event' : 'Add event to calendar'}</Text>
    </TouchableOpacity>}
    {canManage && showCreateForm && <View style={styles.calendarCreateForm}>
      <Text style={styles.calendarCreateTitle}>New choir event</Text>
      <Text style={styles.calendarCreateCaption}>This event will be visible to the whole choir.</Text>
      <Field label="EVENT TITLE" value={eventTitle} onChangeText={setEventTitle} placeholder="Sunday service" />
      <Field label="LOCATION" value={eventLocation} onChangeText={setEventLocation} placeholder="Main sanctuary" />
      <Field label="DATE" value={eventDate} onChangeText={setEventDate} placeholder="2026-10-04" />
      <View style={styles.inlineFieldRow}>
        <Field label="START TIME" value={eventStartTime} onChangeText={setEventStartTime} placeholder="18:00" />
        <Field label="END TIME" value={eventEndTime} onChangeText={setEventEndTime} placeholder="20:00" />
      </View>
      <Text style={[styles.fieldLabel, { marginBottom: 8 }]}>EVENT TYPE</Text>
      <View style={styles.priorityRow}>
        {(['SERVICE', 'REHEARSAL', 'WORSHIP_NIGHT', 'SPECIAL_EVENT', 'CUSTOM'] as const).map((option) => <TouchableOpacity key={option} style={[styles.priorityOption, eventType === option && styles.priorityOptionActive]} onPress={() => setEventType(option)} accessibilityRole="button" accessibilityState={{ selected: eventType === option }} accessibilityLabel={`Event type ${option.replace('_', ' ')}`}>
          <Text style={[styles.priorityText, eventType === option && styles.priorityTextActive]}>{option.replace('_', ' ')}</Text>
        </TouchableOpacity>)}
      </View>
      {eventType === 'CUSTOM' && <Field label="CUSTOM EVENT TYPE" value={customEventType} onChangeText={setCustomEventType} placeholder="Choir retreat" />}
      <TouchableOpacity style={styles.adminButton} onPress={addEvent} disabled={creatingEvent}>
        <Text style={styles.adminButtonText}>{creatingEvent ? 'Adding event...' : 'Save event'}</Text>
      </TouchableOpacity>
    </View>}
    {responseNotice && <View style={[styles.noticeBanner, responseNotice.type === 'success' ? styles.noticeSuccess : styles.noticeError]}><Text style={[styles.noticeText, responseNotice.type === 'success' ? styles.noticeTextSuccess : styles.noticeTextError]}>{responseNotice.message}</Text></View>}

    <View style={styles.calendarCard}>
      <View style={styles.calendarMonthHeader}>
        <TouchableOpacity style={styles.calendarArrow} onPress={() => shiftMonth(-1)} accessibilityLabel="Previous month"><Ionicons name="chevron-back" size={19} color={COLORS.ink} /></TouchableOpacity>
        <Text style={styles.calendarMonthTitle}>{viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
        <TouchableOpacity style={styles.calendarArrow} onPress={() => shiftMonth(1)} accessibilityLabel="Next month"><Ionicons name="chevron-forward" size={19} color={COLORS.ink} /></TouchableOpacity>
      </View>
      <View style={styles.calendarGrid}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => <Text key={`${label}-${index}`} style={styles.calendarWeekday}>{label}</Text>)}
        {calendarCells.map((day, index) => {
          if (day === null) return <View key={`blank-${index}`} style={styles.calendarDayCell} />;
          const cellDate = new Date(year, month, day);
          const hasEvent = monthEvents.some((event) => isSameDay(event.startsAt, cellDate));
          const selected = isSameDay(selectedDay.toISOString(), cellDate);
          const today = isSameDay(new Date().toISOString(), cellDate);
          return <TouchableOpacity key={day} style={[styles.calendarDayCell, selected && styles.calendarDaySelected]} onPress={() => setSelectedDay(cellDate)}>
            <Text style={[styles.calendarDayText, selected && styles.calendarDayTextSelected, today && !selected && styles.calendarDayToday]}>{day}</Text>
            {hasEvent && <View style={[styles.calendarEventDot, selected && styles.calendarEventDotSelected]} />}
          </TouchableOpacity>;
        })}
      </View>
      <View style={styles.calendarKey}><View style={styles.calendarEventDot} /><Text style={styles.calendarKeyText}>{monthEvents.length} event{monthEvents.length === 1 ? '' : 's'} this month</Text></View>
    </View>

    <View style={styles.calendarListHeader}><Text style={styles.reportSectionTitle}>{selectedDay.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text><Text style={styles.reportSectionMeta}>{dayEvents.length} events</Text></View>
    {dayEvents.length === 0 ? <ReportEmpty text="Nothing scheduled for this day. Tap a marked date to view its events." /> : dayEvents.map((event) => <CalendarEventCard key={event.id} event={event} canManage={canManage} response={localResponses[event.id] ?? event.myStatus ?? 'PENDING'} busy={busyEventId === event.id} onRespond={(status) => saveResponse(event.id, status)} />)}

    <View style={styles.calendarListHeader}><Text style={styles.reportSectionTitle}>Upcoming invitations</Text><Text style={styles.reportSectionMeta}>{upcomingEvents.length}</Text></View>
    {upcomingEvents.length === 0 ? <ReportEmpty text="No upcoming events have been scheduled." /> : upcomingEvents.slice(0, 12).map((event) => <CalendarEventCard key={`upcoming-${event.id}`} event={event} canManage={canManage} response={localResponses[event.id] ?? event.myStatus ?? 'PENDING'} busy={busyEventId === event.id} onRespond={(status) => saveResponse(event.id, status)} />)}
  </View>;
}

function CalendarEventCard({ event, canManage, response, busy, onRespond }: { event: Rehearsal; canManage: boolean; response: AttendanceResponseStatus; busy: boolean; onRespond: (status: 'YES' | 'MAYBE' | 'NO') => void }) {
  const labels: Record<AttendanceResponseStatus, string> = { YES: 'Accepted', MAYBE: 'Maybe', NO: 'Declined', PENDING: event.invitationOnly ? 'Awaiting reply' : 'Not responded' };
  const responseStyle = response === 'YES' ? styles.reportPillYes : response === 'MAYBE' ? styles.reportPillMaybe : response === 'NO' ? styles.reportPillNo : styles.reportPillPending;
  const canRespond = !canManage && event.invited !== false && new Date(event.endsAt).getTime() >= Date.now();
  return <View style={styles.calendarEventCard}>
    <View style={styles.calendarEventCardTop}>
      <View style={[styles.calendarDateBadge, { backgroundColor: event.color }]}><Text style={styles.calendarDateDay}>{new Date(event.startsAt).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}</Text><Text style={styles.calendarDateNumber}>{new Date(event.startsAt).getDate()}</Text><Text style={styles.calendarDateMonth}>{new Date(event.startsAt).toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.calendarEventTitle}>{event.title}</Text>
        <Text style={styles.calendarEventMeta}>{new Date(event.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–{new Date(event.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {event.location}</Text>
        <Text style={styles.calendarEventType}>{(event.eventTypeName ?? event.eventType ?? 'REHEARSAL').replace('_', ' ')}{event.invitationOnly ? ' · PERSONAL INVITE' : ' · WHOLE CHOIR'}</Text>
      </View>
      <View style={[styles.reportPill, responseStyle]}><Text style={styles.reportPillText}>{labels[response]}</Text></View>
    </View>
    {canManage ? <>
      <View style={styles.calendarAdminSummary}><Ionicons name="people-outline" size={15} color={COLORS.muted} /><Text style={styles.calendarAdminSummaryText}>{event.invitees ? `${event.invitees.filter((member) => member.status === 'YES').length} accepted · ${event.invitees.filter((member) => member.status === 'NO').length} declined · ${event.invitees.filter((member) => member.status === 'PENDING' || member.status === 'MAYBE').length} awaiting` : `${event.confirmedCount ?? 0} accepted`}</Text></View>
      {event.invitees && event.invitees.length > 0 && <View style={styles.calendarInviteeList}>{event.invitees.map((member) => <View key={member.userId} style={styles.calendarInviteeRow}><Text style={styles.calendarInviteeName}>{member.name}</Text><Text style={[styles.calendarInviteeStatus, member.status === 'YES' ? styles.reportAvailableText : member.status === 'NO' ? styles.reportUnavailableText : styles.reportPendingText]}>{labels[member.status]}</Text></View>)}</View>}
    </> : canRespond ? <>
      <Text style={styles.calendarPrompt}>{event.invitationOnly ? 'You have been invited. Please respond:' : 'Let the choir know your availability:'}</Text>
      <View style={styles.calendarResponseButtons}>
        {(['YES', 'MAYBE', 'NO'] as const).map((status) => <TouchableOpacity key={status} disabled={busy} style={[styles.calendarResponseButton, response === status && styles.calendarResponseButtonActive]} onPress={() => onRespond(status)}>
          {busy && response === status ? <ActivityIndicator size="small" color={COLORS.ink} /> : <Text style={[styles.calendarResponseText, response === status && styles.calendarResponseTextActive]}>{status === 'YES' ? 'Accept' : status === 'MAYBE' ? 'Maybe' : 'Decline'}</Text>}
        </TouchableOpacity>)}
      </View>
    </> : null}
  </View>;
}

function AdminPanel({ announcements, onAnnouncementPublished, onAnnouncementDeleted, onSongAdded, onRehearsalAdded }: { announcements: AnnouncementItem[]; onAnnouncementPublished: (announcement: AnnouncementItem) => void; onAnnouncementDeleted: (id: string) => void; onSongAdded: (song: SongItem) => void; onRehearsalAdded: (rehearsal: Rehearsal) => void }) {
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPassword, setMemberPassword] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventStartTime, setEventStartTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [eventType, setEventType] = useState<EventType>('REHEARSAL');
  const [customEventType, setCustomEventType] = useState('');
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'NONE' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'>('NONE');
  const [recurrenceCount, setRecurrenceCount] = useState('1');
  const [inviteMode, setInviteMode] = useState<'ALL' | 'SELECTED'>('ALL');
  const [selectedInviteeIds, setSelectedInviteeIds] = useState<string[]>([]);
  const [newsTitle, setNewsTitle] = useState('');
  const [newsMessage, setNewsMessage] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [songKey, setSongKey] = useState('');
  const [songPreviewUrl, setSongPreviewUrl] = useState('');
  const [songStatus, setSongStatus] = useState<'READY' | 'LEARN'>('READY');
  const [songNotes, setSongNotes] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'IMPORTANT'>('NORMAL');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const choirId = 'elayone-main-choir';
  const choirMembers = users.filter((user) => user.memberships.some((membership) => membership.choirId === choirId));

  React.useEffect(() => {
    getAllUsers().then(setUsers).catch(() => undefined).finally(() => setUsersLoading(false));
  }, []);

  async function createMember() {
    if (memberName.trim().length < 2) return setNotice({ type: 'error', text: 'Please enter the member’s full name (at least 2 characters).' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(memberEmail.trim())) return setNotice({ type: 'error', text: 'Please enter a valid email address for the member.' });
    if (memberPassword.length < 8) return setNotice({ type: 'error', text: 'The temporary password must be at least 8 characters.' });
    setBusy(true);
    setNotice(null);
    try {
      const createdUser = await createMemberAccount({ name: memberName.trim(), email: memberEmail.trim(), password: memberPassword });
      setUsers((current) => [createdUser, ...current]);
      setMemberName('');
      setMemberEmail('');
      setMemberPassword('');
      setNotice({ type: 'success', text: `Account created for ${createdUser.name}. Share the temporary password with them securely.` });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'We could not create the account. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function addEvent() {
    if (!eventTitle.trim() || !eventLocation.trim() || !eventDate.trim() || !eventStartTime.trim() || !eventEndTime.trim()) {
      setNotice({ type: 'error', text: 'Add the event title, location, date, start time, and end time before saving.' });
      return;
    }
    if (eventType === 'CUSTOM' && !customEventType.trim()) {
      setNotice({ type: 'error', text: 'Enter a name for the custom event type before saving.' });
      return;
    }
    const parsedRecurrenceCount = Number(recurrenceCount);
    if (!Number.isInteger(parsedRecurrenceCount) || parsedRecurrenceCount < 1 || parsedRecurrenceCount > 52) {
      setNotice({ type: 'error', text: 'Choose between 1 and 52 occurrences.' });
      return;
    }
    const startDate = new Date(`${eventDate}T${eventStartTime}:00`);
    const endDate = new Date(`${eventDate}T${eventEndTime}:00`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      setNotice({ type: 'error', text: 'Enter a valid date and time, and make sure the end time is after the start time.' });
      return;
    }
    if (inviteMode === 'SELECTED' && selectedInviteeIds.length === 0) {
      setNotice({ type: 'error', text: 'Choose at least one choir member, or select Whole choir.' });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const created = await createRehearsal(choirId, {
        title: eventTitle.trim(),
        location: eventLocation.trim(),
        startsAt: startDate.toISOString(),
        endsAt: endDate.toISOString(),
        eventType,
        customEventType: eventType === 'CUSTOM' ? customEventType.trim() : undefined,
        recurrenceFrequency,
        recurrenceCount: recurrenceFrequency === 'NONE' ? 1 : parsedRecurrenceCount,
        inviteeIds: inviteMode === 'SELECTED' ? selectedInviteeIds : undefined,
      });
      const nextRehearsal: Rehearsal = { ...created, color: rehearsalColors[0] };
      onRehearsalAdded(nextRehearsal);
      setEventTitle('');
      setEventLocation('');
      setEventDate('');
      setEventStartTime('');
      setEventEndTime('');
      setEventType('REHEARSAL');
      setCustomEventType('');
      setRecurrenceFrequency('NONE');
      setRecurrenceCount('1');
      setInviteMode('ALL');
      setSelectedInviteeIds([]);
      setNotice({ type: 'success', text: inviteMode === 'SELECTED' ? `Invitation sent to ${selectedInviteeIds.length} choir member${selectedInviteeIds.length === 1 ? '' : 's'}.` : 'Event added successfully and is now visible to the whole choir.' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'We could not schedule the event. Please try again.' });
      Alert.alert('Could not add event', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function publishNews() {
    if (!newsTitle.trim() || !newsMessage.trim()) {
      setNotice({ type: 'error', text: 'Please add both a title and a message before sending the announcement.' });
      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      await publishAnnouncement(choirId, { title: newsTitle.trim(), message: newsMessage.trim(), priority });
      onAnnouncementPublished({
        id: `${Date.now()}`,
        title: newsTitle.trim(),
        message: newsMessage.trim(),
        priority,
        createdAt: new Date().toISOString(),
        authorName: 'You',
      });
      setNewsTitle('');
      setNewsMessage('');
      setPriority('NORMAL');
      setNotice({ type: 'success', text: 'Announcement sent successfully. The choir can now see it.' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Unable to send the announcement right now.' });
    } finally {
      setBusy(false);
    }
  }

  async function addSong() {
    if (!songTitle.trim()) {
      setNotice({ type: 'error', text: 'Add a song title before saving it.' });
      return;
    }
    if (songPreviewUrl.trim()) {
      try {
        new URL(songPreviewUrl.trim());
      } catch {
        setNotice({ type: 'error', text: 'Enter a valid preview URL, or leave it empty.' });
        return;
      }
    }
    setBusy(true);
    setNotice(null);
    try {
      const created = await createSong(choirId, {
        title: songTitle.trim(),
        key: songKey.trim() || undefined,
        status: songStatus,
        previewUrl: songPreviewUrl.trim() || undefined,
        notes: songNotes.trim() || undefined,
      });
      const nextSong: SongItem = {
        ...created,
        key: created.key ?? (songKey.trim() || null),
        status: created.status ?? songStatus,
        notes: created.notes ?? null,
        previewUrl: created.previewUrl ?? (songPreviewUrl.trim() || null),
        icon: created.status === 'LEARN' ? 'book-outline' : 'musical-notes-outline',
      };
      onSongAdded(nextSong);
      setSongTitle('');
      setSongKey('');
      setSongPreviewUrl('');
      setSongStatus('READY');
      setSongNotes('');
      setNotice({ type: 'success', text: 'Song saved successfully and added to the library.' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Could not save the song right now.' });
      Alert.alert('Could not save song', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId: string, nextRole: 'MEMBER' | 'LEADER' | 'ADMIN') {
    setNotice(null);
    try {
      const updated = await updateUserRole(userId, nextRole);
      setUsers((current) => current.map((user) => user.id === userId ? { ...user, role: updated.role } : user));
      setNotice({ type: 'success', text: `${updated.name} is now a ${updated.role}.` });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Could not update this role right now.' });
    }
  }

  async function removeMember(userId: string) {
    setNotice(null);
    try {
      await removeChoirMember(choirId, userId);
      setUsers((current) => current.filter((user) => user.id !== userId));
      setNotice({ type: 'success', text: 'Member removed from this choir.' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Could not remove this member.' });
    }
  }

  async function refreshUsers() {
    setUsersLoading(true);
    setNotice(null);
    try {
      const refreshedUsers = await getAllUsers();
      setUsers(refreshedUsers);
      setNotice({ type: 'success', text: 'Member list is up to date.' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'We could not refresh the member list. Please try again.' });
    } finally {
      setUsersLoading(false);
    }
  }

  return (
    <View>
      <Text style={styles.pageEyebrow}>ELAYONE / ADMIN</Text>
      <Text style={styles.pageTitle}>Lead the ministry</Text>
      <Text style={styles.pageCaption}>Keep the choir informed, prepared, and cared for.</Text>

      <View style={styles.adminNotice}>
        <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.olive} />
        <View style={{ flex: 1 }}>
          <Text style={styles.adminNoticeTitle}>Leader access</Text>
          <Text style={styles.adminNoticeText}>Your changes are shared with the whole choir.</Text>
        </View>
      </View>

      {notice ? (
        <View style={[styles.noticeBanner, notice.type === 'success' ? styles.noticeSuccess : styles.noticeError]}>
          <Text style={[styles.noticeText, notice.type === 'success' ? styles.noticeTextSuccess : styles.noticeTextError]}>{notice.text}</Text>
        </View>
      ) : null}

      <AdminForm title="All registered users" icon="people-circle-outline">
        <View style={styles.directoryHeader}>
          <Text style={styles.directoryCount}>{users.length}</Text>
          <Text style={styles.directoryLabel}>accounts</Text>
          <TouchableOpacity onPress={refreshUsers} accessibilityLabel="Refresh member list">
            <Ionicons name="refresh-outline" size={19} color={COLORS.ink} />
          </TouchableOpacity>
        </View>
        {usersLoading ? (
          <ActivityIndicator color={COLORS.ink} />
        ) : users.length === 0 ? (
          <Text style={styles.adminHelp}>No registered users yet.</Text>
        ) : users.map((user) => {
          const isProtectedAdmin = user.role === 'ADMIN';
          return (
            <View key={user.id} style={styles.directoryRow}>
              <View style={styles.directoryAvatar}><Text style={styles.directoryInitial}>{user.name.slice(0, 1).toUpperCase()}</Text></View>
              <View style={styles.personInfo}>
                <Text style={styles.personName}>{user.name}</Text>
                <Text style={styles.personRole}>{user.email}</Text>
                <Text style={styles.directoryMeta}>{user.role} · {user.memberships.length} choir membership{user.memberships.length === 1 ? '' : 's'}</Text>
              </View>
              <View style={styles.roleActions}>
                {user.role !== 'ADMIN' && (
                  <TouchableOpacity style={styles.smallActionButton} onPress={() => changeRole(user.id, 'ADMIN')}>
                    <Text style={styles.smallActionText}>Make admin</Text>
                  </TouchableOpacity>
                )}
                {!isProtectedAdmin && user.role !== 'MEMBER' && (
                  <TouchableOpacity style={styles.smallSecondaryActionButton} onPress={() => changeRole(user.id, 'MEMBER')}>
                    <Text style={styles.smallSecondaryActionText}>Member</Text>
                  </TouchableOpacity>
                )}
                {!isProtectedAdmin && (
                  <TouchableOpacity style={styles.removeIconButton} onPress={() => removeMember(user.id)} accessibilityLabel={`Remove ${user.name}`}>
                    <Ionicons name="person-remove-outline" size={17} color={COLORS.clay} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </AdminForm>

      <AdminForm title="Create a member account" icon="person-add-outline">
        <Text style={styles.adminHelp}>Accounts are created by the choir admin. Give the member their sign-in details securely.</Text>
        <Field label="MEMBER FULL NAME" value={memberName} onChangeText={setMemberName} placeholder="Full name" autoCapitalize="words" />
        <Field label="MEMBER EMAIL" value={memberEmail} onChangeText={setMemberEmail} placeholder="member@example.com" keyboardType="email-address" autoCapitalize="none" />
        <Field label="TEMPORARY PASSWORD" value={memberPassword} onChangeText={setMemberPassword} placeholder="At least 8 characters" secureTextEntry />
        <TouchableOpacity style={styles.adminButton} onPress={createMember} disabled={busy}>
          <Text style={styles.adminButtonText}>{busy ? 'Creating account…' : 'Create member account'}</Text>
        </TouchableOpacity>
      </AdminForm>

      <AdminForm title="Plan a service or rehearsal" icon="calendar-outline">
        <Field label="EVENT TITLE" value={eventTitle} onChangeText={setEventTitle} placeholder="Sunday service set" />
        <Field label="LOCATION" value={eventLocation} onChangeText={setEventLocation} placeholder="Main sanctuary" />
        <View style={styles.inlineFieldRow}>
          <Field label="DATE" value={eventDate} onChangeText={setEventDate} placeholder="2026-09-20" />
        </View>
        <View style={styles.inlineFieldRow}>
          <Field label="START TIME" value={eventStartTime} onChangeText={setEventStartTime} placeholder="18:00" />
          <Field label="END TIME" value={eventEndTime} onChangeText={setEventEndTime} placeholder="20:00" />
        </View>
        <Text style={[styles.fieldLabel, { marginBottom: 8 }]}>EVENT TYPE</Text>
        <View style={styles.priorityRow}>
          {(['SERVICE', 'REHEARSAL', 'WORSHIP_NIGHT', 'SPECIAL_EVENT', 'CUSTOM'] as const).map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.priorityOption, eventType === option && styles.priorityOptionActive]}
              onPress={() => setEventType(option)}
              accessibilityRole="button"
              accessibilityState={{ selected: eventType === option }}
              accessibilityLabel={`Event type ${option.replace('_', ' ')}`}
            >
              <Text style={[styles.priorityText, eventType === option && styles.priorityTextActive]}>{option.replace('_', ' ')}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {eventType === 'CUSTOM' && <Field label="CUSTOM EVENT TYPE" value={customEventType} onChangeText={setCustomEventType} placeholder="Choir retreat" />}
        <Text style={[styles.fieldLabel, { marginTop: 5, marginBottom: 8 }]}>REPEAT EVENT</Text>
        <View style={styles.priorityRow}>
          {([{ value: 'NONE', label: 'Does not repeat' }, { value: 'WEEKLY', label: 'Every week' }, { value: 'BIWEEKLY', label: 'Every 2 weeks' }, { value: 'MONTHLY', label: 'Every month' }] as const).map((option) => <TouchableOpacity key={option.value} style={[styles.priorityOption, recurrenceFrequency === option.value && styles.priorityOptionActive]} onPress={() => setRecurrenceFrequency(option.value)}>
            <Text style={[styles.priorityText, recurrenceFrequency === option.value && styles.priorityTextActive]}>{option.label}</Text>
          </TouchableOpacity>)}
        </View>
        {recurrenceFrequency !== 'NONE' && <Field label="NUMBER OF OCCURRENCES (1-52)" value={recurrenceCount} onChangeText={setRecurrenceCount} placeholder="4" keyboardType="number-pad" />}
        <Text style={[styles.fieldLabel, { marginTop: 5, marginBottom: 8 }]}>WHO SHOULD RECEIVE THIS EVENT?</Text>
        <View style={styles.priorityRow}>
          {([{ id: 'ALL', label: 'Whole choir' }, { id: 'SELECTED', label: 'Choose members' }] as const).map((option) => (
            <TouchableOpacity key={option.id} style={[styles.priorityOption, inviteMode === option.id && styles.priorityOptionActive]} onPress={() => setInviteMode(option.id)}>
              <Text style={[styles.priorityText, inviteMode === option.id && styles.priorityTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {inviteMode === 'SELECTED' && (
          <View style={styles.inviteePicker}>
            <Text style={styles.inviteePickerCaption}>{selectedInviteeIds.length} selected · only selected members will see and respond to this invitation</Text>
            {usersLoading ? <ActivityIndicator color={COLORS.ink} /> : choirMembers.length === 0 ? <Text style={styles.adminHelp}>No choir members are available to invite yet.</Text> : choirMembers.map((member) => {
              const selected = selectedInviteeIds.includes(member.id);
              return <TouchableOpacity key={member.id} style={styles.inviteeRow} onPress={() => setSelectedInviteeIds((current) => selected ? current.filter((id) => id !== member.id) : [...current, member.id])} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}>
                <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={20} color={selected ? COLORS.olive : COLORS.muted} />
                <View style={{ flex: 1 }}><Text style={styles.inviteeName}>{member.name}</Text><Text style={styles.inviteeMeta}>{member.memberships.find((membership) => membership.choirId === choirId)?.vocalPart ?? 'Choir member'} · {member.email}</Text></View>
              </TouchableOpacity>;
            })}
          </View>
        )}
        <TouchableOpacity style={styles.adminButton} onPress={addEvent} disabled={busy}>
          <Text style={styles.adminButtonText}>{busy ? 'Saving...' : inviteMode === 'SELECTED' ? 'Schedule and invite' : 'Add event for choir'}</Text>
        </TouchableOpacity>
      </AdminForm>

      <AdminForm title="Recent announcements" icon="megaphone-outline">
        {announcements.length === 0 ? (
          <Text style={styles.adminHelp}>No announcements to manage yet.</Text>
        ) : announcements.map((item) => (
          <View key={item.id} style={styles.adminAnnouncementRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.adminAnnouncementTitle}>{item.title}</Text>
              <Text style={styles.adminAnnouncementMeta}>{item.authorName ?? 'Elayone team'} · {new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
            <TouchableOpacity style={styles.removeIconButton} onPress={async () => {
              try {
                await deleteAnnouncement(choirId, item.id);
                onAnnouncementDeleted(item.id);
                setNotice({ type: 'success', text: 'Announcement deleted.' });
              } catch (error) {
                setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Could not delete this announcement.' });
              }
            }} accessibilityLabel={`Delete ${item.title}`}>
              <Ionicons name="trash-outline" size={17} color={COLORS.clay} />
            </TouchableOpacity>
          </View>
        ))}
      </AdminForm>

      <AdminForm title="Add a song" icon="musical-notes-outline">
        <Field label="SONG TITLE" value={songTitle} onChangeText={setSongTitle} placeholder="I will praise you" />
        <Field label="KEY" value={songKey} onChangeText={setSongKey} placeholder="Key of G" />
        <Field label="PREVIEW URL" value={songPreviewUrl} onChangeText={setSongPreviewUrl} placeholder="https://example.com/song.mp3" />
        <Field label="NOTES" value={songNotes} onChangeText={setSongNotes} placeholder="Add singing notes or rehearsal tips" multiline />
        <TouchableOpacity style={styles.adminButton} onPress={addSong} disabled={busy}>
          <Text style={styles.adminButtonText}>{busy ? 'Saving...' : 'Add song'}</Text>
        </TouchableOpacity>
      </AdminForm>

      <AdminForm title="Publish a choir update" icon="megaphone-outline">
        <Field label="HEADLINE" value={newsTitle} onChangeText={setNewsTitle} placeholder="A note for the choir" />
        <Field label="MESSAGE" value={newsMessage} onChangeText={setNewsMessage} placeholder="Write your announcement" multiline />
        <View style={styles.priorityRow}>
          {(['NORMAL', 'IMPORTANT'] as const).map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.priorityOption, priority === option && (option === 'IMPORTANT' ? styles.priorityOptionActiveImportant : styles.priorityOptionActive)]}
              onPress={() => setPriority(option)}
            >
              <Text style={[styles.priorityText, priority === option && (option === 'IMPORTANT' ? styles.priorityTextActiveImportant : styles.priorityTextActive)]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.adminButton} onPress={publishNews} disabled={busy}>
          <Text style={styles.adminButtonText}>{busy ? 'Sending...' : 'Send announcement'}</Text>
        </TouchableOpacity>
      </AdminForm>
    </View>
  );
}

function NotificationsPanel({ announcements, reminders, onClose }: { announcements: AnnouncementItem[]; reminders: ReminderRecord[]; onClose: () => void }) {
  return <View style={styles.notificationsPanel}><View style={styles.notificationsHeader}><View><Text style={styles.pageEyebrow}>ELAYONE / ALERTS</Text><Text style={styles.pageTitle}>Notifications</Text></View><TouchableOpacity onPress={onClose} style={styles.closeButton}><Ionicons name="close" size={18} color={COLORS.ink} /></TouchableOpacity></View>{announcements.length === 0 && reminders.length === 0 ? <View style={styles.emptyState}><Ionicons name="notifications-off-outline" size={24} color={COLORS.muted} /><Text style={styles.emptyStateTitle}>No reminders yet</Text><Text style={styles.emptyStateText}>Event and choir updates will appear here when they need your attention.</Text></View> : <>{reminders.map((item) => <View key={item.id} style={styles.notificationCard}><View style={styles.notificationTop}><Text style={styles.notificationLabel}>{item.priority === 'IMPORTANT' ? 'ACTION NEEDED' : 'REMINDER'}</Text><Text style={styles.notificationTime}>{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text></View><Text style={styles.notificationTitle}>{item.title}</Text><View style={styles.notificationMeta}><Ionicons name={item.kind === 'RESPONSE' ? 'checkbox-outline' : 'calendar-outline'} size={14} color={COLORS.muted} /><Text style={styles.notificationAuthor}>{item.kind === 'RESPONSE' ? 'Response reminder' : 'Event reminder'}</Text></View><Text style={styles.notificationMessage}>{item.message}</Text></View>)}{announcements.map((item) => <View key={item.id} style={styles.notificationCard}><View style={styles.notificationTop}><Text style={styles.notificationLabel}>{item.priority === 'IMPORTANT' ? 'IMPORTANT' : 'UPDATE'}</Text><Text style={styles.notificationTime}>{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text></View><Text style={styles.notificationTitle}>{item.title}</Text><View style={styles.notificationMeta}><Ionicons name="person-circle-outline" size={14} color={COLORS.muted} /><Text style={styles.notificationAuthor}>{item.authorName ?? item.author?.name ?? 'Elayone team'}</Text></View><Text style={styles.notificationMessage}>{item.message}</Text></View>)}</>}</View>;
}

function AdminForm({ title, icon, children }: { title: string; icon: IconName; children: React.ReactNode }) {
  return <View style={styles.adminForm}><View style={styles.adminFormHeader}><View style={styles.adminFormIcon}><Ionicons name={icon} size={18} color={COLORS.ink} /></View><Text style={styles.adminFormTitle}>{title}</Text></View>{children}</View>;
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    setBusy(true);
    try {
      const session = await signIn(email.trim(), password);
      onAuthenticated(session);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to connect right now.');
    } finally {
      setBusy(false);
    }
  }

  return <SafeAreaView style={styles.authSafeArea}>
    <StatusBar barStyle="dark-content" />
    <KeyboardAvoidingView style={styles.authShell} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
        <View style={styles.authCard}>
          <Image source={require('./elayone.jpg')} style={styles.authBrandMark} accessibilityLabel="Elayone Music logo" />
          <Text style={styles.authBrand}>ELAYONE MUSIC</Text>
          <Text style={styles.authBrandSub}>GOSPEL MUSIC MINISTRY</Text>
          <View style={styles.authRule} />
          <Text style={styles.authTitle}>Welcome back.</Text>
          <Text style={styles.authCaption}>Sign in to stay in rhythm with your ministry.</Text>
          <Field label="EMAIL ADDRESS" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="PASSWORD" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry />
          {error ? <Text style={styles.authError}>{error}</Text> : null}
          <TouchableOpacity style={styles.authButton} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color={COLORS.white} /> : <><Text style={styles.authButtonText}>Sign in</Text><Ionicons name="arrow-forward" size={17} color={COLORS.white} /></>}
          </TouchableOpacity>
          <Text style={styles.authAccountHelp}>Need an account or password reset? Please contact your choir administrator.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function Field({ label, value, onChangeText, placeholder, ...props }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string } & Omit<React.ComponentProps<typeof TextInput>, 'value' | 'onChangeText' | 'placeholder'>) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#8b8b88" selectionColor="#171717" style={[styles.fieldInput, props.multiline && styles.fieldInputMultiline]} /></View>;
}

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return <TouchableOpacity style={styles.quickAction} onPress={onPress}><View style={styles.quickIcon}><Ionicons name={icon} size={20} color={COLORS.ink} /></View><Text style={styles.quickLabel}>{label}</Text><Ionicons name="arrow-forward" size={15} color={COLORS.muted} /></TouchableOpacity>;
}

function TabView({ tab, rehearsals, selectedRehearsal, setSelectedRehearsal, peopleList, canManage, onOpenCalendar, onRemovePerson, songList }: { tab: Tab; rehearsals: Rehearsal[]; selectedRehearsal: string; setSelectedRehearsal: (value: string) => void; peopleList: typeof people; canManage: boolean; onOpenCalendar: () => void; onRemovePerson: (id: string) => void; songList: SongItem[] }) {
  const selected = rehearsals.find((rehearsal) => rehearsal.id === selectedRehearsal) ?? rehearsals[0] ?? null;
  return <><BaseTabView tab={tab} rehearsals={rehearsals} selectedRehearsal={selectedRehearsal} setSelectedRehearsal={setSelectedRehearsal} peopleList={peopleList} canManage={canManage} onOpenCalendar={onOpenCalendar} onRemovePerson={onRemovePerson} songList={songList} />{tab === 'Rehearsals' && <AttendanceRoster rehearsal={selected} />}{tab === 'People' && <><AvailabilitySummary />{canManage && <AdminMemberList peopleList={peopleList} onRemovePerson={onRemovePerson} />}</>}</>;
}

function AttendanceRoster({ rehearsal }: { rehearsal: Rehearsal | null }) {
  if (!rehearsal) {
    return <View style={styles.rosterSection}><Text style={styles.sectionTitle}>No rehearsal selected</Text></View>;
  }
  const yesCount = rehearsal.attendances?.filter((entry) => entry.status === 'YES').length ?? 0;
  const maybeCount = rehearsal.attendances?.filter((entry) => entry.status === 'MAYBE').length ?? 0;
  const noCount = rehearsal.attendances?.filter((entry) => entry.status === 'NO').length ?? 0;
  return <View style={styles.rosterSection}><View style={styles.rosterHeader}><View><Text style={styles.sectionTitle}>Who is coming?</Text><Text style={styles.sectionCaption}>{rehearsal.title}</Text></View><View style={styles.responseSummary}><Text style={styles.responseNumber}>{yesCount}</Text><Text style={styles.responseLabel}>YES</Text></View></View><View style={styles.responseBar}><View style={[styles.responseYes, { width: `${Math.max(8, (yesCount / Math.max(1, yesCount + maybeCount + noCount)) * 100)}%` }]} /><View style={[styles.responseMaybe, { width: `${Math.max(8, (maybeCount / Math.max(1, yesCount + maybeCount + noCount)) * 100)}%` }]} /><View style={[styles.responseNo, { width: `${Math.max(8, (noCount / Math.max(1, yesCount + maybeCount + noCount)) * 100)}%` }]} /></View><View style={styles.responseLegend}><Text style={styles.legendYes}>{yesCount} coming</Text><Text style={styles.legendMaybe}>{maybeCount} maybe</Text><Text style={styles.legendNo}>{noCount} away</Text></View>{attendanceRoster.map((person) => <View key={person.name} style={styles.rosterRow}><View style={[styles.rosterAvatar, { backgroundColor: person.tone }]}><Text style={styles.personInitials}>{person.name.split(' ').map((part) => part[0]).join('')}</Text></View><View style={styles.personInfo}><Text style={styles.personName}>{person.name}</Text><Text style={styles.personRole}>{person.part}</Text></View><Text style={[styles.rosterStatus, person.status === 'Coming' ? styles.statusComing : person.status === 'Maybe' ? styles.statusMaybe : styles.statusAway]}>{person.status}</Text></View>)}</View>;
}

function AvailabilitySummary() {
  return <View style={styles.availabilityCard}><View><Text style={styles.cardEyebrow}>AVAILABILITY</Text><Text style={styles.availabilityTitle}>For the next rehearsal</Text></View><View style={styles.availabilityStats}><View><Text style={[styles.availabilityNumber, { color: COLORS.olive }]}>18</Text><Text style={styles.availabilityLabel}>COMING</Text></View><View><Text style={[styles.availabilityNumber, { color: COLORS.clay }]}>3</Text><Text style={styles.availabilityLabel}>MAYBE</Text></View><View><Text style={[styles.availabilityNumber, { color: COLORS.muted }]}>3</Text><Text style={styles.availabilityLabel}>AWAY</Text></View></View></View>;
}

function AdminMemberList({ peopleList, onRemovePerson }: { peopleList: typeof people; onRemovePerson: (id: string) => void }) {
  async function removePerson(person: (typeof people)[number]) {
    Alert.alert('Remove member?', `${person.name} will lose access to this choir.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: async () => { try { await removeChoirMember('elayone-main-choir', person.id); onRemovePerson(person.id); } catch (error) { Alert.alert('Could not remove member', error instanceof Error ? error.message : 'Try again.'); } } }]);
  }

  return <View style={styles.adminMembers}><Text style={styles.adminMembersTitle}>MANAGE MEMBERS</Text>{peopleList.map((person) => <View key={person.id} style={styles.adminMemberRow}><View style={styles.personInfo}><Text style={styles.personName}>{person.name}</Text><Text style={styles.personRole}>{person.part} · {person.role}</Text></View><TouchableOpacity style={styles.removeIconButton} onPress={() => removePerson(person)} accessibilityLabel={`Remove ${person.name}`}><Ionicons name="person-remove-outline" size={17} color={COLORS.clay} /></TouchableOpacity></View>)}</View>;
}

function BaseTabView({ tab, rehearsals, selectedRehearsal, setSelectedRehearsal, peopleList, canManage, onOpenCalendar, onRemovePerson, songList }: { tab: Tab; rehearsals: Rehearsal[]; selectedRehearsal: string; setSelectedRehearsal: (value: string) => void; peopleList: typeof people; canManage: boolean; onOpenCalendar: () => void; onRemovePerson: (id: string) => void; songList: SongItem[] }) {
  const heading = tab === 'Rehearsals' ? 'Rehearsals' : tab === 'People' ? 'The choir' : 'Song library';
  const caption = tab === 'Rehearsals' ? 'A prepared choir is a present choir.' : tab === 'People' ? '24 voices, one offering.' : 'Songs we carry together.';
  const [activeSong, setActiveSong] = useState<string | null>(null);
  const [isSongPlaying, setIsSongPlaying] = useState(false);
  const [songQuery, setSongQuery] = useState('');
  const [attendanceChoice, setAttendanceChoice] = useState<Record<string, 'YES' | 'MAYBE' | 'NO'>>({});
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => undefined);
      }
    };
  }, []);

  async function toggleSong(song: SongItem) {
    if (!song.previewUrl) {
      Alert.alert('No preview available', 'This song does not have a preview link yet.');
      return;
    }

    try {
      if (activeSong === song.title && isSongPlaying && soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsSongPlaying(false);
        return;
      }

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync({ uri: song.previewUrl }, { shouldPlay: true, isLooping: false, volume: 1 });
      soundRef.current = sound;
      setActiveSong(song.title);
      setIsSongPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!('isLoaded' in status) || !status.isLoaded) return;
        if (status.didJustFinish) {
          setIsSongPlaying(false);
          setActiveSong(null);
        }
      });
    } catch {
      Alert.alert('Playback unavailable', 'This song preview could not be played right now.');
    }
  }

  const featuredSong = songList[0] ?? null;
  const filteredSongs = songList.filter((song) => {
    const q = songQuery.trim().toLowerCase();
    if (!q) return true;
    return `${song.title} ${song.key ?? ''} ${song.status}`.toLowerCase().includes(q);
  });

  return (
    <View>
      <Text style={styles.pageEyebrow}>ELAYONE / {tab.toUpperCase()}</Text>
      <Text style={styles.pageTitle}>{heading}</Text>
      <Text style={styles.pageCaption}>{caption}</Text>

      {tab === 'Rehearsals' && (
        <>
          <TouchableOpacity style={styles.addButton} onPress={onOpenCalendar}>
            <Ionicons name="add" size={19} color={COLORS.white} />
            <Text style={styles.addButtonText}>Add rehearsal</Text>
          </TouchableOpacity>
          <Text style={styles.listLabel}>{new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' }).toUpperCase()}</Text>
          {rehearsals.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={24} color={COLORS.muted} />
              <Text style={styles.emptyStateTitle}>No rehearsals yet</Text>
              <Text style={styles.emptyStateText}>Create the first rehearsal from the admin panel.</Text>
            </View>
          ) : rehearsals.map((item) => {
            const currentStatus = attendanceChoice[item.id];
            const schedule = formatRehearsalDate(item.startsAt);
            const endTime = new Date(item.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const yesCount = item.attendances?.filter((entry) => entry.status === 'YES').length ?? 0;
            return (
              <View key={item.id} style={[styles.rehearsalListItem, selectedRehearsal === item.id && styles.rehearsalListSelected]}>
                <TouchableOpacity style={styles.rehearsalMainTouch} onPress={() => setSelectedRehearsal(item.id)}>
                  <View style={[styles.dateBlock, { backgroundColor: item.color }]}>
                    <Text style={styles.dateDay}>{schedule.day}</Text>
                    <Text style={styles.dateNumber}>{schedule.dateNumber}</Text>
                    <Text style={styles.dateMonth}>{schedule.month}</Text>
                  </View>
                  <View style={styles.listMain}>
                    <Text style={styles.listTitle}>{item.title}</Text>
                    <Text style={styles.listMeta}>{schedule.start} - {endTime} · {item.location}</Text>
                    <Text style={styles.listAttendance}>{yesCount} attending</Text>
                  </View>
                  <Ionicons name={selectedRehearsal === item.id ? 'checkmark-circle' : 'chevron-forward'} size={20} color={selectedRehearsal === item.id ? COLORS.olive : COLORS.muted} />
                </TouchableOpacity>
                <View style={styles.attendanceRow}>
                  {(['YES', 'MAYBE', 'NO'] as const).map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[styles.attendancePill, currentStatus === status && styles.attendancePillActive]}
                      onPress={async () => {
                        setAttendanceChoice((current) => ({ ...current, [item.id]: status }));
                        try {
                          await updateAttendance('elayone-main-choir', item.id, status);
                        } catch (error) {
                          Alert.alert('Response not saved', error instanceof Error ? error.message : 'Please try again.');
                        }
                      }}
                    >
                      <Text style={[styles.attendancePillText, currentStatus === status && styles.attendancePillTextActive]}>
                        {status === 'YES' ? 'I will' : status === 'MAYBE' ? 'Maybe' : 'No'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}
        </>
      )}

      {tab === 'People' && (
        <>
          <View style={styles.peopleSummary}>
            <Text style={styles.peopleNumber}>24</Text>
            <View>
              <Text style={styles.peopleTitle}>Active singers</Text>
              <Text style={styles.peopleCaption}>4 section leaders · 3 vocal sections</Text>
            </View>
          </View>
          {people.map((person) => (
            <View key={person.name} style={styles.personRow}>
              <View style={[styles.personAvatar, { backgroundColor: person.tone }]}>
                <Text style={styles.personInitials}>{person.initials}</Text>
              </View>
              <View style={styles.personInfo}>
                <Text style={styles.personName}>{person.name}</Text>
                <Text style={styles.personRole}>{person.role}</Text>
              </View>
              <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.muted} />
            </View>
          ))}
        </>
      )}

      {tab === 'Songs' && (
        <>
          <View style={styles.songSearchWrap}>
            <Ionicons name="search-outline" size={18} color={COLORS.muted} />
            <TextInput value={songQuery} onChangeText={setSongQuery} placeholder="Search songs, key, or status" placeholderTextColor={COLORS.muted} style={styles.songSearchInput} />
          </View>
          {featuredSong && (
            <View style={styles.songFeatured}>
              <View style={styles.songIconLarge}>
                <Ionicons name="musical-notes" size={25} color={COLORS.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.songFeatureLabel}>CURRENTLY LEARNING</Text>
                <Text style={styles.songFeatureTitle}>{featuredSong.title}</Text>
                <Text style={styles.songFeatureMeta}>{featuredSong.key ?? 'Key not set'} · {featuredSong.status}</Text>
              </View>
              <TouchableOpacity onPress={() => toggleSong(featuredSong)} accessibilityLabel="Play featured song">
                <Ionicons name={activeSong === featuredSong.title && isSongPlaying ? 'pause-circle-outline' : 'play-circle-outline'} size={29} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          )}
          {filteredSongs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="musical-notes-outline" size={24} color={COLORS.muted} />
              <Text style={styles.emptyStateTitle}>No songs found</Text>
              <Text style={styles.emptyStateText}>Try a different title, key, or status.</Text>
            </View>
          ) : filteredSongs.map((song) => (
            <View key={song.title + (song.id ?? '')} style={styles.songRow}>
              <View style={styles.songRowMain}>
                <View style={styles.songIcon}>
                  <Ionicons name={song.icon ?? 'musical-notes-outline'} size={18} color={COLORS.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.songTitle}>{song.title}</Text>
                  <Text style={styles.songMeta}>{song.key ?? 'No key'} · {song.status}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => toggleSong(song)} accessibilityLabel={`Play ${song.title}`}>
                <Ionicons name={activeSong === song.title && isSongPlaying ? 'pause-circle-outline' : 'play-circle-outline'} size={26} color={COLORS.ink} />
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const COLORS = { ink: '#171717', muted: '#797975', line: '#e5e3de', paper: '#f7f7f5', white: '#ffffff', olive: '#708067', clay: '#a76e5b' };

const styles = StyleSheet.create({
  reportHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reportRefresh: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  reportNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, backgroundColor: '#eef2ec', borderRadius: 4, marginBottom: 14 },
  reportNoticeText: { flex: 1, color: '#53614d', fontSize: 10, lineHeight: 15 },
  reportMetricGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  reportMetric: { flex: 1, minHeight: 75, justifyContent: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 11 },
  reportMetricValue: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 25 },
  reportMetricLabel: { color: COLORS.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.7, marginTop: 5 },
  reportCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, padding: 15, marginBottom: 24 },
  reportCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  reportCardTitle: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 18 },
  reportCardCaption: { color: COLORS.muted, fontSize: 10, marginTop: 4 },
  reportRate: { color: COLORS.olive, fontFamily: 'Georgia', fontSize: 24 },
  reportBar: { height: 10, flexDirection: 'row', backgroundColor: '#efefeb', overflow: 'hidden', borderRadius: 5 },
  reportLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 13 },
  reportLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reportLegendDot: { width: 7, height: 7, borderRadius: 4 },
  reportLegendText: { color: COLORS.muted, fontSize: 9 },
  reportSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3, marginBottom: 10 },
  reportSectionTitle: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 21 },
  reportSectionMeta: { color: COLORS.muted, fontSize: 10, fontWeight: '700' },
  reportSearchWrap: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, paddingHorizontal: 11, marginBottom: 9 },
  reportSearchInput: { flex: 1, color: COLORS.ink, fontSize: 11, paddingVertical: 9 },
  reportFilterRow: { flexDirection: 'row', gap: 7, marginBottom: 11 },
  reportFilterChip: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: COLORS.white },
  reportFilterChipActive: { borderColor: COLORS.ink, backgroundColor: COLORS.ink },
  reportFilterText: { color: COLORS.muted, fontSize: 9, fontWeight: '700' },
  reportFilterTextActive: { color: COLORS.white },
  reportEventCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, padding: 13, marginBottom: 9 },
  reportEventTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
  reportEventTitle: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 15 },
  reportEventMeta: { color: COLORS.muted, fontSize: 9, lineHeight: 14, marginTop: 4 },
  reportEventType: { color: COLORS.olive, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  reportEventCounts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 5, marginTop: 9 },
  reportAvailableText: { color: COLORS.olive, fontSize: 8, fontWeight: '800' },
  reportMaybeText: { color: '#9c7c43', fontSize: 8, fontWeight: '800' },
  reportUnavailableText: { color: COLORS.clay, fontSize: 8, fontWeight: '800' },
  reportPendingText: { color: COLORS.muted, fontSize: 8, fontWeight: '800' },
  reportMemberCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 8 },
  reportMemberTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reportMemberAvatar: { width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8e3d9' },
  reportMemberInitial: { color: COLORS.ink, fontSize: 13, fontWeight: '800' },
  reportMemberName: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 15 },
  reportMemberMeta: { color: COLORS.muted, fontSize: 9, marginTop: 3 },
  reportMiniCounts: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 5, borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 9, marginTop: 10 },
  reportHistory: { marginTop: 5 },
  reportHistoryHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 3, borderTopWidth: 1, borderTopColor: COLORS.line },
  reportHistoryTitle: { color: COLORS.ink, fontSize: 10, fontWeight: '800' },
  reportHistoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.line, paddingVertical: 12 },
  reportPill: { borderRadius: 11, paddingHorizontal: 8, paddingVertical: 5 },
  reportPillYes: { backgroundColor: '#edf2ec' },
  reportPillMaybe: { backgroundColor: '#f5f0e6' },
  reportPillNo: { backgroundColor: '#f8eeeb' },
  reportPillPending: { backgroundColor: '#efefec' },
  reportPillText: { color: COLORS.ink, fontSize: 8, fontWeight: '800' },
  reportGenerated: { color: COLORS.muted, fontSize: 9, textAlign: 'center', marginTop: 15, marginBottom: 12 },
  reportLoading: { minHeight: 110, alignItems: 'center', justifyContent: 'center', gap: 9 },
  reportHint: { color: COLORS.muted, fontSize: 10, lineHeight: 16 },
  reportError: { backgroundColor: '#fdf1ef', borderWidth: 1, borderColor: '#e9c8c2', borderRadius: 4, padding: 14, marginBottom: 12 },
  reportErrorText: { color: '#7c2f2f', fontSize: 11, lineHeight: 17 },
  reportRetry: { color: COLORS.ink, fontSize: 11, fontWeight: '800', marginTop: 9 },
  reportEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, padding: 22, marginBottom: 12 },
  reportEmptyText: { color: COLORS.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 9 },
  inviteePicker: { backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 13 },
  inviteePickerCaption: { color: COLORS.muted, fontSize: 9, lineHeight: 14, marginBottom: 6 },
  inviteeRow: { flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderTopColor: COLORS.line, paddingVertical: 9 },
  inviteeName: { color: COLORS.ink, fontSize: 11, fontWeight: '700' },
  inviteeMeta: { color: COLORS.muted, fontSize: 9, marginTop: 3 },
  calendarResponseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  calendarResponseHeaderText: { flex: 1, color: COLORS.muted, fontSize: 9, lineHeight: 14 },
  calendarRefreshButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  calendarCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 5, padding: 14, marginBottom: 24 },
  calendarCreateForm: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 5, padding: 14, marginBottom: 16 },
  calendarCreateTitle: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 18, marginBottom: 4 },
  calendarCreateCaption: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginBottom: 16 },
  calendarMonthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calendarArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.paper, alignItems: 'center', justifyContent: 'center' },
  calendarMonthTitle: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 19 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarWeekday: { width: `${100 / 7}%`, textAlign: 'center', color: COLORS.muted, fontSize: 9, fontWeight: '800', paddingVertical: 8 },
  calendarDayCell: { width: `${100 / 7}%`, height: 41, alignItems: 'center', justifyContent: 'center', position: 'relative', borderRadius: 20 },
  calendarDaySelected: { backgroundColor: COLORS.ink },
  calendarDayText: { color: COLORS.ink, fontSize: 11, fontWeight: '600' },
  calendarDayTextSelected: { color: COLORS.white },
  calendarDayToday: { color: COLORS.clay, fontWeight: '900' },
  calendarEventDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.olive, marginTop: 2 },
  calendarEventDotSelected: { backgroundColor: COLORS.white },
  calendarKey: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 10, marginTop: 7 },
  calendarKeyText: { color: COLORS.muted, fontSize: 9 },
  calendarListHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 2 },
  calendarEventCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, padding: 12, marginBottom: 9 },
  calendarEventCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  calendarDateBadge: { width: 45, height: 54, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  calendarDateDay: { color: COLORS.white, fontSize: 7, fontWeight: '800' },
  calendarDateNumber: { color: COLORS.white, fontFamily: 'Georgia', fontSize: 21, lineHeight: 22 },
  calendarDateMonth: { color: COLORS.white, fontSize: 7, fontWeight: '800' },
  calendarEventTitle: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 15 },
  calendarEventMeta: { color: COLORS.muted, fontSize: 9, lineHeight: 14, marginTop: 3 },
  calendarEventType: { color: COLORS.olive, fontSize: 8, fontWeight: '800', letterSpacing: 0.4, marginTop: 4 },
  calendarPrompt: { color: COLORS.muted, fontSize: 10, marginTop: 12 },
  calendarResponseButtons: { flexDirection: 'row', gap: 7, marginTop: 8 },
  calendarResponseButton: { flex: 1, minHeight: 34, borderWidth: 1, borderColor: COLORS.line, borderRadius: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paper },
  calendarResponseButtonActive: { backgroundColor: '#edf2ec', borderColor: COLORS.olive },
  calendarResponseText: { color: COLORS.muted, fontSize: 10, fontWeight: '800' },
  calendarResponseTextActive: { color: COLORS.ink },
  calendarAdminSummary: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 10, marginTop: 10 },
  calendarAdminSummaryText: { color: COLORS.muted, fontSize: 9, fontWeight: '700' },
  calendarInviteeList: { marginTop: 4 },
  calendarInviteeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.line, paddingVertical: 8 },
  calendarInviteeName: { color: COLORS.ink, fontSize: 10, fontWeight: '700' },
  calendarInviteeStatus: { fontSize: 8, fontWeight: '800' },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paper },
  authSafeArea: { flex: 1, backgroundColor: '#f4efe8' },
  authShell: { flex: 1, justifyContent: 'center' },
  authContent: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 34, paddingBottom: 40, justifyContent: 'center' },
  authCard: { backgroundColor: COLORS.white, borderRadius: 22, paddingHorizontal: 22, paddingTop: 28, paddingBottom: 24, borderWidth: 1, borderColor: '#efeae2', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 5 },
  authBrandMark: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#f2efe9', alignSelf: 'center' },
  authBrand: { color: COLORS.ink, fontSize: 15, fontWeight: '800', letterSpacing: 2.8, marginTop: 14, textAlign: 'center' },
  authBrandSub: { color: COLORS.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1.8, marginTop: 4, textAlign: 'center' },
  authRule: { height: 1, backgroundColor: '#eae5df', marginTop: 30, marginBottom: 26 },
  authTitle: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 39, lineHeight: 45 },
  authCaption: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 26 },
  field: { marginBottom: 18 },
  fieldLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.3, marginBottom: 8 },
  fieldInput: { height: 52, borderWidth: 1, borderColor: '#d9d5cf', borderRadius: 12, color: COLORS.ink, backgroundColor: '#faf8f4', fontSize: 14, paddingHorizontal: 14, paddingVertical: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 2, elevation: 1 },
  fieldInputMultiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: 14 },
  authError: { color: '#a14a3b', fontSize: 12, marginTop: -4, marginBottom: 16, lineHeight: 18 },
  authButton: { backgroundColor: COLORS.ink, minHeight: 52, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 8 },
  authButtonText: { color: COLORS.white, fontSize: 13, fontWeight: '800' },
  authSwitch: { alignItems: 'center', marginTop: 22 },
  authSwitchText: { color: COLORS.muted, fontSize: 12 },
  authSwitchStrong: { color: COLORS.ink, fontWeight: '800' },
  authAccountHelp: { color: COLORS.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 18 },
  adminNotice: { backgroundColor: '#eef2ec', borderRadius: 4, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 17 },
  adminNoticeTitle: { color: COLORS.ink, fontSize: 12, fontWeight: '800' },
  adminNoticeText: { color: COLORS.muted, fontSize: 10, marginTop: 3 },
  noticeBanner: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14, borderWidth: 1 },
  noticeSuccess: { backgroundColor: '#edf5ee', borderColor: '#bfd8c2' },
  noticeError: { backgroundColor: '#fdf1ef', borderColor: '#e9c8c2' },
  noticeText: { fontSize: 12, fontWeight: '700', lineHeight: 18 },
  noticeTextSuccess: { color: '#1f4d2f' },
  noticeTextError: { color: '#7c2f2f' },
  adminForm: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, padding: 15, marginBottom: 12 },
  adminFormHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  adminFormIcon: { width: 32, height: 32, backgroundColor: COLORS.paper, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  adminFormTitle: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 18 },
  directoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  roleActions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, flexWrap: 'wrap', justifyContent: 'flex-end' },
  smallActionButton: { backgroundColor: '#edf2ec', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6 },
  smallActionText: { color: COLORS.ink, fontSize: 9, fontWeight: '800' },
  smallSecondaryActionButton: { backgroundColor: '#f5f1ee', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6 },
  smallSecondaryActionText: { color: COLORS.muted, fontSize: 9, fontWeight: '800' },
  adminAnnouncementRow: { borderTopWidth: 1, borderTopColor: COLORS.line, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  adminAnnouncementTitle: { color: COLORS.ink, fontSize: 12, fontWeight: '800' },
  adminAnnouncementMeta: { color: COLORS.muted, fontSize: 10, marginTop: 4 },
  directoryCount: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 27, marginRight: 6 },
  directoryLabel: { color: COLORS.muted, fontSize: 11, flex: 1 },
  directoryRow: { borderTopWidth: 1, borderTopColor: COLORS.line, paddingVertical: 11, flexDirection: 'row', alignItems: 'center' },
  directoryAvatar: { width: 35, height: 35, borderRadius: 18, backgroundColor: '#d7c5af', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  directoryInitial: { color: COLORS.ink, fontWeight: '800', fontSize: 13 },
  directoryMeta: { color: COLORS.olive, fontSize: 9, fontWeight: '700', marginTop: 4 },
  adminButton: { backgroundColor: COLORS.ink, minHeight: 43, borderRadius: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  adminButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
  inlineFieldRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  segmentedButton: { flex: 1, borderWidth: 1, borderColor: COLORS.line, borderRadius: 3, minHeight: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paper },
  segmentedButtonActive: { borderColor: COLORS.ink, backgroundColor: '#eef2ec' },
  segmentedButtonText: { color: COLORS.muted, fontSize: 11, fontWeight: '800' },
  segmentedButtonTextActive: { color: COLORS.ink },
  adminHelp: { color: COLORS.muted, fontSize: 11, lineHeight: 17, marginBottom: 13 },
  removeButton: { borderWidth: 1, borderColor: '#e4c9c1', minHeight: 43, borderRadius: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  removeButtonText: { color: COLORS.clay, fontSize: 12, fontWeight: '800' },
  adminMembers: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, padding: 15, marginBottom: 20 },
  adminMembersTitle: { color: COLORS.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  adminMemberRow: { borderTopWidth: 1, borderTopColor: COLORS.line, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' },
  removeIconButton: { width: 35, height: 35, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8eeeb', borderRadius: 3 },
  rosterSection: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, padding: 15, marginTop: 12, marginBottom: 15 },
  rosterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  responseSummary: { alignItems: 'flex-end' },
  responseNumber: { color: COLORS.olive, fontFamily: 'Georgia', fontSize: 26 },
  responseLabel: { color: COLORS.olive, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  responseBar: { height: 7, flexDirection: 'row', marginTop: 16, borderRadius: 4, overflow: 'hidden' },
  responseYes: { flex: 6, backgroundColor: COLORS.olive },
  responseMaybe: { flex: 1, backgroundColor: '#c9b99a' },
  responseNo: { flex: 1, backgroundColor: COLORS.clay },
  responseLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7, marginBottom: 7 },
  legendYes: { color: COLORS.olive, fontSize: 9, fontWeight: '700' },
  legendMaybe: { color: '#9c8662', fontSize: 9, fontWeight: '700' },
  legendNo: { color: COLORS.clay, fontSize: 9, fontWeight: '700' },
  rosterRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.line, paddingVertical: 10 },
  rosterAvatar: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  rosterStatus: { fontSize: 10, fontWeight: '800' },
  statusComing: { color: COLORS.olive },
  statusMaybe: { color: '#9c8662' },
  statusAway: { color: COLORS.clay },
  availabilityCard: { backgroundColor: COLORS.ink, borderRadius: 4, padding: 17, marginTop: 18, marginBottom: 18 },
  availabilityTitle: { color: COLORS.white, fontFamily: 'Georgia', fontSize: 18, marginTop: 6 },
  availabilityStats: { flexDirection: 'row', gap: 30, marginTop: 19, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#3b3b39' },
  availabilityNumber: { fontFamily: 'Georgia', fontSize: 27 },
  availabilityLabel: { color: '#aaa9a3', fontSize: 8, fontWeight: '800', letterSpacing: 1, marginTop: 3 },
  safeArea: { flex: 1, backgroundColor: COLORS.paper },
  appShell: { flex: 1, backgroundColor: COLORS.paper },
  scrollContent: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 100 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 34 },
  brandMark: { width: 37, height: 37, borderRadius: 19, overflow: 'hidden', backgroundColor: COLORS.ink, alignItems: 'center', justifyContent: 'center' },
  brandLogo: { width: 37, height: 37, borderRadius: 19 },
  brandMarkText: { color: COLORS.white, fontFamily: 'Georgia', fontSize: 22, fontWeight: '700', fontStyle: 'italic' },
  brandCopy: { marginLeft: 10, flex: 1 }, brandName: { color: COLORS.ink, fontSize: 13, fontWeight: '800', letterSpacing: 1.8 }, brandSub: { color: COLORS.muted, fontSize: 8, fontWeight: '700', letterSpacing: 1.25, marginTop: 3 },
  notificationButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  signOutButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  notificationDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.clay, right: 8, top: 6, borderWidth: 2, borderColor: COLORS.white },
  newsInput: { minHeight: 96, borderWidth: 1, borderColor: '#d9d5cf', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, textAlignVertical: 'top', color: COLORS.ink, backgroundColor: '#faf8f4', fontSize: 13, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 2, elevation: 1 },
  priorityRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  priorityOption: { flex: 1, borderWidth: 1, borderColor: '#d9d5cf', borderRadius: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#faf8f4' },
  priorityOptionActive: { borderColor: COLORS.ink, backgroundColor: '#eef2ec' },
  priorityOptionActiveImportant: { borderColor: COLORS.clay, backgroundColor: '#f8efee' },
  priorityText: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  priorityTextActive: { color: COLORS.ink },
  priorityTextActiveImportant: { color: COLORS.clay },
  hero: { marginBottom: 25 }, eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: COLORS.muted, marginBottom: 13 }, heroTitle: { fontFamily: 'Georgia', fontSize: 43, lineHeight: 47, color: COLORS.ink, letterSpacing: -1 }, heroBody: { fontSize: 14, color: COLORS.muted, marginTop: 13, lineHeight: 21 },
  notificationsPanel: { paddingTop: 10 },
  notificationsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  closeButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f0efe9', alignItems: 'center', justifyContent: 'center' },
  emptyState: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, padding: 22, alignItems: 'center' },
  emptyStateTitle: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 18, marginTop: 12, marginBottom: 6 },
  emptyStateText: { color: COLORS.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  songSearchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#faf8f4', borderWidth: 1, borderColor: '#d9d5cf', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 2, elevation: 1 },
  songSearchInput: { flex: 1, color: COLORS.ink, fontSize: 13, paddingLeft: 10, paddingVertical: 8 },
  rehearsalMainTouch: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  attendanceRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
  attendancePill: { flex: 1, borderWidth: 1, borderColor: COLORS.line, borderRadius: 3, backgroundColor: COLORS.paper, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  attendancePillActive: { borderColor: COLORS.olive, backgroundColor: '#edf2ec' },
  attendancePillText: { color: COLORS.muted, fontSize: 10, fontWeight: '800' },
  attendancePillTextActive: { color: COLORS.ink },
  notificationCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, padding: 15, marginBottom: 12 },
  notificationTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  notificationLabel: { color: COLORS.olive, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  notificationTime: { color: COLORS.muted, fontSize: 10 },
  notificationMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  notificationAuthor: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  notificationTitle: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 18, marginBottom: 6 },
  notificationMessage: { color: COLORS.muted, fontSize: 12, lineHeight: 19 },
  nextRehearsalCard: { backgroundColor: COLORS.white, borderRadius: 5, padding: 20, borderWidth: 1, borderColor: '#eeece7', marginBottom: 29 }, cardTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, cardEyebrow: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.25 }, livePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eef2ec', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 3 }, liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.olive, marginRight: 5 }, liveText: { color: COLORS.olive, fontSize: 8, fontWeight: '800', letterSpacing: 0.6 }, rehearsalTitle: { fontFamily: 'Georgia', fontSize: 24, color: COLORS.ink, marginTop: 19 }, detailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 }, detailText: { color: COLORS.muted, fontSize: 12, marginLeft: 5 }, detailIcon: { marginLeft: 14 }, cardFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.line, marginTop: 19, paddingTop: 15 }, avatarStack: { flexDirection: 'row', width: 62 }, avatar: { width: 25, height: 25, borderRadius: 13, borderWidth: 1.5, borderColor: COLORS.white, justifyContent: 'center', alignItems: 'center' }, avatarText: { fontSize: 9, fontWeight: '800', color: COLORS.ink }, attendanceText: { color: COLORS.muted, fontSize: 11, flex: 1 }, checkInButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.ink, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 3, gap: 7 }, checkInText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }, sectionTitle: { fontFamily: 'Georgia', color: COLORS.ink, fontSize: 21 }, sectionCaption: { fontSize: 11, color: COLORS.muted, marginTop: 4 }, seeAll: { color: COLORS.ink, fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' }, weekGrid: { flexDirection: 'row', gap: 8, marginBottom: 31 }, weekMetric: { flex: 1, backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#eeece7', padding: 13, borderRadius: 4 }, metricNumber: { fontFamily: 'Georgia', fontSize: 30, color: COLORS.ink }, metricPercent: { fontFamily: 'Georgia', fontSize: 17 }, metricLabel: { color: COLORS.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.8, marginTop: 7 }, metricRule: { height: 3, backgroundColor: COLORS.ink, width: 26, marginTop: 12, marginBottom: 8 }, metricFoot: { color: COLORS.muted, fontSize: 9 }, quickGrid: { gap: 8 }, quickAction: { backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, minHeight: 55, borderRadius: 4, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11 }, quickIcon: { width: 33, height: 33, backgroundColor: COLORS.paper, alignItems: 'center', justifyContent: 'center', marginRight: 11 }, quickLabel: { color: COLORS.ink, fontWeight: '700', fontSize: 13, flex: 1 },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 82, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.line, flexDirection: 'row', justifyContent: 'space-around', paddingTop: 10 }, navItem: { alignItems: 'center', flex: 1 }, navIconWrap: { width: 31, height: 27, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }, navIconActive: { backgroundColor: COLORS.ink }, navLabel: { color: COLORS.muted, fontSize: 10, marginTop: 6 }, navLabelActive: { color: COLORS.ink, fontWeight: '800' },
  pageEyebrow: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 }, pageTitle: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 38 }, pageCaption: { color: COLORS.muted, fontSize: 14, marginTop: 8, marginBottom: 24 }, addButton: { backgroundColor: COLORS.ink, paddingVertical: 12, paddingHorizontal: 15, borderRadius: 3, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7, marginBottom: 28 }, addButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '800' }, listLabel: { color: COLORS.muted, fontSize: 10, letterSpacing: 1.4, fontWeight: '800', marginBottom: 10 }, rehearsalListItem: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, padding: 10, borderRadius: 4, flexDirection: 'row', alignItems: 'center', marginBottom: 9 }, rehearsalListSelected: { borderColor: COLORS.olive, borderWidth: 1.5 }, dateBlock: { width: 48, height: 61, alignItems: 'center', justifyContent: 'center', borderRadius: 3, marginRight: 12 }, dateDay: { color: COLORS.white, fontSize: 8, fontWeight: '800', letterSpacing: 0.6 }, dateNumber: { color: COLORS.white, fontFamily: 'Georgia', fontSize: 24, lineHeight: 25 }, dateMonth: { color: COLORS.white, fontSize: 8, fontWeight: '800' }, listMain: { flex: 1 }, listTitle: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 16 }, listMeta: { color: COLORS.muted, fontSize: 10, marginTop: 5 }, listAttendance: { color: COLORS.olive, fontSize: 10, fontWeight: '700', marginTop: 6 }, peopleSummary: { backgroundColor: COLORS.ink, borderRadius: 4, padding: 19, flexDirection: 'row', alignItems: 'center', marginBottom: 22 }, peopleNumber: { color: COLORS.white, fontFamily: 'Georgia', fontSize: 45, marginRight: 16 }, peopleTitle: { color: COLORS.white, fontSize: 15, fontWeight: '800' }, peopleCaption: { color: '#aaa9a3', fontSize: 11, marginTop: 5 }, personRow: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.line, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }, personAvatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginRight: 12 }, personInitials: { color: COLORS.ink, fontSize: 12, fontWeight: '800' }, personInfo: { flex: 1 }, personName: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 16 }, personRole: { color: COLORS.muted, fontSize: 11, marginTop: 4 }, songFeatured: { backgroundColor: COLORS.ink, borderRadius: 4, padding: 17, flexDirection: 'row', alignItems: 'center', marginBottom: 21 }, songIconLarge: { width: 45, height: 45, backgroundColor: COLORS.clay, alignItems: 'center', justifyContent: 'center', borderRadius: 3, marginRight: 13 }, songFeatureLabel: { color: '#b7b5ad', fontSize: 8, fontWeight: '800', letterSpacing: 1.2 }, songFeatureTitle: { color: COLORS.white, fontFamily: 'Georgia', fontSize: 20, marginTop: 6 }, songFeatureMeta: { color: '#b7b5ad', fontSize: 10, marginTop: 5 }, songRow: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 9 }, songRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center' }, songIcon: { width: 36, height: 36, backgroundColor: COLORS.paper, alignItems: 'center', justifyContent: 'center', marginRight: 11 }, songInfo: { flex: 1 }, songTitle: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 15 }, songMeta: { color: COLORS.muted, fontSize: 10, marginTop: 4 }, songStatus: { backgroundColor: '#f4e7e2', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 3 }, readyStatus: { backgroundColor: '#eef2ec' }, songStatusText: { color: COLORS.clay, fontSize: 9, fontWeight: '800' }, readyStatusText: { color: COLORS.olive }, songPlayButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.paper, alignItems: 'center', justifyContent: 'center', marginLeft: 10 }, 
});
