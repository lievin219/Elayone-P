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
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
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

export async function createSong(choirId: string, data: { title: string; key?: string; status?: string; previewUrl?: string; notes?: string }) {
  return request<SongRecord>(`/api/choirs/${choirId}/songs`, { method: 'POST', headers: await authHeaders(), body: JSON.stringify(data) });
}

export type AttendanceSummary = { total: number; confirmed: number; rate: number; upcoming: number };

export type RehearsalRecord = {
  id: string;
  title: string;
  location: string;
  startsAt: string;
  endsAt: string;
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

export async function createRehearsal(choirId: string, data: { title: string; startsAt: string; endsAt: string; location: string }) {
  return request(`/api/choirs/${choirId}/rehearsals`, { method: 'POST', headers: await authHeaders(), body: JSON.stringify(data) });
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
