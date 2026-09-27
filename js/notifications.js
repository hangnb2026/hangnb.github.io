import { addNotification } from "./store.js";

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    return {
      granted: false,
      reason: "현재 브라우저는 Notification API를 지원하지 않습니다."
    };
  }

  const permission = await Notification.requestPermission();

  return {
    granted: permission === "granted",
    permission
  };
}

export function notificationPermissionLabel() {
  if (!("Notification" in window)) return "미지원";

  if (Notification.permission === "granted") return "허용";
  if (Notification.permission === "denied") return "차단";

  return "미설정";
}

export async function showSystemNotification(title, body, hash) {
  if (
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return false;
  }

  if (!("serviceWorker" in navigator)) {
    return false;
  }

  const registration = await navigator.serviceWorker.ready;

  const targetUrl = new URL("./", window.location.href);
  targetUrl.hash = hash.replace(/^#/, "");

  await registration.showNotification(title, {
    body,
    icon: "./assets/icon-192.png",
    badge: "./assets/icon-192.png",
    tag: `${title}:${body}`,
    renotify: false,
    data: {
      url: targetUrl.href
    }
  });

  return true;
}

export async function recordEvent(cctv, event, settings) {
  // '알림 사용'은 시스템 알림뿐 아니라 앱 내 토스트와 알림함 기록까지
  // 모두 끄는 단일 스위치다. 꺼진 동안의 이벤트는 저장하지 않는다.
  if (!settings?.notificationsEnabled) {
    return false;
  }

  // 기본값은 신호 위반만 알린다. 고위험 과속은 사용자가 설정에서
  // 명시적으로 포함했을 때에만 알림·기록한다.
  if (
    event.type === "overspeed" &&
    settings.alertPolicy !== "risk"
  ) {
    return false;
  }

  const hash =
    `#/cctv/${encodeURIComponent(cctv.id)}` +
    `?vehicle=${encodeURIComponent(event.vehicleId)}` +
    `&frame=${encodeURIComponent(event.frame)}`;

  const item = {
    id:
      `${Date.now()}-` +
      Math.random().toString(16).slice(2),

    eventKey: event.eventKey,
    cctvId: cctv.id,
    cctvName: cctv.name,
    vehicleId: event.vehicleId,
    frame: event.frame,
    type: event.type,
    label: event.label,
    message: event.message,
    createdAt: new Date().toISOString(),
    read: false,
    hash
  };

  const inserted = addNotification(item);
  if (!inserted) return false;

  await showSystemNotification(
    `${cctv.name} · ${event.label}`,
    event.message,
    hash
  );

  return true;
}
