/**
 * RateLimiter - Client-side rate limiting for abuse prevention
 * Uses localStorage + IndexedDB backup for persistent tracking
 * Includes browser fingerprinting to detect localStorage clearing
 */

const STORAGE_KEY = 'huey_rate_limit';
const IDB_NAME = 'huey_rl_backup';
const IDB_STORE = 'limits';

export const LIMITS = {
  DAILY_VISUALIZATIONS: 7,
  HOURLY_VISUALIZATIONS: 2,
  MIN_COOLDOWN_SECONDS: 5,
  MAX_COOLDOWN_SECONDS: 15,
  MAX_UNIQUE_IMAGES_PER_DAY: 3,
  PROGRESSIVE_DELAY_ENABLED: true,
};

interface RateLimitData {
  daily: {
    date: string; // YYYY-MM-DD
    count: number;
    lastReset: number; // Timestamp
  };
  hourly: {
    window: number; // Start of current hour (timestamp)
    count: number;
    requests: number[]; // Array of request timestamps in current hour
  };
  lastRequest: number; // Timestamp
  images: string[]; // Image hashes uploaded today
  cooldownUntil: number; // Timestamp when cooldown expires
}

interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  waitTime?: number; // Seconds until next allowed request
  dailyRemaining?: number;
  hourlyRemaining?: number;
  timeUntilDailyReset?: number; // Milliseconds
}

/**
 * Get current date string (YYYY-MM-DD) in UTC
 */
function getTodayString(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Get start of current hour (timestamp) in UTC
 */
function getCurrentHourWindow(): number {
  const now = new Date();
  const hourStart = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours()
  ));
  return hourStart.getTime();
}

/**
 * Get time until next day reset (midnight UTC) in milliseconds
 */
function getTimeUntilDailyReset(): number {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return tomorrow.getTime() - now.getTime();
}

/**
 * Get time until next hour reset in milliseconds
 */
function getTimeUntilHourlyReset(): number {
  const now = new Date();
  const nextHour = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours() + 1,
    0, 0, 0, 0
  ));
  return nextHour.getTime() - now.getTime();
}

/**
 * Generate a simple browser fingerprint for backup storage key
 * Not for tracking - just to detect localStorage clearing
 */
function getBrowserFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'fallback';
    
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('huey-fp', 2, 2);
    
    const data = canvas.toDataURL().slice(-50); // Last 50 chars
    const nav = navigator.userAgent + navigator.language + screen.width + screen.height;
    
    // Simple hash
    let hash = 0;
    const combined = data + nav;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) - hash) + combined.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  } catch {
    return 'fallback';
  }
}

/**
 * IndexedDB backup storage (harder to clear than localStorage)
 */
async function loadFromIDB(): Promise<RateLimitData | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_NAME, 1);
      
      request.onerror = () => resolve(null);
      
      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const fp = getBrowserFingerprint();
        const getReq = store.get(fp);
        
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

async function saveToIDB(data: RateLimitData): Promise<void> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_NAME, 1);
      
      request.onerror = () => resolve();
      
      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        const fp = getBrowserFingerprint();
        store.put(data, fp);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
    } catch {
      resolve();
    }
  });
}

/**
 * Load rate limit data from localStorage (with IDB backup check)
 */
function loadData(): RateLimitData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.warn('Failed to load rate limit data:', error);
    return null;
  }
}

/**
 * Load data with backup check - detects localStorage clearing
 */
async function loadDataWithBackup(): Promise<RateLimitData | null> {
  const localData = loadData();
  
  // If localStorage has data, use it
  if (localData) {
    // Also save to IDB as backup
    saveToIDB(localData);
    return localData;
  }
  
  // localStorage empty - check IDB backup (detects clearing)
  const idbData = await loadFromIDB();
  if (idbData) {
    // Restore from backup - user may have cleared localStorage
    console.warn('Rate limit data restored from backup');
    saveData(idbData); // Restore to localStorage
    return idbData;
  }
  
  return null;
}

/**
 * Save rate limit data to localStorage and IDB backup
 */
function saveData(data: RateLimitData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // Async backup to IDB (non-blocking)
    saveToIDB(data);
  } catch (error) {
    console.warn('Failed to save rate limit data:', error);
  }
}

/**
 * Initialize or reset rate limit data
 */
function initializeData(): RateLimitData {
  const today = getTodayString();
  const now = Date.now();
  const currentHour = getCurrentHourWindow();

  return {
    daily: {
      date: today,
      count: 0,
      lastReset: now,
    },
    hourly: {
      window: currentHour,
      count: 0,
      requests: [],
    },
    lastRequest: 0,
    images: [],
    cooldownUntil: 0,
  };
}

// Flag to track if we've done the initial backup check
let hasCheckedBackup = false;

/**
 * Initialize rate limiter - call once on app start to check backups
 */
export async function initRateLimiter(): Promise<void> {
  if (hasCheckedBackup) return;
  hasCheckedBackup = true;
  
  const localData = loadData();
  if (!localData) {
    // Check IDB backup
    const backupData = await loadFromIDB();
    if (backupData) {
      console.warn('Rate limit restored from backup (localStorage was cleared)');
      saveData(backupData);
    }
  }
}

/**
 * Get or initialize rate limit data, resetting if needed
 */
function getData(): RateLimitData {
  const today = getTodayString();
  const now = Date.now();
  const currentHour = getCurrentHourWindow();
  
  let data = loadData();
  
  // Initialize if no data exists
  if (!data) {
    data = initializeData();
    saveData(data);
    return data;
  }
  
  // Reset daily count if it's a new day
  if (data.daily.date !== today) {
    data.daily = {
      date: today,
      count: 0,
      lastReset: now,
    };
    data.images = []; // Reset image list for new day
  }
  
  // Reset hourly count if it's a new hour
  if (data.hourly.window !== currentHour) {
    data.hourly = {
      window: currentHour,
      count: 0,
      requests: [],
    };
  }
  
  // Clean up old hourly requests (keep only last hour)
  data.hourly.requests = data.hourly.requests.filter(
    timestamp => timestamp >= currentHour
  );
  data.hourly.count = data.hourly.requests.length;
  
  saveData(data);
  return data;
}

/**
 * Calculate progressive cooldown based on request count
 */
function calculateCooldown(requestCount: number): number {
  if (!LIMITS.PROGRESSIVE_DELAY_ENABLED) {
    return LIMITS.MIN_COOLDOWN_SECONDS;
  }
  
  // Progressive: 5s, 10s, 15s, then cap at 15s
  const progressiveDelay = Math.min(
    LIMITS.MIN_COOLDOWN_SECONDS + (requestCount - 1) * 5,
    LIMITS.MAX_COOLDOWN_SECONDS
  );
  
  return progressiveDelay;
}

/**
 * Check if a request is allowed based on rate limits
 */
export function checkRateLimit(): RateLimitResult {
  const data = getData();
  const now = Date.now();
  
  // Check cooldown
  if (data.cooldownUntil > now) {
    const waitTime = Math.ceil((data.cooldownUntil - now) / 1000);
    return {
      allowed: false,
      reason: `Please wait ${waitTime} second${waitTime !== 1 ? 's' : ''} before your next request.`,
      waitTime,
      dailyRemaining: LIMITS.DAILY_VISUALIZATIONS - data.daily.count,
      hourlyRemaining: LIMITS.HOURLY_VISUALIZATIONS - data.hourly.count,
    };
  }
  
  // Check daily limit
  if (data.daily.count >= LIMITS.DAILY_VISUALIZATIONS) {
    const timeUntilReset = getTimeUntilDailyReset();
    const hours = Math.floor(timeUntilReset / (1000 * 60 * 60));
    const minutes = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));
    
    return {
      allowed: false,
      reason: `Daily limit reached (${LIMITS.DAILY_VISUALIZATIONS}/${LIMITS.DAILY_VISUALIZATIONS}). Resets in ${hours}h ${minutes}m.`,
      timeUntilDailyReset: timeUntilReset,
      dailyRemaining: 0,
      hourlyRemaining: LIMITS.HOURLY_VISUALIZATIONS - data.hourly.count,
    };
  }
  
  // Check hourly limit
  if (data.hourly.count >= LIMITS.HOURLY_VISUALIZATIONS) {
    const timeUntilReset = getTimeUntilHourlyReset();
    const minutes = Math.ceil(timeUntilReset / (1000 * 60));
    
    return {
      allowed: false,
      reason: `Hourly limit reached (${LIMITS.HOURLY_VISUALIZATIONS}/${LIMITS.HOURLY_VISUALIZATIONS}). Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
      waitTime: Math.ceil(timeUntilReset / 1000),
      dailyRemaining: LIMITS.DAILY_VISUALIZATIONS - data.daily.count,
      hourlyRemaining: 0,
    };
  }
  
  // All checks passed
  return {
    allowed: true,
    dailyRemaining: LIMITS.DAILY_VISUALIZATIONS - data.daily.count,
    hourlyRemaining: LIMITS.HOURLY_VISUALIZATIONS - data.hourly.count,
  };
}

/**
 * Record a successful visualization request
 */
export function recordVisualization(): void {
  const data = getData();
  const now = Date.now();
  const currentHour = getCurrentHourWindow();
  
  // Increment daily count
  data.daily.count += 1;
  
  // Increment hourly count
  if (data.hourly.window === currentHour) {
    data.hourly.count += 1;
    data.hourly.requests.push(now);
  } else {
    // New hour, reset
    data.hourly = {
      window: currentHour,
      count: 1,
      requests: [now],
    };
  }
  
  // Set cooldown
  const cooldownSeconds = calculateCooldown(data.daily.count);
  data.cooldownUntil = now + (cooldownSeconds * 1000);
  data.lastRequest = now;
  
  saveData(data);
}

/**
 * Check if an image was already uploaded today
 */
export function isImageUploadedToday(imageHash: string): boolean {
  const data = getData();
  return data.images.includes(imageHash);
}

/**
 * Record an image upload
 */
export function recordImageUpload(imageHash: string): { allowed: boolean; reason?: string } {
  const data = getData();
  
  // Check if already uploaded today
  if (data.images.includes(imageHash)) {
    // Allow but don't count as new image
    return { allowed: true };
  }
  
  // Check if max unique images reached
  if (data.images.length >= LIMITS.MAX_UNIQUE_IMAGES_PER_DAY) {
    return {
      allowed: false,
      reason: `You've uploaded ${LIMITS.MAX_UNIQUE_IMAGES_PER_DAY} unique images today. Try different colors on your existing images.`,
    };
  }
  
  // Record new image
  data.images.push(imageHash);
  saveData(data);
  
  return { allowed: true };
}

/**
 * Get current rate limit status (for UI display)
 */
export function getRateLimitStatus(): {
  dailyRemaining: number;
  hourlyRemaining: number;
  cooldownUntil: number;
  timeUntilDailyReset: number;
} {
  const data = getData();
  return {
    dailyRemaining: LIMITS.DAILY_VISUALIZATIONS - data.daily.count,
    hourlyRemaining: LIMITS.HOURLY_VISUALIZATIONS - data.hourly.count,
    cooldownUntil: data.cooldownUntil,
    timeUntilDailyReset: getTimeUntilDailyReset(),
  };
}

/**
 * Clear all rate limit data (for testing/admin)
 */
export function clearRateLimitData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear rate limit data:', error);
  }
}

