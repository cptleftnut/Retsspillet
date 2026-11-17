import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import type { LegalCase } from './types';

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
export const DRIVE_OAUTH_CLIENT_ID = firebaseConfig.oAuthClientId;

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}
if (DRIVE_OAUTH_CLIENT_ID) {
  provider.setCustomParameters({
    include_granted_scopes: 'true',
  });
}

let isSigningIn = false;
// Access token is cached strictly in memory (never localStorage or sessionStorage)
let cachedAccessToken: string | null = null;

interface GoogleAccountsGsi {
  accounts?: {
    oauth2?: {
      initTokenClient: (cfg: {
        client_id: string;
        scope: string;
        callback: (resp: { access_token?: string; error?: string }) => void;
      }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
    };
  };
}

async function loadGsiScript(): Promise<void> {
  if (typeof window === 'undefined') return;
  const g = (window as unknown as { google?: GoogleAccountsGsi }).google;
  if (g?.accounts?.oauth2) return;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Kunne ikke indlæse Google OAuth.')), {
        once: true,
      });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Kunne ikke indlæse Google OAuth-script.'));
    document.head.appendChild(script);
  });
}

/**
 * Direct OAuth 2.0 token flow backed by the stored oAuthClientId in firebase-applet-config.json.
 * Keeps token strictly in memory.
 */
export async function requestDriveTokenViaOAuthClientId(): Promise<string> {
  if (!DRIVE_OAUTH_CLIENT_ID) {
    throw new Error('oAuthClientId mangler i konfigurationen.');
  }
  await loadGsiScript();
  const g = (window as unknown as { google?: GoogleAccountsGsi }).google;
  if (!g?.accounts?.oauth2) {
    throw new Error('Google Identity Services er ikke tilgængelig.');
  }

  return await new Promise<string>((resolve, reject) => {
    const client = g.accounts!.oauth2!.initTokenClient({
      client_id: DRIVE_OAUTH_CLIENT_ID,
      scope: SCOPES.join(' '),
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || 'Google Drive OAuth-tilladelse blev afvist.'));
          return;
        }
        cachedAccessToken = resp.access_token;
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken({ prompt: '' });
  });
}

export function initDriveAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user && cachedAccessToken) {
      onAuthSuccess?.(user, cachedAccessToken);
    } else if (!isSigningIn) {
      if (!user) cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
}

export async function signInWithGoogleDrive(): Promise<{
  userEmail: string;
  accessToken: string;
}> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
      return {
        userEmail: result.user.email || result.user.displayName || 'Google-bruger',
        accessToken: cachedAccessToken,
      };
    }

    // Fallback: obtain OAuth 2.0 access token directly via stored oAuthClientId
    const token = await requestDriveTokenViaOAuthClientId();
    return {
      userEmail: result.user.email || result.user.displayName || 'Google-bruger',
      accessToken: token,
    };
  } finally {
    isSigningIn = false;
  }
}

export function getCachedDriveToken(): string | null {
  return cachedAccessToken;
}

export async function signOutDrive(): Promise<void> {
  cachedAccessToken = null;
  await auth.signOut();
}

export interface DriveFileSummary {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

export async function listDriveItems(folderId = 'root'): Promise<DriveFileSummary[]> {
  if (!cachedAccessToken) {
    throw new Error('Log ind med Google først for at browse Drive.');
  }
  const res = await fetch(`/api/drive?folderId=${encodeURIComponent(folderId)}`, {
    headers: { Authorization: `Bearer ${cachedAccessToken}` },
  });
  const data = (await res.json()) as { files?: DriveFileSummary[]; error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Google Drive fejl (${res.status}). Log venligst ind igen.`);
  }
  return data.files ?? [];
}

export async function importDriveFileAsCase(file: DriveFileSummary): Promise<LegalCase> {
  if (!cachedAccessToken) {
    throw new Error('Log ind med Google først.');
  }
  const res = await fetch('/api/drive', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cachedAccessToken}`,
    },
    body: JSON.stringify({ mode: 'file', file }),
  });
  const data = (await res.json()) as { legalCase?: LegalCase; error?: string };
  if (!res.ok || !data.legalCase) {
    throw new Error(data.error || 'Kunne ikke importere dokument fra Google Drive.');
  }
  return data.legalCase;
}

export async function importDriveFolderAsCase(
  folderId: string,
  folderName: string
): Promise<LegalCase> {
  if (!cachedAccessToken) {
    throw new Error('Log ind med Google først.');
  }
  const res = await fetch('/api/drive', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cachedAccessToken}`,
    },
    body: JSON.stringify({ mode: 'folder', folderId, folderName }),
  });
  const data = (await res.json()) as { legalCase?: LegalCase; error?: string };
  if (!res.ok || !data.legalCase) {
    throw new Error(data.error || 'Kunne ikke importere sagsmappe fra Google Drive.');
  }
  return data.legalCase;
}
