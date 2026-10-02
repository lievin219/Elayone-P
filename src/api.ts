import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const webStorage = {
  async getItemAsync(key: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  async setItemAsync(key: string, value: string): Promise<void> {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
  },
  async deleteItemAsync(key: string): Promise<void> {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
  },
};

async function safeStorageGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return webStorage.getItemAsync(key);
  }

  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return webStorage.getItemAsync(key);
  }
}

async function safeStorageSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await webStorage.setItemAsync(key, value);
    return;
  }

  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    await webStorage.setItemAsync(key, value);
  }
}

async function safeStorageDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await webStorage.deleteItemAsync(key);
    return;
  }

  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    await webStorage.deleteItemAsync(key);
  }
}

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'MEMBER' | 'LEADER' | 'ADMIN';
};

export type Session = {
  token: string;
  user: User;
};

export type Role = 'MEMBER' | 'LEADER' | 'ADMIN';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const SESSION_KEY = process.env.SESSION_KEY ?? 'elayone-session';

async function authHeaders(): Promise<HeadersInit> {
  const session = await getStoredSession();
  return session ? { Authorization: `Bearer ${session.token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    const headers = new Headers(options.headers ?? {});
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(`Cannot reach the server at ${API_URL}. Make sure the API is running and your phone is on the same Wi-Fi network.`);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message ?? 'Something went wrong. Please try again.');
  return body as T;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const session = await request<Session>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  await safeStorageSet(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function signUp(name: string, email: string, password: string): Promise<Session> {
  const session = await request<Session>('/api/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password }) });
  await safeStorageSet(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function getStoredSession(): Promise<Session | null> {
  const value = await safeStorageGet(SESSION_KEY);
  return value ? JSON.parse(value) as Session : null;
}

export async function signOut(): Promise<void> {
  await safeStorageDelete(SESSION_KEY);
}

export async function getChoirPeople(choirId: string) {
  return request<Array<{ id: string; availability: 'YES' | 'MAYBE' | 'NO' | 'PENDING'; vocalPart: string | null; user: User }>>(`/api/choirs/${choirId}/people`, { headers: await authHeaders() });
}

export async function updateAttendance(choirId: string, rehearsalId: string, status: 'YES' | 'MAYBE' | 'NO') {
  return request(`/api/choirs/${choirId}/rehearsals/${rehearsalId}/attendance`, { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ status }) });
}

export type AnnouncementRecord = {
  id: string;
  title: string;
  message: string;
  priority: 'NORMAL' | 'IMPORTANT';
  createdAt: string;
  author?: { name: string } | null;
};

export async function getAnnouncements(choirId: string) {
  return request<AnnouncementRecord[]>(`/api/choirs/${choirId}/announcements`, { headers: await authHeaders() });
}

export type ReminderRecord = {
  id: string;
  kind: 'EVENT' | 'RESPONSE';
  title: string;
  message: string;
  priority: 'NORMAL' | 'IMPORTANT';
  createdAt: string;
  eventId: string;
};

export async function getReminders(choirId: string): Promise<ReminderRecord[]> {
  return request<ReminderRecord[]>(`/api/choirs/${choirId}/reminders`, { headers: await authHeaders() });
}

export type SongRecord = {
  id: string;
  title: string;
  key: string | null;
  status: string;
  notes?: string | null;
  previewUrl?: string | null;
};

export async function getSongs(choirId: string): Promise<SongRecord[]> {
  return request<SongRecord[]>(`/api/choirs/${choirId}/songs`, { headers: await authHeaders() });
}

export async function createSong(choirId: string, data: { title: string; key?: string; status?: string; previewUrl?: string; notes?: string; media?: { uri: string; name: string; mimeType: string } }) {
  const headers = await authHeaders();
  if (data.media) {
    const form = new FormData();
    form.append('title', data.title);
    if (data.key) form.append('key', data.key);
    if (data.status) form.append('status', data.status);
    if (data.notes) form.append('notes', data.notes);
    if (Platform.OS === 'web') {
      const fileResponse = await fetch(data.media.uri);
      const fileBlob = await fileResponse.blob();
      form.append('media', fileBlob, data.media.name);
    } else {
      form.append('media', { uri: data.media.uri, name: data.media.name, type: data.media.mimeType } as unknown as Blob);
    }
    return request<SongRecord>(`/api/choirs/${choirId}/songs`, { method: 'POST', headers, body: form });
  }
  return request<SongRecord>(`/api/choirs/${choirId}/songs`, { method: 'POST', headers, body: JSON.stringify(data) });
}

export async function deleteSong(choirId: string, songId: string): Promise<void> {
  return request<void>(`/api/choirs/${choirId}/songs/${songId}`, { method: 'DELETE', headers: await authHeaders() });
}

export type AttendanceSummary = { total: number; confirmed: number; rate: number; upcoming: number };

export type AttendanceResponseStatus = 'YES' | 'MAYBE' | 'NO' | 'PENDING';

export type AttendanceReport = {
  scope: 'member' | 'choir';
  generatedAt: string;
  summary: { members: number; rehearsals: number; total: number; yes: number; maybe: number; no: number; pending: number; responseRate: number };
  events: Array<{
    id: string;
    title: string;
    eventType: EventType;
    startsAt: string;
    location: string;
    totals: { yes: number; maybe: number; no: number; pending: number };
    responses: Array<{ userId: string; name: string; status: AttendanceResponseStatus }>;
  }>;
  members: Array<{
    id: string;
    name: string;
    email?: string;
    vocalPart: string | null;
    stats: { yes: number; maybe: number; no: number; pending: number; responseRate: number };
    events: Array<{ rehearsalId: string; title: string; eventType: EventType; startsAt: string; location: string; status: AttendanceResponseStatus }>;
  }>;
};

export async function getAttendanceReport(choirId: string): Promise<AttendanceReport> {
  return request<AttendanceReport>(`/api/choirs/${choirId}/attendance/report`, { headers: await authHeaders() });
}

export type EventType = 'SERVICE' | 'REHEARSAL' | 'WORSHIP_NIGHT' | 'SPECIAL_EVENT' | 'CUSTOM';

export type RehearsalRecord = {
  id: string;
  title: string;
  eventType?: EventType;
  customEventType?: string | null;
  eventTypeName?: string;
  recurrenceFrequency?: 'NONE' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  recurrenceIndex?: number;
  recurrenceTotal?: number;
  location: string;
  startsAt: string;
  endsAt: string;
  invitationOnly?: boolean;
  invited?: boolean;
  myStatus?: AttendanceResponseStatus;
  confirmedCount?: number;
  invitees?: Array<{ userId: string; name: string; status: AttendanceResponseStatus }>;
  attendances?: Array<{ id: string; status: 'YES' | 'MAYBE' | 'NO' | 'PENDING'; userId: string }>;
};
export async function getAttendanceSummary(choirId: string): Promise<AttendanceSummary> {
  return request<AttendanceSummary>(`/api/choirs/${choirId}/attendance/summary`, { headers: await authHeaders() });
}

export async function getRehearsals(choirId: string): Promise<RehearsalRecord[]> {
  return request<RehearsalRecord[]>(`/api/choirs/${choirId}/rehearsals`, { headers: await authHeaders() });
}

export async function removeChoirMember(choirId: string, userId: string) {
  return request<void>(`/api/choirs/${choirId}/people/${userId}`, { method: 'DELETE', headers: await authHeaders() });
}

export async function updateUserRole(userId: string, role: Role) {
  return request<User>(`/api/users/${userId}/role`, { method: 'PATCH', headers: await authHeaders(), body: JSON.stringify({ role }) });
}

export async function resetUserPassword(userId: string, password: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/api/users/${userId}/password`, { method: 'PATCH', headers: await authHeaders(), body: JSON.stringify({ password }) });
}

export async function createMemberAccount(data: { name: string; email: string; password: string }): Promise<DirectoryUser> {
  return request<DirectoryUser>('/api/users', { method: 'POST', headers: await authHeaders(), body: JSON.stringify(data) });
}

export async function createRehearsal(choirId: string, data: { title: string; startsAt: string; endsAt: string; location: string; eventType?: EventType; customEventType?: string; recurrenceFrequency?: 'NONE' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'; recurrenceCount?: number; inviteeIds?: string[] }) {
  return request<RehearsalRecord>(`/api/choirs/${choirId}/rehearsals`, { method: 'POST', headers: await authHeaders(), body: JSON.stringify(data) });
}

export async function publishAnnouncement(choirId: string, data: { title: string; message: string; priority: 'NORMAL' | 'IMPORTANT' }) {
  return request(`/api/choirs/${choirId}/announcements`, { method: 'POST', headers: await authHeaders(), body: JSON.stringify(data) });
}

export async function deleteAnnouncement(choirId: string, announcementId: string) {
  return request<void>(`/api/choirs/${choirId}/announcements/${announcementId}`, { method: 'DELETE', headers: await authHeaders() });
}

export type DirectoryUser = User & {
  createdAt: string;
  memberships: Array<{ choirId: string; vocalPart: string | null; availability: string }>;
};

export async function getAllUsers(): Promise<DirectoryUser[]> {
  return request<DirectoryUser[]>('/api/users', { headers: await authHeaders() });
}
