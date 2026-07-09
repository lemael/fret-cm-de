export type VersionInfo = {
  latestVersion: string;
  versionCode: number;
  apkUrl: string;
  mandatory: boolean;
};

const isVersionInfo = (value: any): value is VersionInfo =>
  value &&
  typeof value.latestVersion === 'string' &&
  typeof value.versionCode === 'number' &&
  typeof value.apkUrl === 'string' &&
  typeof value.mandatory === 'boolean';

// Ne jette jamais : un check de mise à jour ne doit pas empêcher le démarrage
// de l'app si le réseau est indisponible ou si le fichier est mal formé.
export async function fetchLatestVersionInfo(url: string): Promise<VersionInfo | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    return isVersionInfo(json) ? json : null;
  } catch {
    return null;
  }
}

export const isNewerVersion = (remoteCode: number, installedCode: number) => remoteCode > installedCode;
