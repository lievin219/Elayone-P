import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { AttendanceSummary, createRehearsal, DirectoryUser, getAllUsers, getAttendanceSummary, getStoredSession, publishAnnouncement, removeChoirMember, Session, signIn, signOut, signUp } from './src/api';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Tab = 'Home' | 'Rehearsals' | 'People' | 'Songs' | 'Admin';

type Rehearsal = {
  day: string;
  date: string;
  month: string;
  title: string;
  time: string;
  room: string;
  count: string;
  color: string;
};

const rehearsals: Rehearsal[] = [
  { day: 'MON', date: '18', month: 'AUG', title: 'Sunday service set', time: '18:00 - 20:00', room: 'Main sanctuary', count: '18/24', color: '#1c1c1c' },
  { day: 'WED', date: '20', month: 'AUG', title: 'Sectionals: soprano + alto', time: '17:30 - 19:00', room: 'Choir room', count: '12/12', color: '#c9b99a' },
  { day: 'SAT', date: '23', month: 'AUG', title: 'Full choir rehearsal', time: '09:00 - 12:00', room: 'Main sanctuary', count: '24/24', color: '#82746a' },
];

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

const songs = [
  { title: 'Iminsi yose', key: 'Key of D', status: 'Ready', icon: 'musical-notes-outline' as IconName },
  { title: 'None urabikoze', key: 'Key of G', status: 'Learn', icon: 'book-outline' as IconName },
  { title: 'Jambo', key: 'Key of F', status: 'Ready', icon: 'musical-notes-outline' as IconName },
  { title: 'umvugutire', key: 'Key of F', status: 'Ready', icon: 'musical-notes-outline' as IconName },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('Home');
  const [selectedRehearsal, setSelectedRehearsal] = useState<string>('Sunday service set');
  const [checkedIn, setCheckedIn] = useState(false);
  const [visiblePeople, setVisiblePeople] = useState(people);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary>({ total: 0, confirmed: 0, rate: 0, upcoming: 0 });

  const showHome = activeTab === 'Home';
  const isAdmin = session?.user.role === 'ADMIN' || session?.user.role === 'LEADER';

  React.useEffect(() => {
    getStoredSession().then(setSession).finally(() => setAuthReady(true));
  }, []);

  React.useEffect(() => {
    if (session) getAttendanceSummary('elayone-main-choir').then(setAttendanceSummary).catch(() => undefined);
  }, [session]);

  if (!authReady) return <View style={styles.loadingScreen}><ActivityIndicator color={COLORS.ink} /></View>;
  if (!session) return <AuthScreen onAuthenticated={setSession} />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.appShell}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>E</Text></View>
            <View style={styles.brandCopy}>
              <Text style={styles.brandName}>ELAYONE MUSIC</Text>
              <Text style={styles.brandSub}>GOSPEL MUSIC MINISTRY</Text>
            </View>
            <TouchableOpacity style={styles.notificationButton} accessibilityLabel="Sign out" onPress={() => signOut().then(() => setSession(null))}>
              <Ionicons name="notifications-outline" size={21} color={COLORS.ink} />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
          </View>

          {showHome ? (
            <>
              <View style={styles.hero}>
                <Text style={styles.eyebrow}>MONDAY, 18 AUGUST 2025</Text>
                <Text style={styles.heroTitle}>Serve with{`\n`}one voice.</Text>
                <Text style={styles.heroBody}>A clear heart. A prepared voice. Music for the mission.</Text>
              </View>

              <View style={styles.nextRehearsalCard}>
                <View style={styles.cardTopLine}>
                  <Text style={styles.cardEyebrow}>NEXT REHEARSAL</Text>
                  <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>IN 6 HOURS</Text></View>
                </View>
                <Text style={styles.rehearsalTitle}>Sunday service set</Text>
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={16} color={COLORS.muted} />
                  <Text style={styles.detailText}>18:00 - 20:00</Text>
                  <Ionicons name="location-outline" size={16} color={COLORS.muted} style={styles.detailIcon} />
                  <Text style={styles.detailText}>Main sanctuary</Text>
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
                <View style={styles.weekMetric}><Text style={styles.metricNumber}>{String(attendanceSummary.upcoming).padStart(2, '0')}</Text><Text style={styles.metricLabel}>REHEARSALS</Text><View style={styles.metricRule} /><Text style={styles.metricFoot}>upcoming</Text></View>
                <View style={styles.weekMetric}><Text style={styles.metricNumber}>{attendanceSummary.rate}<Text style={styles.metricPercent}>%</Text></Text><Text style={styles.metricLabel}>ATTENDANCE</Text><View style={[styles.metricRule, { backgroundColor: COLORS.olive }]} /><Text style={styles.metricFoot}>{attendanceSummary.total} responses</Text></View>
                <View style={styles.weekMetric}><Text style={styles.metricNumber}>04</Text><Text style={styles.metricLabel}>NEW SONGS</Text><View style={[styles.metricRule, { backgroundColor: COLORS.clay }]} /><Text style={styles.metricFoot}>in the library</Text></View>
              </View>

              <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Quick access</Text><Text style={styles.sectionCaption}>What do you need today?</Text></View></View>
              <View style={styles.quickGrid}>
                <QuickAction icon="calendar-outline" label="Plan rehearsal" onPress={() => setActiveTab('Rehearsals')} />
                <QuickAction icon="people-outline" label="View choir" onPress={() => setActiveTab('People')} />
                <QuickAction icon="musical-notes-outline" label="Song library" onPress={() => setActiveTab('Songs')} />
                <QuickAction icon="chatbubble-ellipses-outline" label="Send update" onPress={() => setCheckedIn(true)} />
              </View>
            </>
          ) : activeTab === 'Admin' ? <AdminPanel /> : (
            <TabView tab={activeTab} selectedRehearsal={selectedRehearsal} setSelectedRehearsal={setSelectedRehearsal} peopleList={visiblePeople} canManage={isAdmin} onRemovePerson={(id) => setVisiblePeople((current) => current.filter((person) => person.id !== id))} />
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

function AdminPanel() {
  const [eventTitle, setEventTitle] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [newsTitle, setNewsTitle] = useState('');
  const [newsMessage, setNewsMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const choirId = 'elayone-main-choir';

  React.useEffect(() => {
    getAllUsers().then(setUsers).catch(() => undefined).finally(() => setUsersLoading(false));
  }, []);

  async function addEvent() {
    if (!eventTitle || !eventLocation) return Alert.alert('Missing details', 'Add an event title and location.');
    setBusy(true);
    try { await createRehearsal(choirId, { title: eventTitle, location: eventLocation, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() }); setEventTitle(''); setEventLocation(''); Alert.alert('Event added', 'The choir can now see this rehearsal.'); } catch (error) { Alert.alert('Could not add event', error instanceof Error ? error.message : 'Try again.'); } finally { setBusy(false); }
  }

  async function publishNews() {
    if (!newsTitle || !newsMessage) return Alert.alert('Missing details', 'Add a headline and message.');
    setBusy(true);
    try { await publishAnnouncement(choirId, { title: newsTitle, message: newsMessage, priority: 'NORMAL' }); setNewsTitle(''); setNewsMessage(''); Alert.alert('News published', 'Your announcement is now available to the choir.'); } catch (error) { Alert.alert('Could not publish', error instanceof Error ? error.message : 'Try again.'); } finally { setBusy(false); }
  }

  function removeMember() {
    Alert.alert('Remove a member', 'Choose a member from the People screen to remove them from the choir.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Go to People', onPress: () => undefined }]);
  }

  return <View><Text style={styles.pageEyebrow}>ELAYONE / ADMIN</Text><Text style={styles.pageTitle}>Lead the ministry</Text><Text style={styles.pageCaption}>Keep the choir informed, prepared, and cared for.</Text><View style={styles.adminNotice}><Ionicons name="shield-checkmark-outline" size={20} color={COLORS.olive} /><View style={{ flex: 1 }}><Text style={styles.adminNoticeTitle}>Leader access</Text><Text style={styles.adminNoticeText}>Your changes are shared with the whole choir.</Text></View></View><AdminForm title="All registered users" icon="people-circle-outline"><View style={styles.directoryHeader}><Text style={styles.directoryCount}>{users.length}</Text><Text style={styles.directoryLabel}>accounts</Text><TouchableOpacity onPress={() => { setUsersLoading(true); getAllUsers().then(setUsers).finally(() => setUsersLoading(false)); }}><Ionicons name="refresh-outline" size={19} color={COLORS.ink} /></TouchableOpacity></View>{usersLoading ? <ActivityIndicator color={COLORS.ink} /> : users.length === 0 ? <Text style={styles.adminHelp}>No registered users yet.</Text> : users.map((user) => <View key={user.id} style={styles.directoryRow}><View style={styles.directoryAvatar}><Text style={styles.directoryInitial}>{user.name.slice(0, 1).toUpperCase()}</Text></View><View style={styles.personInfo}><Text style={styles.personName}>{user.name}</Text><Text style={styles.personRole}>{user.email}</Text><Text style={styles.directoryMeta}>{user.role} · {user.memberships.length} choir membership{user.memberships.length === 1 ? '' : 's'}</Text></View></View>)}</AdminForm><AdminForm title="Add an event" icon="calendar-outline"><Field label="EVENT TITLE" value={eventTitle} onChangeText={setEventTitle} placeholder="Full choir rehearsal" /><Field label="LOCATION" value={eventLocation} onChangeText={setEventLocation} placeholder="Main sanctuary" /><TouchableOpacity style={styles.adminButton} onPress={addEvent} disabled={busy}><Ionicons name="add" size={17} color={COLORS.white} /><Text style={styles.adminButtonText}>Add event</Text></TouchableOpacity></AdminForm><AdminForm title="Publish news" icon="megaphone-outline"><Field label="HEADLINE" value={newsTitle} onChangeText={setNewsTitle} placeholder="A note for the choir" /><Field label="MESSAGE" value={newsMessage} onChangeText={setNewsMessage} placeholder="Write your announcement" multiline /><TouchableOpacity style={styles.adminButton} onPress={publishNews} disabled={busy}><Ionicons name="paper-plane-outline" size={16} color={COLORS.white} /><Text style={styles.adminButtonText}>Publish news</Text></TouchableOpacity></AdminForm><AdminForm title="Member management" icon="people-outline"><Text style={styles.adminHelp}>Remove singers who are no longer part of Elayone Choir. This action cannot be undone.</Text><TouchableOpacity style={styles.removeButton} onPress={removeMember}><Ionicons name="person-remove-outline" size={17} color={COLORS.clay} /><Text style={styles.removeButtonText}>Manage members</Text></TouchableOpacity></AdminForm></View>;
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
    <StatusBar barStyle="light-content" />
    <KeyboardAvoidingView style={styles.authShell} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
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
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function Field({ label, value, onChangeText, placeholder, ...props }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string } & Omit<React.ComponentProps<typeof TextInput>, 'value' | 'onChangeText' | 'placeholder'>) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#8b8b88" style={styles.fieldInput} /></View>;
}

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return <TouchableOpacity style={styles.quickAction} onPress={onPress}><View style={styles.quickIcon}><Ionicons name={icon} size={20} color={COLORS.ink} /></View><Text style={styles.quickLabel}>{label}</Text><Ionicons name="arrow-forward" size={15} color={COLORS.muted} /></TouchableOpacity>;
}

function TabView({ tab, selectedRehearsal, setSelectedRehearsal, peopleList, canManage, onRemovePerson }: { tab: Tab; selectedRehearsal: string; setSelectedRehearsal: (value: string) => void; peopleList: typeof people; canManage: boolean; onRemovePerson: (id: string) => void }) {
  return <><BaseTabView tab={tab} selectedRehearsal={selectedRehearsal} setSelectedRehearsal={setSelectedRehearsal} peopleList={peopleList} canManage={canManage} onRemovePerson={onRemovePerson} />{tab === 'Rehearsals' && <AttendanceRoster rehearsal={selectedRehearsal} />}{tab === 'People' && <><AvailabilitySummary />{canManage && <AdminMemberList peopleList={peopleList} onRemovePerson={onRemovePerson} />}</>}</>;
}

function AttendanceRoster({ rehearsal }: { rehearsal: string }) {
  return <View style={styles.rosterSection}><View style={styles.rosterHeader}><View><Text style={styles.sectionTitle}>Who is coming?</Text><Text style={styles.sectionCaption}>{rehearsal}</Text></View><View style={styles.responseSummary}><Text style={styles.responseNumber}>18</Text><Text style={styles.responseLabel}>YES</Text></View></View><View style={styles.responseBar}><View style={styles.responseYes} /><View style={styles.responseMaybe} /><View style={styles.responseNo} /></View><View style={styles.responseLegend}><Text style={styles.legendYes}>18 coming</Text><Text style={styles.legendMaybe}>3 maybe</Text><Text style={styles.legendNo}>3 away</Text></View>{attendanceRoster.map((person) => <View key={person.name} style={styles.rosterRow}><View style={[styles.rosterAvatar, { backgroundColor: person.tone }]}><Text style={styles.personInitials}>{person.name.split(' ').map((part) => part[0]).join('')}</Text></View><View style={styles.personInfo}><Text style={styles.personName}>{person.name}</Text><Text style={styles.personRole}>{person.part}</Text></View><Text style={[styles.rosterStatus, person.status === 'Coming' ? styles.statusComing : person.status === 'Maybe' ? styles.statusMaybe : styles.statusAway]}>{person.status}</Text></View>)}</View>;
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

function BaseTabView({ tab, selectedRehearsal, setSelectedRehearsal, peopleList, canManage, onRemovePerson }: { tab: Tab; selectedRehearsal: string; setSelectedRehearsal: (value: string) => void; peopleList: typeof people; canManage: boolean; onRemovePerson: (id: string) => void }) {
  const heading = tab === 'Rehearsals' ? 'Rehearsals' : tab === 'People' ? 'The choir' : 'Song library';
  const caption = tab === 'Rehearsals' ? 'A prepared choir is a present choir.' : tab === 'People' ? '24 voices, one offering.' : 'Songs we carry together.';
  return <View><Text style={styles.pageEyebrow}>ELAYONE / {tab.toUpperCase()}</Text><Text style={styles.pageTitle}>{heading}</Text><Text style={styles.pageCaption}>{caption}</Text>{tab === 'Rehearsals' && <><TouchableOpacity style={styles.addButton}><Ionicons name="add" size={19} color={COLORS.white} /><Text style={styles.addButtonText}>Add rehearsal</Text></TouchableOpacity><Text style={styles.listLabel}>AUGUST 2025</Text>{rehearsals.map((item) => <TouchableOpacity key={item.title} style={[styles.rehearsalListItem, selectedRehearsal === item.title && styles.rehearsalListSelected]} onPress={() => setSelectedRehearsal(item.title)}><View style={[styles.dateBlock, { backgroundColor: item.color }]}><Text style={styles.dateDay}>{item.day}</Text><Text style={styles.dateNumber}>{item.date}</Text><Text style={styles.dateMonth}>{item.month}</Text></View><View style={styles.listMain}><Text style={styles.listTitle}>{item.title}</Text><Text style={styles.listMeta}>{item.time}  ·  {item.room}</Text><Text style={styles.listAttendance}>{item.count} attending</Text></View><Ionicons name={selectedRehearsal === item.title ? 'checkmark-circle' : 'chevron-forward'} size={20} color={selectedRehearsal === item.title ? COLORS.olive : COLORS.muted} /></TouchableOpacity>)}</>}{tab === 'People' && <><View style={styles.peopleSummary}><Text style={styles.peopleNumber}>24</Text><View><Text style={styles.peopleTitle}>Active singers</Text><Text style={styles.peopleCaption}>4 section leaders · 3 vocal sections</Text></View></View>{people.map((person) => <View key={person.name} style={styles.personRow}><View style={[styles.personAvatar, { backgroundColor: person.tone }]}><Text style={styles.personInitials}>{person.initials}</Text></View><View style={styles.personInfo}><Text style={styles.personName}>{person.name}</Text><Text style={styles.personRole}>{person.role}</Text></View><Ionicons name="ellipsis-horizontal" size={20} color={COLORS.muted} /></View>)}</>}{tab === 'Songs' && <><View style={styles.songFeatured}><View style={styles.songIconLarge}><Ionicons name="musical-notes" size={25} color={COLORS.white} /></View><View style={{ flex: 1 }}><Text style={styles.songFeatureLabel}>CURRENTLY LEARNING</Text><Text style={styles.songFeatureTitle}>Imbaraga Zayo</Text><Text style={styles.songFeatureMeta}>Key of G  ·  62% complete</Text></View><Ionicons name="play-circle-outline" size={29} color={COLORS.white} /></View>{songs.map((song) => <View key={song.title} style={styles.songRow}><View style={styles.songIcon}><Ionicons name={song.icon} size={19} color={COLORS.ink} /></View><View style={styles.songInfo}><Text style={styles.songTitle}>{song.title}</Text><Text style={styles.songMeta}>{song.key}</Text></View><View style={[styles.songStatus, song.status === 'Ready' && styles.readyStatus]}><Text style={[styles.songStatusText, song.status === 'Ready' && styles.readyStatusText]}>{song.status}</Text></View></View>)}</>}</View>;
}

const COLORS = { ink: '#171717', muted: '#797975', line: '#e5e3de', paper: '#f7f7f5', white: '#ffffff', olive: '#708067', clay: '#a76e5b' };

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paper },
  authSafeArea: { flex: 1, backgroundColor: COLORS.ink },
  authShell: { flex: 1 },
  authContent: { flexGrow: 1, paddingHorizontal: 27, paddingTop: 46, paddingBottom: 35 },
  authBrandMark: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.white },
  authBrand: { color: COLORS.white, fontSize: 15, fontWeight: '800', letterSpacing: 2.8, marginTop: 14 },
  authBrandSub: { color: '#aaa9a3', fontSize: 9, fontWeight: '700', letterSpacing: 1.8, marginTop: 4 },
  authRule: { height: 1, backgroundColor: '#3b3b39', marginTop: 40, marginBottom: 38 },
  authTitle: { color: COLORS.white, fontFamily: 'Georgia', fontSize: 41, lineHeight: 47 },
  authCaption: { color: '#aaa9a3', fontSize: 14, lineHeight: 21, marginTop: 11, marginBottom: 31, maxWidth: 290 },
  field: { marginBottom: 19 },
  fieldLabel: { color: '#aaa9a3', fontSize: 9, fontWeight: '800', letterSpacing: 1.3, marginBottom: 8 },
  fieldInput: { height: 49, borderWidth: 1, borderColor: '#4c4c49', borderRadius: 3, color: COLORS.white, fontSize: 14, paddingHorizontal: 14 },
  authError: { color: '#e1a89a', fontSize: 12, marginTop: -5, marginBottom: 16, lineHeight: 18 },
  authButton: { backgroundColor: COLORS.white, minHeight: 51, borderRadius: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 7 },
  authButtonText: { color: COLORS.ink, fontSize: 13, fontWeight: '800' },
  authSwitch: { alignItems: 'center', marginTop: 25 },
  authSwitchText: { color: '#aaa9a3', fontSize: 12 },
  authSwitchStrong: { color: COLORS.white, fontWeight: '800' },
  adminNotice: { backgroundColor: '#eef2ec', borderRadius: 4, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 17 },
  adminNoticeTitle: { color: COLORS.ink, fontSize: 12, fontWeight: '800' },
  adminNoticeText: { color: COLORS.muted, fontSize: 10, marginTop: 3 },
  adminForm: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, padding: 15, marginBottom: 12 },
  adminFormHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  adminFormIcon: { width: 32, height: 32, backgroundColor: COLORS.paper, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  adminFormTitle: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 18 },
  directoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  directoryCount: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 27, marginRight: 6 },
  directoryLabel: { color: COLORS.muted, fontSize: 11, flex: 1 },
  directoryRow: { borderTopWidth: 1, borderTopColor: COLORS.line, paddingVertical: 11, flexDirection: 'row', alignItems: 'center' },
  directoryAvatar: { width: 35, height: 35, borderRadius: 18, backgroundColor: '#d7c5af', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  directoryInitial: { color: COLORS.ink, fontWeight: '800', fontSize: 13 },
  directoryMeta: { color: COLORS.olive, fontSize: 9, fontWeight: '700', marginTop: 4 },
  adminButton: { backgroundColor: COLORS.ink, minHeight: 43, borderRadius: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  adminButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
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
  brandMark: { width: 37, height: 37, borderRadius: 19, backgroundColor: COLORS.ink, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: COLORS.white, fontFamily: 'Georgia', fontSize: 22, fontWeight: '700', fontStyle: 'italic' },
  brandCopy: { marginLeft: 10, flex: 1 }, brandName: { color: COLORS.ink, fontSize: 13, fontWeight: '800', letterSpacing: 1.8 }, brandSub: { color: COLORS.muted, fontSize: 8, fontWeight: '700', letterSpacing: 1.25, marginTop: 3 },
  notificationButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' }, notificationDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.clay, right: 10, top: 9 },
  hero: { marginBottom: 25 }, eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: COLORS.muted, marginBottom: 13 }, heroTitle: { fontFamily: 'Georgia', fontSize: 43, lineHeight: 47, color: COLORS.ink, letterSpacing: -1 }, heroBody: { fontSize: 14, color: COLORS.muted, marginTop: 13, lineHeight: 21 },
  nextRehearsalCard: { backgroundColor: COLORS.white, borderRadius: 5, padding: 20, borderWidth: 1, borderColor: '#eeece7', marginBottom: 29 }, cardTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, cardEyebrow: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.25 }, livePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eef2ec', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 3 }, liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.olive, marginRight: 5 }, liveText: { color: COLORS.olive, fontSize: 8, fontWeight: '800', letterSpacing: 0.6 }, rehearsalTitle: { fontFamily: 'Georgia', fontSize: 24, color: COLORS.ink, marginTop: 19 }, detailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 }, detailText: { color: COLORS.muted, fontSize: 12, marginLeft: 5 }, detailIcon: { marginLeft: 14 }, cardFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.line, marginTop: 19, paddingTop: 15 }, avatarStack: { flexDirection: 'row', width: 62 }, avatar: { width: 25, height: 25, borderRadius: 13, borderWidth: 1.5, borderColor: COLORS.white, justifyContent: 'center', alignItems: 'center' }, avatarText: { fontSize: 9, fontWeight: '800', color: COLORS.ink }, attendanceText: { color: COLORS.muted, fontSize: 11, flex: 1 }, checkInButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.ink, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 3, gap: 7 }, checkInText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }, sectionTitle: { fontFamily: 'Georgia', color: COLORS.ink, fontSize: 21 }, sectionCaption: { fontSize: 11, color: COLORS.muted, marginTop: 4 }, seeAll: { color: COLORS.ink, fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' }, weekGrid: { flexDirection: 'row', gap: 8, marginBottom: 31 }, weekMetric: { flex: 1, backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#eeece7', padding: 13, borderRadius: 4 }, metricNumber: { fontFamily: 'Georgia', fontSize: 30, color: COLORS.ink }, metricPercent: { fontFamily: 'Georgia', fontSize: 17 }, metricLabel: { color: COLORS.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.8, marginTop: 7 }, metricRule: { height: 3, backgroundColor: COLORS.ink, width: 26, marginTop: 12, marginBottom: 8 }, metricFoot: { color: COLORS.muted, fontSize: 9 }, quickGrid: { gap: 8 }, quickAction: { backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, minHeight: 55, borderRadius: 4, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11 }, quickIcon: { width: 33, height: 33, backgroundColor: COLORS.paper, alignItems: 'center', justifyContent: 'center', marginRight: 11 }, quickLabel: { color: COLORS.ink, fontWeight: '700', fontSize: 13, flex: 1 },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 82, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.line, flexDirection: 'row', justifyContent: 'space-around', paddingTop: 10 }, navItem: { alignItems: 'center', width: 75 }, navIconWrap: { width: 31, height: 27, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }, navIconActive: { backgroundColor: COLORS.ink }, navLabel: { color: COLORS.muted, fontSize: 10, marginTop: 6 }, navLabelActive: { color: COLORS.ink, fontWeight: '800' },
  pageEyebrow: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 }, pageTitle: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 38 }, pageCaption: { color: COLORS.muted, fontSize: 14, marginTop: 8, marginBottom: 24 }, addButton: { backgroundColor: COLORS.ink, paddingVertical: 12, paddingHorizontal: 15, borderRadius: 3, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7, marginBottom: 28 }, addButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '800' }, listLabel: { color: COLORS.muted, fontSize: 10, letterSpacing: 1.4, fontWeight: '800', marginBottom: 10 }, rehearsalListItem: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, padding: 10, borderRadius: 4, flexDirection: 'row', alignItems: 'center', marginBottom: 9 }, rehearsalListSelected: { borderColor: COLORS.olive, borderWidth: 1.5 }, dateBlock: { width: 48, height: 61, alignItems: 'center', justifyContent: 'center', borderRadius: 3, marginRight: 12 }, dateDay: { color: COLORS.white, fontSize: 8, fontWeight: '800', letterSpacing: 0.6 }, dateNumber: { color: COLORS.white, fontFamily: 'Georgia', fontSize: 24, lineHeight: 25 }, dateMonth: { color: COLORS.white, fontSize: 8, fontWeight: '800' }, listMain: { flex: 1 }, listTitle: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 16 }, listMeta: { color: COLORS.muted, fontSize: 10, marginTop: 5 }, listAttendance: { color: COLORS.olive, fontSize: 10, fontWeight: '700', marginTop: 6 }, peopleSummary: { backgroundColor: COLORS.ink, borderRadius: 4, padding: 19, flexDirection: 'row', alignItems: 'center', marginBottom: 22 }, peopleNumber: { color: COLORS.white, fontFamily: 'Georgia', fontSize: 45, marginRight: 16 }, peopleTitle: { color: COLORS.white, fontSize: 15, fontWeight: '800' }, peopleCaption: { color: '#aaa9a3', fontSize: 11, marginTop: 5 }, personRow: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.line, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }, personAvatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginRight: 12 }, personInitials: { color: COLORS.ink, fontSize: 12, fontWeight: '800' }, personInfo: { flex: 1 }, personName: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 16 }, personRole: { color: COLORS.muted, fontSize: 11, marginTop: 4 }, songFeatured: { backgroundColor: COLORS.ink, borderRadius: 4, padding: 17, flexDirection: 'row', alignItems: 'center', marginBottom: 21 }, songIconLarge: { width: 45, height: 45, backgroundColor: COLORS.clay, alignItems: 'center', justifyContent: 'center', borderRadius: 3, marginRight: 13 }, songFeatureLabel: { color: '#b7b5ad', fontSize: 8, fontWeight: '800', letterSpacing: 1.2 }, songFeatureTitle: { color: COLORS.white, fontFamily: 'Georgia', fontSize: 20, marginTop: 6 }, songFeatureMeta: { color: '#b7b5ad', fontSize: 10, marginTop: 5 }, songRow: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 9 }, songIcon: { width: 36, height: 36, backgroundColor: COLORS.paper, alignItems: 'center', justifyContent: 'center', marginRight: 11 }, songInfo: { flex: 1 }, songTitle: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 15 }, songMeta: { color: COLORS.muted, fontSize: 10, marginTop: 4 }, songStatus: { backgroundColor: '#f4e7e2', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 3 }, readyStatus: { backgroundColor: '#eef2ec' }, songStatusText: { color: COLORS.clay, fontSize: 9, fontWeight: '800' }, readyStatusText: { color: COLORS.olive },
});
