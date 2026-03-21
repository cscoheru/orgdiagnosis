/**
 * Draft Storage - Unified Draft Management System
 *
 * Features:
 * - Auto-save with debounce
 * - Device ID for anonymous users
 * - Cross-page draft support
 * - Error recovery
 * - Draft expiration management
 *
 * @created 2026-03-20
 */

// Storage keys
const DEVICE_ID_KEY = 'deepconsult_device_id';
const DRAFT_PREFIX = 'deepconsult_draft_';
const DRAFT_META_KEY = 'deepconsult_draft_meta';

// Configuration
const AUTOSAVE_DELAY = 1000; // 1 second debounce
const DRAFT_EXPIRY_HOURS = 72; // 72 hours (3 days)

export interface DraftMeta {
  id: string;
  type: 'requirement' | 'diagnosis' | 'report';
  createdAt: number;
  updatedAt: number;
  device_id: string;
  user_id?: string;
}

export interface SavedDraft<T> {
  data: T;
  meta: DraftMeta;
}

/**
 * Generate or retrieve device ID for anonymous users
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';

  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * Get user identifier (logged-in user ID or device ID)
 */
export function getUserId(): string {
  // Try to get logged-in user ID from various sources
  if (typeof window !== 'undefined') {
    // Check for auth token in localStorage
    const authUser = localStorage.getItem('user');
    if (authUser) {
      try {
        const user = JSON.parse(authUser);
        return user.id || user.email || getDeviceId();
      } catch {
        // Ignore parse errors
      }
    }

    // Check for session storage
    const sessionUser = sessionStorage.getItem('user');
    if (sessionUser) {
      try {
        const user = JSON.parse(sessionUser);
        return user.id || user.email || getDeviceId();
      } catch {
        // Ignore parse errors
      }
    }
  }

  return getDeviceId();
}

/**
 * DraftStorage class for managing form drafts
 */
export class DraftStorage<T> {
  private storageKey: string;
  private type: 'requirement' | 'diagnosis' | 'report';
  private saveTimeout: NodeJS.Timeout | null = null;
  private onStatusChange?: (status: 'idle' | 'saving' | 'saved' | 'error') => void;

  constructor(
    type: 'requirement' | 'diagnosis' | 'report',
    onStatusChange?: (status: 'idle' | 'saving' | 'saved' | 'error') => void
  ) {
    this.type = type;
    this.storageKey = `${DRAFT_PREFIX}${type}`;
    this.onStatusChange = onStatusChange;
  }

  /**
   * Save draft with debouncing
   */
  save(data: T, immediate: boolean = false): void {
    if (typeof window === 'undefined') return;

    // Clear previous timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    const doSave = () => {
      try {
        this.onStatusChange?.('saving');

        const draft: SavedDraft<T> = {
          data,
          meta: {
            id: `${this.type}_${Date.now()}`,
            type: this.type,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            device_id: getDeviceId(),
            user_id: getUserId(),
          }
        };

        // Check if there's existing draft to preserve createdAt
        const existing = this.loadMeta();
        if (existing) {
          draft.meta.createdAt = existing.createdAt;
          draft.meta.id = existing.id;
        }

        localStorage.setItem(this.storageKey, JSON.stringify(draft));

        // Update draft meta index
        this.updateMetaIndex(draft.meta);

        this.onStatusChange?.('saved');
        console.log(`[DraftStorage] Saved ${this.type} draft`);
      } catch (error) {
        console.error('[DraftStorage] Save failed:', error);
        this.onStatusChange?.('error');
      }
    };

    if (immediate) {
      doSave();
    } else {
      this.saveTimeout = setTimeout(doSave, AUTOSAVE_DELAY);
    }
  }

  /**
   * Load draft from storage
   */
  load(): T | null {
    if (typeof window === 'undefined') return null;

    try {
      const saved = localStorage.getItem(this.storageKey);
      if (!saved) return null;

      const draft: SavedDraft<T> = JSON.parse(saved);

      // Check expiration
      const age = Date.now() - draft.meta.updatedAt;
      const expiryMs = DRAFT_EXPIRY_HOURS * 60 * 60 * 1000;

      if (age > expiryMs) {
        console.log(`[DraftStorage] Draft expired (${Math.floor(age / 1000 / 60 / 60)} hours old)`);
        this.clear();
        return null;
      }

      // Check device/user ownership
      const currentUserId = getUserId();
      if (draft.meta.user_id !== currentUserId && draft.meta.device_id !== getDeviceId()) {
        console.log('[DraftStorage] Draft belongs to different user/device');
        return null;
      }

      console.log(`[DraftStorage] Loaded ${this.type} draft (${Math.floor(age / 1000 / 60)} minutes old)`);
      return draft.data;
    } catch (error) {
      console.error('[DraftStorage] Load failed:', error);
      return null;
    }
  }

  /**
   * Load draft metadata only
   */
  loadMeta(): DraftMeta | null {
    if (typeof window === 'undefined') return null;

    try {
      const saved = localStorage.getItem(this.storageKey);
      if (!saved) return null;

      const draft: SavedDraft<T> = JSON.parse(saved);
      return draft.meta;
    } catch {
      return null;
    }
  }

  /**
   * Check if draft exists
   */
  exists(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(this.storageKey) !== null;
  }

  /**
   * Get draft age in milliseconds
   */
  getAge(): number | null {
    const meta = this.loadMeta();
    if (!meta) return null;
    return Date.now() - meta.updatedAt;
  }

  /**
   * Get human-readable draft age
   */
  getAgeText(): string | null {
    const age = this.getAge();
    if (age === null) return null;

    const minutes = Math.floor(age / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    return '刚刚';
  }

  /**
   * Clear draft
   */
  clear(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(this.storageKey);
      this.removeMetaIndex();
      console.log(`[DraftStorage] Cleared ${this.type} draft`);
    } catch (error) {
      console.error('[DraftStorage] Clear failed:', error);
    }
  }

  /**
   * Update meta index for cross-page draft discovery
   */
  private updateMetaIndex(meta: DraftMeta): void {
    try {
      const indexStr = localStorage.getItem(DRAFT_META_KEY);
      const index: Record<string, DraftMeta> = indexStr ? JSON.parse(indexStr) : {};
      index[this.type] = meta;
      localStorage.setItem(DRAFT_META_KEY, JSON.stringify(index));
    } catch (error) {
      console.error('[DraftStorage] Failed to update meta index:', error);
    }
  }

  /**
   * Remove from meta index
   */
  private removeMetaIndex(): void {
    try {
      const indexStr = localStorage.getItem(DRAFT_META_KEY);
      if (!indexStr) return;

      const index: Record<string, DraftMeta> = JSON.parse(indexStr);
      delete index[this.type];
      localStorage.setItem(DRAFT_META_KEY, JSON.stringify(index));
    } catch (error) {
      console.error('[DraftStorage] Failed to remove from meta index:', error);
    }
  }

  /**
   * Get all drafts for current user/device
   */
  static getAllDrafts(): Record<string, DraftMeta> {
    if (typeof window === 'undefined') return {};

    try {
      const indexStr = localStorage.getItem(DRAFT_META_KEY);
      if (!indexStr) return {};

      const index: Record<string, DraftMeta> = JSON.parse(indexStr);
      const currentUserId = getUserId();
      const currentDeviceId = getDeviceId();

      // Filter by ownership
      const filtered: Record<string, DraftMeta> = {};
      for (const [type, meta] of Object.entries(index)) {
        if (meta.user_id === currentUserId || meta.device_id === currentDeviceId) {
          filtered[type] = meta;
        }
      }

      return filtered;
    } catch {
      return {};
    }
  }

  /**
   * Clean up expired drafts
   */
  static cleanupExpired(): void {
    if (typeof window === 'undefined') return;

    try {
      const indexStr = localStorage.getItem(DRAFT_META_KEY);
      if (!indexStr) return;

      const index: Record<string, DraftMeta> = JSON.parse(indexStr);
      const expiryMs = DRAFT_EXPIRY_HOURS * 60 * 60 * 1000;
      let hasChanges = false;

      for (const [type, meta] of Object.entries(index)) {
        const age = Date.now() - meta.updatedAt;
        if (age > expiryMs) {
          // Remove expired draft
          localStorage.removeItem(`${DRAFT_PREFIX}${type}`);
          delete index[type];
          hasChanges = true;
          console.log(`[DraftStorage] Cleaned up expired ${type} draft`);
        }
      }

      if (hasChanges) {
        localStorage.setItem(DRAFT_META_KEY, JSON.stringify(index));
      }
    } catch (error) {
      console.error('[DraftStorage] Cleanup failed:', error);
    }
  }
}

/**
 * Create a draft storage hook for React components
 */
export function useDraftStorage<T>(
  type: 'requirement' | 'diagnosis' | 'report',
  onDataChange: (data: T) => void
) {
  const storage = new DraftStorage<T>(type);

  return {
    save: (data: T, immediate?: boolean) => storage.save(data, immediate),
    load: () => storage.load(),
    clear: () => storage.clear(),
    exists: () => storage.exists(),
    getAge: () => storage.getAge(),
    getAgeText: () => storage.getAgeText(),
  };
}

// Run cleanup on module load
if (typeof window !== 'undefined') {
  DraftStorage.cleanupExpired();
}
