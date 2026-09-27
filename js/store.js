import { DEFAULT_SETTINGS } from "./config.js";

const SETTINGS_KEY = "trafficMonitor.settings.v3";
const LOCATION_KEY = "trafficMonitor.location.v3";
const NOTIFICATIONS_KEY = "trafficMonitor.notifications.v3";
const MONITOR_KEY = "trafficMonitor.monitor.v3";

/*
 * localStorage.getItem()은 값이 없으면 null을 반환합니다.
 *
 * JSON.parse(null)은 예외가 아니라 null을 반환하기 때문에,
 * 단순 try/catch만으로는 fallback 값이 적용되지 않습니다.
 *
 * 따라서 null / undefined / 빈 문자열 / "null"을 먼저 검사하고,
 * JSON.parse 결과 자체가 null이어도 fallback을 반환합니다.
 */
function safeParse(raw, fallback) {
  if (
    raw === null ||
    raw === undefined ||
    raw === "" ||
    raw === "null"
  ) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);

    return parsed ?? fallback;
  } catch (error) {
    console.warn(
      "[storage] 저장 데이터를 읽는 중 오류가 발생했습니다.",
      error
    );

    return fallback;
  }
}


// ==========================================================
// Settings
// ==========================================================

export function loadSettings() {
  const stored = safeParse(
    localStorage.getItem(SETTINGS_KEY),
    {}
  );

  const safeStored =
    stored &&
    typeof stored === "object" &&
    !Array.isArray(stored)
      ? stored
      : {};

  return {
    ...DEFAULT_SETTINGS,
    ...safeStored
  };
}


export function saveSettings(settings) {
  const safeSettings =
    settings &&
    typeof settings === "object" &&
    !Array.isArray(settings)
      ? settings
      : {};

  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify(safeSettings)
  );
}


// ==========================================================
// GPS Location
// ==========================================================

export function loadLocationState() {
  const stored = safeParse(
    localStorage.getItem(LOCATION_KEY),
    null
  );

  if (
    stored === null ||
    typeof stored !== "object" ||
    Array.isArray(stored)
  ) {
    return null;
  }

  return stored;
}


export function saveLocationState(state) {
  if (
    state === null ||
    state === undefined
  ) {
    localStorage.removeItem(LOCATION_KEY);
    return;
  }

  localStorage.setItem(
    LOCATION_KEY,
    JSON.stringify(state)
  );
}


// ==========================================================
// Notifications
// ==========================================================

export function loadNotifications() {
  const stored = safeParse(
    localStorage.getItem(NOTIFICATIONS_KEY),
    []
  );

  /*
   * 어떤 이유로 저장값이 null / object / string 등으로
   * 깨져 있어도 앱에서는 항상 배열을 반환합니다.
   */
  return Array.isArray(stored)
    ? stored
    : [];
}


export function saveNotifications(items) {
  const safeItems =
    Array.isArray(items)
      ? items
      : [];

  localStorage.setItem(
    NOTIFICATIONS_KEY,
    JSON.stringify(
      safeItems.slice(0, 500)
    )
  );
}


export function hasNotificationEvent(eventKey) {
  if (!eventKey) {
    return false;
  }

  return loadNotifications().some(
    (item) =>
      item &&
      item.eventKey === eventKey
  );
}


export function addNotification(item) {
  if (
    !item ||
    typeof item !== "object"
  ) {
    return false;
  }

  const items = loadNotifications();

  if (
    item.eventKey &&
    items.some(
      (existing) =>
        existing &&
        existing.eventKey === item.eventKey
    )
  ) {
    return false;
  }

  items.unshift(item);

  saveNotifications(items);

  return true;
}


export function markNotificationRead(id) {
  const items = loadNotifications();

  const target = items.find(
    (item) =>
      item &&
      item.id === id
  );

  if (target) {
    target.read = true;
  }

  saveNotifications(items);
}


export function markAllNotificationsRead() {
  const items = loadNotifications().map(
    (item) => ({
      ...item,
      read: true
    })
  );

  saveNotifications(items);
}


export function clearNotifications() {
  saveNotifications([]);
}


// ==========================================================
// Nearby CCTV Monitor
// ==========================================================

export function loadMonitorState() {
  const stored = safeParse(
    localStorage.getItem(MONITOR_KEY),
    null
  );

  if (
    stored === null ||
    typeof stored !== "object" ||
    Array.isArray(stored)
  ) {
    return null;
  }

  return stored;
}


export function saveMonitorState(state) {
  if (
    state === null ||
    state === undefined
  ) {
    localStorage.removeItem(MONITOR_KEY);
    return;
  }

  localStorage.setItem(
    MONITOR_KEY,
    JSON.stringify(state)
  );
}


export function clearMonitorState() {
  localStorage.removeItem(MONITOR_KEY);
}
