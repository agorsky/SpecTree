import * as semver from 'semver';

export interface VersionInfo {
  current: string;
  latest: string;
  needsUpdate: boolean;
  updateAvailable?: string | undefined;
}

export class VersionResolver {
  /**
   * Compare two versions and determine if an update is available
   */
  static compareVersions(current: string, latest: string): VersionInfo {
    const needsUpdate = semver.lt(current, latest);
    return {
      current,
      latest,
      needsUpdate,
      updateAvailable: needsUpdate ? latest : undefined,
    };
  }

  /**
   * Find the best matching version from available versions
   */
  static resolveVersion(
    requestedVersion: string | undefined,
    availableVersions: string[]
  ): string | null {
    if (!availableVersions.length) {
      return null;
    }

    // Sort versions in descending order
    const sorted = availableVersions
      .filter((v) => semver.valid(v))
      .sort((a, b) => semver.rcompare(a, b));

    if (!sorted.length) {
      return null;
    }

    // If no version specified, return latest
    if (!requestedVersion || requestedVersion === 'latest') {
      return sorted[0] ?? null;
    }

    // Try to find exact match
    const exactMatch = sorted.find((v) => v === requestedVersion);
    if (exactMatch) {
      return exactMatch;
    }

    // Try to find matching range
    const rangeMatch = sorted.find((v) => semver.satisfies(v, requestedVersion));
    if (rangeMatch) {
      return rangeMatch;
    }

    return null;
  }

  /**
   * Get all versions that need updates
   */
  static findUpdates(
    installedPacks: Record<string, { version: string }>,
    availableVersions: Record<string, string>
  ): Record<string, VersionInfo> {
    const updates: Record<string, VersionInfo> = {};

    for (const [packName, installed] of Object.entries(installedPacks)) {
      const latest = availableVersions[packName];
      if (latest) {
        const info = this.compareVersions(installed.version, latest);
        if (info.needsUpdate) {
          updates[packName] = info;
        }
      }
    }

    return updates;
  }

  /**
   * Validate a version string
   */
  static isValidVersion(version: string): boolean {
    return semver.valid(version) !== null;
  }

  /**
   * Validate a version range
   */
  static isValidRange(range: string): boolean {
    return semver.validRange(range) !== null;
  }
}
