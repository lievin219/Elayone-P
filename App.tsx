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
import { AttendanceSummary, createRehearsal, createSong, deleteAnnouncement, DirectoryUser, getAllUsers, getAttendanceSummary, getRehearsals, getSongs, getStoredSession, publishAnnouncement, removeChoirMember, RehearsalRecord, Session, signIn, signOut, signUp, updateAttendance, updateUserRole } from './src/api';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Tab = 'Home' | 'Rehearsals' | 'People' | 'Songs' | 'Admin';

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
  const liveEventLabel = activeRehearsal ? 'ACTIVE SERVICE' : 'NEXT REHEARSAL';
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
      setHasNewAnnouncements(false);
      setShowNotifications(false);
      return;
    }

    Promise.all([
      getAttendanceSummary('elayone-main-choir'),
      getRehearsals('elayone-main-choir'),
      import('./src/api').then(({ getAnnouncements, getSongs }) => Promise.all([
        getAnnouncements('elayone-main-choir'),
        getSongs('elayone-main-choir')
      ]))
    ])
      .then(([summary, nextRehearsals, [nextAnnouncements, nextSongs]]) => {
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
        setHasNewAnnouncements(normalizedAnnouncements.length > 0);
        setSongs(nextSongs.length > 0 ? nextSongs.map((song) => ({ ...song, icon: song.status === 'LEARN' ? 'book-outline' : 'musical-notes-outline' })) : seedSongs);
      })
      .catch(() => {
        setAttendanceSummary({ total: 0, confirmed: 0, rate: 0, upcoming: 0 });
        setRehearsals([]);
        setAnnouncements([]);
        setSongs(seedSongs);
      });
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
            <NotificationsPanel announcements={announcements} onClose={() => setShowNotifications(false)} />
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
                <TouchableOpacity onPress={() => setActiveTab('Rehearsals')}><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
              </View>
              <View style={styles.weekGrid}>
                <View style={styles.weekMetric}><Text style={styles.metricNumber}>{String(upcomingRehearsalCount).padStart(2, '0')}</Text><Text style={styles.metricLabel}>REHEARSALS</Text><View style={styles.metricRule} /><Text style={styles.metricFoot}>upcoming</Text></View>
                <View style={styles.weekMetric}><Text style={styles.metricNumber}>{attendanceSummary.rate}<Text style={styles.metricPercent}>%</Text></Text><Text style={styles.metricLabel}>ATTENDANCE</Text><View style={[styles.metricRule, { backgroundColor: COLORS.olive }]} /><Text style={styles.metricFoot}>{attendanceSummary.total} responses</Text></View>
                <View style={styles.weekMetric}><Text style={styles.metricNumber}>{String(songs.length).padStart(2, '0')}</Text><Text style={styles.metricLabel}>SONGS</Text><View style={[styles.metricRule, { backgroundColor: COLORS.clay }]} /><Text style={styles.metricFoot}>in the library</Text></View>
              </View>

              <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Quick access</Text><Text style={styles.sectionCaption}>What do you need today?</Text></View></View>
              <View style={styles.quickGrid}>
                <QuickAction icon="calendar-outline" label="Plan rehearsal" onPress={() => setActiveTab('Rehearsals')} />
                <QuickAction icon="people-outline" label="View choir" onPress={() => setActiveTab('People')} />
                <QuickAction icon="musical-notes-outline" label="Song library" onPress={() => setActiveTab('Songs')} />
                <QuickAction icon="chatbubble-ellipses-outline" label="Send update" onPress={() => setCheckedIn(true)} />
              </View>
            </>
          ) : activeTab === 'Admin' ? <AdminPanel announcements={announcements} onAnnouncementPublished={(nextAnnouncement) => { setAnnouncements((current) => [{ ...nextAnnouncement, authorName: nextAnnouncement.authorName ?? session?.user.name ?? 'Admin' }, ...current]); setHasNewAnnouncements(true); }} onAnnouncementDeleted={(id) => { setAnnouncements((current) => {
            const next = current.filter((announcement) => announcement.id !== id);
            setHasNewAnnouncements(next.length > 0);
            return next;
          }); }} onSongAdded={(nextSong) => setSongs((current) => [nextSong, ...current])} onRehearsalAdded={(nextRehearsal) => { setRehearsals((current) => [nextRehearsal, ...current]); setSelectedRehearsal(nextRehearsal.id); }} /> : (
            <TabView tab={activeTab} rehearsals={rehearsals} selectedRehearsal={selectedRehearsal} setSelectedRehearsal={setSelectedRehearsal} peopleList={visiblePeople} canManage={isAdmin} onRemovePerson={(id) => setVisiblePeople((current) => current.filter((person) => person.id !== id))} songList={songs} />
          )}
        </ScrollView>
        <View style={styles.bottomNav}>
          {(['Home', 'Rehearsals', 'People', 'Songs', ...(isAdmin ? ['Admin' as Tab] : [])] as Tab[]).map((tab) => {
            const icon: IconName = tab === 'Home' ? 'home-outline' : tab === 'Rehearsals' ? 'calendar-outline' : tab === 'People' ? 'people-outline' : tab === 'Songs' ? 'musical-notes-outline' : 'shield-checkmark-outline';
            const active = activeTab === tab;
            return <TouchableOpacity key={tab} style={styles.navItem} onPress={() => setActiveTab(tab)}><View style={[styles.navIconWrap, active && styles.navIconActive]}><Ionicons name={icon} size={21} color={active ? COLORS.white : COLORS.muted} /></View><Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab}</Text></TouchableOpacity>;
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

function AdminPanel({ announcements, onAnnouncementPublished, onAnnouncementDeleted, onSongAdded, onRehearsalAdded }: { announcements: AnnouncementItem[]; onAnnouncementPublished: (announcement: AnnouncementItem) => void; onAnnouncementDeleted: (id: string) => void; onSongAdded: (song: SongItem) => void; onRehearsalAdded: (rehearsal: Rehearsal) => void }) {
  const [eventTitle, setEventTitle] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventStartTime, setEventStartTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
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

  React.useEffect(() => {
    getAllUsers().then(setUsers).catch(() => undefined).finally(() => setUsersLoading(false));
  }, []);

  async function addEvent() {
    if (!eventTitle || !eventLocation || !eventDate || !eventStartTime || !eventEndTime) {
      return Alert.alert('Missing rehearsal details', 'Add the title, date, start time, end time, and location before saving.');
    }
    const startsAt = new Date(`${eventDate}T${eventStartTime}:00`).toISOString();
    const endsAt = new Date(`${eventDate}T${eventEndTime}:00`).toISOString();
    if (Number.isNaN(new Date(startsAt).getTime()) || Number.isNaN(new Date(endsAt).getTime())) {
      return Alert.alert('Invalid schedule', 'Use a valid date and time format for the rehearsal.');
    }
    setBusy(true);
    try {
      const created = (await createRehearsal(choirId, { title: eventTitle.trim(), location: eventLocation.trim(), startsAt, endsAt })) as Rehearsal;
      onRehearsalAdded(created);
      setEventTitle('');
      setEventLocation('');
      setEventDate('');
      setEventStartTime('');
      setEventEndTime('');
      setNotice({ type: 'success', text: 'Rehearsal added successfully and is now visible to the choir.' });
      Alert.alert('Event added', 'The choir can now see this rehearsal.');
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Unable to add the rehearsal right now.' });
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
    if (!songTitle.trim()) return Alert.alert('Missing song title', 'Add a song title before saving it.');
    setBusy(true);
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
      Alert.alert('Song added', 'The song is now available in the library.');
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Could not save the song right now.' });
      Alert.alert('Could not save song', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId: string, nextRole: 'MEMBER' | 'LEADER' | 'ADMIN') {
    try {
      const updated = await updateUserRole(userId, nextRole);
      setUsers((current) => current.map((user) => user.id === userId ? { ...user, role: updated.role } : user));
      setNotice({ type: 'success', text: `${updated.name} is now a ${updated.role}.` });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Could not update this role right now.' });
    }
  }

  async function removeMember(userId: string) {
    try {
      await removeChoirMember(choirId, userId);
      setUsers((current) => current.filter((user) => user.id !== userId));
      setNotice({ type: 'success', text: 'Member removed from this choir.' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Could not remove this member.' });
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
          <TouchableOpacity onPress={() => { setUsersLoading(true); getAllUsers().then(setUsers).finally(() => setUsersLoading(false)); }}>
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

function NotificationsPanel({ announcements, onClose }: { announcements: AnnouncementItem[]; onClose: () => void }) {
  return <View style={styles.notificationsPanel}><View style={styles.notificationsHeader}><View><Text style={styles.pageEyebrow}>ELAYONE / ALERTS</Text><Text style={styles.pageTitle}>Notifications</Text></View><TouchableOpacity onPress={onClose} style={styles.closeButton}><Ionicons name="close" size={18} color={COLORS.ink} /></TouchableOpacity></View>{announcements.length === 0 ? <View style={styles.emptyState}><Ionicons name="notifications-off-outline" size={24} color={COLORS.muted} /><Text style={styles.emptyStateTitle}>No announcements yet</Text><Text style={styles.emptyStateText}>Your choir updates will show up here when they are published.</Text></View> : announcements.map((item) => <View key={item.id} style={styles.notificationCard}><View style={styles.notificationTop}><Text style={styles.notificationLabel}>{item.priority === 'IMPORTANT' ? 'IMPORTANT' : 'UPDATE'}</Text><Text style={styles.notificationTime}>{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text></View><Text style={styles.notificationTitle}>{item.title}</Text><View style={styles.notificationMeta}><Ionicons name="person-circle-outline" size={14} color={COLORS.muted} /><Text style={styles.notificationAuthor}>{item.authorName ?? item.author?.name ?? 'Elayone team'}</Text></View><Text style={styles.notificationMessage}>{item.message}</Text></View>)}</View>;
}

function AdminForm({ title, icon, children }: { title: string; icon: IconName; children: React.ReactNode }) {
  return <View style={styles.adminForm}><View style={styles.adminFormHeader}><View style={styles.adminFormIcon}><Ionicons name={icon} size={18} color={COLORS.ink} /></View><Text style={styles.adminFormTitle}>{title}</Text></View>{children}</View>;
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    setBusy(true);
    try {
      const session = mode === 'login' ? await signIn(email, password) : await signUp(name, email, password);
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
          <Text style={styles.authTitle}>{mode === 'login' ? 'Welcome back.' : 'Join the choir.'}</Text>
          <Text style={styles.authCaption}>{mode === 'login' ? 'Sign in to stay in rhythm with your ministry.' : 'Create your member account and serve with one voice.'}</Text>
          {mode === 'signup' && <Field label="FULL NAME" value={name} onChangeText={setName} placeholder="Your name" />}
          <Field label="EMAIL ADDRESS" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="PASSWORD" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry />
          {error ? <Text style={styles.authError}>{error}</Text> : null}
          <TouchableOpacity style={styles.authButton} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color={COLORS.white} /> : <><Text style={styles.authButtonText}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text><Ionicons name="arrow-forward" size={17} color={COLORS.white} /></>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.authSwitch} onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
            <Text style={styles.authSwitchText}>{mode === 'login' ? 'New to Elayone? ' : 'Already have an account? '}<Text style={styles.authSwitchStrong}>{mode === 'login' ? 'Create an account' : 'Sign in'}</Text></Text>
          </TouchableOpacity>
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

function TabView({ tab, rehearsals, selectedRehearsal, setSelectedRehearsal, peopleList, canManage, onRemovePerson, songList }: { tab: Tab; rehearsals: Rehearsal[]; selectedRehearsal: string; setSelectedRehearsal: (value: string) => void; peopleList: typeof people; canManage: boolean; onRemovePerson: (id: string) => void; songList: SongItem[] }) {
  const selected = rehearsals.find((rehearsal) => rehearsal.id === selectedRehearsal) ?? rehearsals[0] ?? null;
  return <><BaseTabView tab={tab} rehearsals={rehearsals} selectedRehearsal={selectedRehearsal} setSelectedRehearsal={setSelectedRehearsal} peopleList={peopleList} canManage={canManage} onRemovePerson={onRemovePerson} songList={songList} />{tab === 'Rehearsals' && <AttendanceRoster rehearsal={selected} />}{tab === 'People' && <><AvailabilitySummary />{canManage && <AdminMemberList peopleList={peopleList} onRemovePerson={onRemovePerson} />}</>}</>;
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

function BaseTabView({ tab, rehearsals, selectedRehearsal, setSelectedRehearsal, peopleList, canManage, onRemovePerson, songList }: { tab: Tab; rehearsals: Rehearsal[]; selectedRehearsal: string; setSelectedRehearsal: (value: string) => void; peopleList: typeof people; canManage: boolean; onRemovePerson: (id: string) => void; songList: SongItem[] }) {
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
          <TouchableOpacity style={styles.addButton}>
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
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 82, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.line, flexDirection: 'row', justifyContent: 'space-around', paddingTop: 10 }, navItem: { alignItems: 'center', width: 75 }, navIconWrap: { width: 31, height: 27, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }, navIconActive: { backgroundColor: COLORS.ink }, navLabel: { color: COLORS.muted, fontSize: 10, marginTop: 6 }, navLabelActive: { color: COLORS.ink, fontWeight: '800' },
  pageEyebrow: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 }, pageTitle: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 38 }, pageCaption: { color: COLORS.muted, fontSize: 14, marginTop: 8, marginBottom: 24 }, addButton: { backgroundColor: COLORS.ink, paddingVertical: 12, paddingHorizontal: 15, borderRadius: 3, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7, marginBottom: 28 }, addButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '800' }, listLabel: { color: COLORS.muted, fontSize: 10, letterSpacing: 1.4, fontWeight: '800', marginBottom: 10 }, rehearsalListItem: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, padding: 10, borderRadius: 4, flexDirection: 'row', alignItems: 'center', marginBottom: 9 }, rehearsalListSelected: { borderColor: COLORS.olive, borderWidth: 1.5 }, dateBlock: { width: 48, height: 61, alignItems: 'center', justifyContent: 'center', borderRadius: 3, marginRight: 12 }, dateDay: { color: COLORS.white, fontSize: 8, fontWeight: '800', letterSpacing: 0.6 }, dateNumber: { color: COLORS.white, fontFamily: 'Georgia', fontSize: 24, lineHeight: 25 }, dateMonth: { color: COLORS.white, fontSize: 8, fontWeight: '800' }, listMain: { flex: 1 }, listTitle: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 16 }, listMeta: { color: COLORS.muted, fontSize: 10, marginTop: 5 }, listAttendance: { color: COLORS.olive, fontSize: 10, fontWeight: '700', marginTop: 6 }, peopleSummary: { backgroundColor: COLORS.ink, borderRadius: 4, padding: 19, flexDirection: 'row', alignItems: 'center', marginBottom: 22 }, peopleNumber: { color: COLORS.white, fontFamily: 'Georgia', fontSize: 45, marginRight: 16 }, peopleTitle: { color: COLORS.white, fontSize: 15, fontWeight: '800' }, peopleCaption: { color: '#aaa9a3', fontSize: 11, marginTop: 5 }, personRow: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.line, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }, personAvatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginRight: 12 }, personInitials: { color: COLORS.ink, fontSize: 12, fontWeight: '800' }, personInfo: { flex: 1 }, personName: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 16 }, personRole: { color: COLORS.muted, fontSize: 11, marginTop: 4 }, songFeatured: { backgroundColor: COLORS.ink, borderRadius: 4, padding: 17, flexDirection: 'row', alignItems: 'center', marginBottom: 21 }, songIconLarge: { width: 45, height: 45, backgroundColor: COLORS.clay, alignItems: 'center', justifyContent: 'center', borderRadius: 3, marginRight: 13 }, songFeatureLabel: { color: '#b7b5ad', fontSize: 8, fontWeight: '800', letterSpacing: 1.2 }, songFeatureTitle: { color: COLORS.white, fontFamily: 'Georgia', fontSize: 20, marginTop: 6 }, songFeatureMeta: { color: '#b7b5ad', fontSize: 10, marginTop: 5 }, songRow: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 9 }, songRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center' }, songIcon: { width: 36, height: 36, backgroundColor: COLORS.paper, alignItems: 'center', justifyContent: 'center', marginRight: 11 }, songInfo: { flex: 1 }, songTitle: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 15 }, songMeta: { color: COLORS.muted, fontSize: 10, marginTop: 4 }, songStatus: { backgroundColor: '#f4e7e2', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 3 }, readyStatus: { backgroundColor: '#eef2ec' }, songStatusText: { color: COLORS.clay, fontSize: 9, fontWeight: '800' }, readyStatusText: { color: COLORS.olive }, songPlayButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.paper, alignItems: 'center', justifyContent: 'center', marginLeft: 10 }, 
});
