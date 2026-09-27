import {
  CCTV_LIST,
  getCctv
} from "./config.js";

import {
  loadSettings,
  saveSettings,
  loadLocationState,
  saveLocationState,
  loadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearNotifications
} from "./store.js";

import {
  getCurrentPosition,
  evaluateNearby
} from "./gps.js";

import {
  loadCctvData
} from "./data.js";

import {
  analyzeAtFrame,
  buildCctvEvents,
  eventsBetweenFrames
} from "./analysis.js";

import {
  VideoController
} from "./video.js";

import {
  createViolationHeatmap
} from "./heatmap.js";

import {
  requestNotificationPermission,
  notificationPermissionLabel,
  recordEvent
} from "./notifications.js";

import {
  NearbyMonitor
} from "./monitor.js";

const app = document.querySelector("#app");
const backButton = document.querySelector("#backButton");
const topTitle = document.querySelector("#topTitle");
const topEyebrow = document.querySelector("#topEyebrow");
const topAction = document.querySelector("#topAction");
const notificationBadge = document.querySelector("#notificationBadge");
const toastArea = document.querySelector("#toastArea");

let settings = loadSettings();
let locationState = loadLocationState();
let activeCleanup = null;
let deferredInstallPrompt = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function numberText(value, digits = 1) {
  return Number.isFinite(Number(value))
    ? Number(value).toFixed(digits)
    : "-";
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;

  // 알림이 연속으로 발생해도 화면을 덮지 않도록
  // 가장 최근 알림 하나만 상단에 표시한다.
  toastArea.replaceChildren(node);

  window.setTimeout(() => {
    if (node.isConnected) {
      node.remove();
    }
  }, 2800);
}

function setTopbar({
  title,
  eyebrow = "",
  showBack = false,
  actionHtml = ""
}) {
  topTitle.textContent = title;
  topEyebrow.textContent = eyebrow;
  topEyebrow.classList.toggle(
    "hidden",
    !eyebrow
  );
  backButton.classList.toggle("hidden", !showBack);
  topAction.innerHTML = actionHtml;
}

backButton.addEventListener("click", () => {
  if (history.length > 1) {
    history.back();
  } else {
    location.hash = "#/";
  }
});

function setActiveNav(name) {
  document
    .querySelectorAll("[data-nav]")
    .forEach((item) => {
      item.classList.toggle(
        "active",
        item.dataset.nav === name
      );
    });
}

function updateNotificationBadge() {
  /*
   * store.js에서도 항상 배열을 반환하지만,
   * 앱 초기화가 저장 데이터 이상 때문에 중단되지 않도록
   * 여기에서도 한 번 더 방어합니다.
   */
  const loaded =
    loadNotifications();

  const notifications =
    Array.isArray(loaded)
      ? loaded
      : [];

  const unreadCount =
    settings.notificationsEnabled
      ? notifications.filter(
          (item) =>
            item &&
            item.read !== true &&
            (
              settings.alertPolicy === "risk" ||
              item.type !== "overspeed"
            )
        ).length
      : 0;

  notificationBadge.textContent =
    String(unreadCount);

  notificationBadge.classList.toggle(
    "hidden",
    unreadCount === 0
  );
}

function parseRoute() {
  const raw = location.hash || "#/";
  const withoutHash = raw.slice(1);

  const [pathRaw, queryRaw = ""] =
    withoutHash.split("?");

  const path = pathRaw || "/";
  const params = new URLSearchParams(queryRaw);

  if (path.startsWith("/cctv/")) {
    return {
      name: "cctv",
      cctvId:
        decodeURIComponent(path.split("/")[2] || ""),
      params
    };
  }

  if (path === "/notifications") {
    return {
      name: "notifications",
      params
    };
  }

  if (path === "/settings") {
    return {
      name: "settings",
      params
    };
  }

  return {
    name: "home",
    params
  };
}

function nearbyMap() {
  return new Map(
    (locationState?.results || [])
      .map((item) => [item.cctvId, item])
  );
}

function isNearby(cctvId) {
  return nearbyMap().get(cctvId)?.nearby === true;
}

const nearbyMonitor = new NearbyMonitor(
  () => settings,
  (cctv, event) => {
    if (settings.notificationsEnabled) {
      toast(
        `${cctv.name} · ${event.label} · ${event.vehicleId}번 차량`
      );
    }

    updateNotificationBadge();
  }
);

nearbyMonitor.start();

function renderHome() {
  setTopbar({
    title: "Traffic 도우미"
  });

  setActiveNav("home");

  const stateMap = nearbyMap();

  const checkedText =
    locationState?.checkedAt
      ? new Date(locationState.checkedAt)
          .toLocaleString("ko-KR")
      : "위치 미확인";

  app.innerHTML = `
    <section class="hero monitor-hero">
      <div class="hero-topline">
        <span class="hero-kicker">LIVE TRAFFIC INTELLIGENCE</span>
        <span class="network-pill">${CCTV_LIST.length} CAMERAS</span>
      </div>
      <h2>Traffic Monitor</h2>

      <p>
        원본·객체 탐지·Twin 영상을 같은 시점에서 비교하고,
        위험 신호와 차량 흐름을 빠르게 확인하세요.
      </p>

      <div class="hero-actions">
        <button
          id="gpsSearchButton"
          class="primary-button"
          type="button"
        >
          내 주변 확인
        </button>
        <span class="hero-location-state">
          ${locationState?.checkedAt ? "위치 확인됨" : "위치 확인 필요"}
        </span>
      </div>
    </section>

    <div class="monitor-summary">
      <div class="summary-item">
        <span>NETWORK</span>
        <strong>${CCTV_LIST.length}</strong>
        <small>개 카메라</small>
      </div>
      <div class="summary-item summary-location">
        <span>LOCATION</span>
        <strong>${locationState?.accuracy ? `±${Math.round(locationState.accuracy)}m` : "—"}</strong>
        <small>${escapeHtml(checkedText)}</small>
      </div>
    </div>

    <section>
      <div class="section-heading section-heading-monitor">
        <div>
          <span class="section-eyebrow">CAMERA DIRECTORY</span>
          <h2>전체 CCTV</h2>
        </div>
        <small>${CCTV_LIST.length} Streams</small>
      </div>

      <div class="cctv-grid cctv-grid-monitor">
        ${CCTV_LIST.map((cctv) => {
          const state = stateMap.get(cctv.id);
          const active = state?.nearby === true;
          const subText =
            state?.distanceM != null
              ? `${Math.round(state.distanceM)}m`
              : "위치 미확인";

          return `
            <a
              class="cctv-card"
              href="#/cctv/${encodeURIComponent(cctv.id)}"
            >
              <div class="cctv-card-top">
                <span class="camera-area">${escapeHtml(cctv.area)}</span>
                <span class="status-text ${active ? "active" : ""}">
                  <i class="status-dot ${active ? "active" : ""}"></i>
                  ${active ? "근처" : "대기"}
                </span>
              </div>

              <div>
                <h3>${escapeHtml(cctv.name)}</h3>
                <p>${escapeHtml(subText)}</p>
              </div>

              <span class="card-arrow">↗</span>
            </a>
          `;
        }).join("")}
      </div>
    </section>
  `;

  document
    .querySelector("#gpsSearchButton")
    .addEventListener("click", async (event) => {
      const button = event.currentTarget;

      button.disabled = true;
      button.textContent = "확인 중…";

      try {
        const position = await getCurrentPosition();

        locationState = evaluateNearby(
          CCTV_LIST,
          position,
          Number(settings.gpsRadiusOverrideM) || 0
        );

        saveLocationState(locationState);
        nearbyMonitor.startNew();

        toast("위치를 업데이트했습니다.");
        renderHome();
      } catch (error) {
        toast(error.message);

        button.disabled = false;
        button.textContent = "위치 확인";
      }
    });
}

function renderNotifications() {
  setTopbar({
    title: "알림",
    actionHtml:
      `<button id="markAllRead" class="text-button" type="button">모두 읽음</button>`
  });

  setActiveNav("notifications");

  const notifications = loadNotifications()
    .filter((item) =>
      settings.alertPolicy === "risk" ||
      item.type !== "overspeed"
    );

  if (!notifications.length) {
    app.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">♢</div>
        <h2>새 알림이 없습니다</h2>
      </div>
    `;
  } else {
    app.innerHTML = `
      <div class="notification-list">
        ${notifications.map((item) => `
          <a
            class="notification-card ${item.read ? "" : "unread"}"
            href="${escapeHtml(item.hash)}"
            data-notification-id="${escapeHtml(item.id)}"
          >
            <div class="notification-head">
              <span class="notification-source">
                ${escapeHtml(item.cctvName)}
              </span>

              <span class="event-pill ${item.type}">
                ${escapeHtml(item.label)}
              </span>
            </div>

            <strong>
              ${escapeHtml(item.vehicleId)}번 차량
            </strong>

            <p>
              ${escapeHtml(item.message)}
            </p>

            <div class="notification-meta">
              <span>
                Frame ${escapeHtml(item.frame)}
              </span>

              <span>
                ${new Date(item.createdAt).toLocaleString("ko-KR")}
              </span>
            </div>
          </a>
        `).join("")}
      </div>
    `;
  }

  document
    .querySelector("#markAllRead")
    ?.addEventListener("click", () => {
      markAllNotificationsRead();
      updateNotificationBadge();
      renderNotifications();
    });

  document
    .querySelectorAll("[data-notification-id]")
    .forEach((node) => {
      node.addEventListener("click", () => {
        markNotificationRead(
          node.dataset.notificationId
        );

        updateNotificationBadge();
      });
    });
}

function renderSettings() {
  setTopbar({
    title: "설정"
  });

  setActiveNav("settings");

  app.innerHTML = `
    <div class="settings-stack">
      <section class="setting-card">
        <div class="setting-copy">
          <h2>알림</h2>
          <p>
            권한
            <strong>${escapeHtml(notificationPermissionLabel())}</strong>
          </p>
        </div>

        <label class="setting-row">
          <span>
            알림 사용
            <small>앱 팝업 · 브라우저 알림 · 알림함</small>
          </span>
          <input
            id="notificationsEnabled"
            type="checkbox"
            ${settings.notificationsEnabled ? "checked" : ""}
          >
        </label>

        <label class="number-setting alert-policy-setting">
          <span>
            알림 기준
            <small>기본값은 신호 위반만 알립니다.</small>
          </span>
          <select id="alertPolicy">
            <option value="violation" ${settings.alertPolicy === "violation" ? "selected" : ""}>신호 위반만</option>
            <option value="risk" ${settings.alertPolicy === "risk" ? "selected" : ""}>고위험 과속 포함</option>
          </select>
        </label>

        <button
          id="requestNotificationPermission"
          class="secondary-button"
          type="button"
        >
          알림 권한 설정
        </button>
      </section>

      <section class="setting-card">
        <div class="setting-copy">
          <h2>위치 감지</h2>
        </div>

        <label class="number-setting">
          <span>
            감지 반경
            <small>변경 즉시 마지막 위치 기준으로 다시 계산합니다.</small>
          </span>
          <div>
            <input
              id="gpsRadius"
              type="number"
              min="100"
              max="5000"
              step="50"
              value="${escapeHtml(settings.gpsRadiusOverrideM)}"
            >
            <small>m</small>
          </div>
        </label>
      </section>

      <section class="setting-card">
        <div class="setting-copy">
          <h2>앱 설치</h2>
        </div>

        <button
          id="installApp"
          class="secondary-button"
          type="button"
          ${deferredInstallPrompt ? "" : "disabled"}
        >
          ${
            deferredInstallPrompt
              ? "설치"
              : "설치 옵션 없음"
          }
        </button>
      </section>

      <section class="setting-card">
        <div class="setting-copy">
          <h2>알림 기록</h2>
        </div>

        <button
          id="clearNotificationHistory"
          class="danger-button"
          type="button"
        >
          전체 삭제
        </button>
      </section>
    </div>
  `;

  document
    .querySelector("#notificationsEnabled")
    .addEventListener("change", (event) => {
      settings.notificationsEnabled =
        event.target.checked;

      saveSettings(settings);
      updateNotificationBadge();

      if (settings.notificationsEnabled) {
        toast("알림이 켜졌습니다.");
      }
    });

  document
    .querySelector("#alertPolicy")
    .addEventListener("change", (event) => {
      settings.alertPolicy = event.target.value;
      saveSettings(settings);
      updateNotificationBadge();
      toast(
        settings.alertPolicy === "risk"
          ? "신호 위반과 고위험 과속을 알립니다."
          : "신호 위반만 알립니다."
      );
    });

  document
    .querySelector("#gpsRadius")
    .addEventListener("change", (event) => {
      settings.gpsRadiusOverrideM = Math.max(
        100,
        Number(event.target.value) || 500
      );

      saveSettings(settings);

      if (
        Number.isFinite(locationState?.latitude) &&
        Number.isFinite(locationState?.longitude)
      ) {
        locationState = evaluateNearby(
          CCTV_LIST,
          {
            coords: {
              latitude: locationState.latitude,
              longitude: locationState.longitude,
              accuracy: locationState.accuracy
            }
          },
          settings.gpsRadiusOverrideM
        );

        saveLocationState(locationState);
        nearbyMonitor.startNew();
        toast("감지 반경을 마지막 위치에 적용했습니다.");
      }
    });

  document
    .querySelector("#requestNotificationPermission")
    .addEventListener("click", async () => {
      const result =
        await requestNotificationPermission();

      toast(
        result.granted
          ? "알림이 활성화되었습니다."
          : (
              result.reason ||
              `알림 권한: ${result.permission}`
            )
      );

      renderSettings();
    });

  document
    .querySelector("#clearNotificationHistory")
    .addEventListener("click", () => {
      clearNotifications();
      updateNotificationBadge();
      toast("알림 기록을 삭제했습니다.");
    });

  document
    .querySelector("#installApp")
    .addEventListener("click", async () => {
      if (!deferredInstallPrompt) {
        return;
      }

      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      renderSettings();
    });
}

function signalColor(value) {
  const normalized =
    String(value ?? "").trim().toLowerCase();

  if (
    normalized.includes("red") ||
    normalized === "r" ||
    normalized.includes("빨")
  ) {
    return "red";
  }

  if (
    normalized.includes("green") ||
    normalized === "g" ||
    normalized.includes("초")
  ) {
    return "green";
  }

  if (
    normalized.includes("yellow") ||
    normalized === "y" ||
    normalized.includes("황")
  ) {
    return "yellow";
  }

  return "";
}

function isSignalMetadataKey(key) {
  const normalized =
    String(key ?? "")
      .trim()
      .toLowerCase();

  return (
    normalized.includes("note") ||
    normalized.includes("confidence") ||
    normalized === "conf" ||
    normalized.includes("score") ||
    normalized.includes("prob") ||
    normalized.includes("remark") ||
    normalized.includes("memo") ||
    normalized.includes("비고") ||
    normalized.includes("신뢰")
  );
}

function signalOverlayHtml(signal, frame, timeSec) {
  if (!signal) return "";

  const record = signal.at(frame, timeSec);
  if (!record) return "";

  const entries =
    Object.entries(record.values)
      .filter(([key, value]) =>
        !isSignalMetadataKey(key) &&
        String(value ?? "").trim() !== ""
      )
      .slice(0, 8);

  if (!entries.length) return "";

  return entries.map(([key, value]) => `
    <span
      class="signal-chip ${signalColor(value)}"
    >
      ${escapeHtml(key)} · ${escapeHtml(value)}
    </span>
  `).join("");
}

function statusKorean(status) {
  if (status === "danger") return "위험";
  if (status === "caution") return "주의";
  return "안전";
}

async function renderCctv(route) {
  const cctv = getCctv(route.cctvId);

  if (!cctv) {
    setTopbar({
      title: "CCTV 없음",
      showBack: true
    });

    setActiveNav("");

    app.innerHTML = `
      <div class="empty-state">
        존재하지 않는 CCTV입니다.
      </div>
    `;

    return;
  }

  setTopbar({
    title: cctv.name,
    eyebrow: cctv.area,
    showBack: true
  });

  setActiveNav("");

  app.innerHTML = `
    <div class="loading-card">
      데이터를 불러오는 중…
    </div>
  `;

  let data;

  try {
    data = await loadCctvData(cctv);
  } catch (error) {
    app.innerHTML = `
      <div class="empty-state">
        <h2>데이터를 불러오지 못했습니다</h2>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;

    return;
  }

  let filter = "all";

  const focusedVehicle =
    route.params.get("vehicle");

  const requestedFrame =
    Number(route.params.get("frame"));

  let lastVideoFrame = -1;
  let currentAnalysis = null;
  let lastAnalysisRenderAt = 0;
  let lastHeatmapRenderAt = 0;
  let heatmapScope = "current";

  const cctvEvents =
    buildCctvEvents(cctv, data);

  app.innerHTML = `
    <section class="cctv-workspace">
      <div class="video-column">
        <section class="video-card">
          <div class="video-stage">
            <video
              id="trafficVideo"
              controls
              playsinline
              preload="metadata"
            ></video>

            <div
              id="signalOverlay"
              class="signal-overlay"
            ></div>
          </div>

          <div class="video-meta">
            <span id="videoModeLabel">원본</span>
            <span class="live-indicator">
              <i></i>
              분석 준비됨
            </span>
          </div>
        </section>

        <div class="view-tabs view-tabs-video-only" aria-label="영상 보기 선택">
          <button
            type="button"
            data-video-mode="original"
            class="active"
          >
            원본
          </button>

          <button
            type="button"
            data-video-mode="yolo"
          >
            객체 탐지
          </button>

          <button
            type="button"
            data-video-mode="twin"
          >
            Twin
          </button>
        </div>
      </div>

      <aside class="heatmap-card" aria-labelledby="heatmapTitle">
        <div class="heatmap-heading">
          <div>
            <span class="section-eyebrow">VIOLATION MAP</span>
            <h2 id="heatmapTitle">위반 발생 Heatmap</h2>
          </div>
          <span class="heatmap-source">
            ${escapeHtml(cctv.heatmap?.label || "BEV")}
          </span>
        </div>

        <div class="heatmap-controls">
          <div class="segmented-control" role="group" aria-label="위반 시점 범위">
            <button type="button" data-heatmap-scope="all">전체</button>
            <button type="button" data-heatmap-scope="current" class="active">현재까지</button>
          </div>
          <span id="heatmapCount" class="heatmap-count">좌표 확인 중</span>
        </div>

        <div class="heatmap-canvas-wrap">
          <canvas id="violationHeatmap" aria-label="위반 발생 위치 열지도"></canvas>
        </div>

        <div class="heatmap-legend" aria-label="Heatmap 범례">
          <span><i class="legend-dot low"></i>낮음</span>
          <span><i class="legend-dot high"></i>중첩</span>
        </div>
        <p id="heatmapMessage" class="heatmap-message"></p>
      </aside>
    </section>

    <section class="analysis-section">
      <div class="analysis-heading">
        <div>
          <span class="section-eyebrow">REAL-TIME</span>
          <h2>교통 분석</h2>
        </div>
        <span class="speed-limit-chip">
          제한 ${numberText(cctv.cautionSpeedKmh, 0)} km/h
        </span>
      </div>

      <section
        id="detailPanel"
        class="detail-panel"
      ></section>
    </section>
  `;

  const video =
    document.querySelector("#trafficVideo");

  const videoStage =
    document.querySelector(".video-stage");

  const videoCard =
    document.querySelector(".video-card");

  const signalOverlay =
    document.querySelector("#signalOverlay");

  const videoModeLabel =
    document.querySelector("#videoModeLabel");

  const detailPanel =
    document.querySelector("#detailPanel");

  let activeVideoRatio = "";

  function syncVideoStage(videoWidth, videoHeight) {
    if (!videoWidth || !videoHeight) return;

    const ratio = videoWidth / videoHeight;
    const ratioKey = `${videoWidth}:${videoHeight}`;

    if (ratioKey === activeVideoRatio) return;

    activeVideoRatio = ratioKey;
    videoStage.style.setProperty(
      "--video-aspect",
      `${videoWidth} / ${videoHeight}`
    );
    videoStage.style.setProperty(
      "--video-aspect-value",
      String(ratio)
    );

    // 세로형 Twin은 16:9 가로 컨테이너 안에서 축소하지 않는다.
    // 화면 높이를 기준으로 카드 자체의 폭·높이를 함께 맞춘다.
    if (ratio < .9) {
      const maxWidth = Math.max(
        220,
        Math.round(window.innerHeight * .72 * ratio)
      );

      videoCard.style.maxWidth = `${maxWidth}px`;
      videoCard.classList.add("portrait-video-card");
    } else {
      videoCard.style.removeProperty("max-width");
      videoCard.classList.remove("portrait-video-card");
    }
  }

  const handleViewportChange = () => {
    activeVideoRatio = "";
    syncVideoStage(video.videoWidth, video.videoHeight);
  };

  window.addEventListener("resize", handleViewportChange);

  const heatmapCanvas =
    document.querySelector("#violationHeatmap");

  const heatmapCount =
    document.querySelector("#heatmapCount");

  const heatmapMessage =
    document.querySelector("#heatmapMessage");

  const heatmap =
    createViolationHeatmap({
      canvas: heatmapCanvas,
      backgroundUrl: cctv.heatmap?.background,
      violations: data.violations,
      onChange: ({
        error,
        visibleCount,
        totalWithPosition,
        totalViolations
      }) => {
        if (error) {
          heatmapCount.textContent = "배경 로드 실패";
          heatmapMessage.textContent =
            "Heatmap 배경 이미지를 불러오지 못했습니다.";
          return;
        }

        heatmapCount.textContent =
          `${visibleCount}개 지점`;

        if (totalWithPosition) {
          heatmapMessage.textContent =
            "CSV의 실제 x, y 좌표를 BEV 배경 해상도에 맞춰 표시합니다.";
        } else if (totalViolations) {
          heatmapMessage.textContent =
            `위반 ${totalViolations}건이 감지되었지만 위치 좌표가 제공되지 않았습니다.`;
        } else {
          heatmapMessage.textContent =
            "현재 영상에는 기록된 위반이 없습니다.";
        }
      }
    });

  function updateHeatmap(currentFrame) {
    heatmap.update(currentFrame, heatmapScope);
  }

  document
    .querySelectorAll("[data-heatmap-scope]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        heatmapScope = button.dataset.heatmapScope;

        document
          .querySelectorAll("[data-heatmap-scope]")
          .forEach((item) => {
            item.classList.toggle(
              "active",
              item.dataset.heatmapScope === heatmapScope
            );
          });

        updateHeatmap(
          Math.floor((video.currentTime || 0) * cctv.fps)
        );
      });
    });

  function modeLabel(mode) {
    if (mode === "yolo") return "객체 탐지";
    if (mode === "twin") return "Twin";
    return "원본";
  }

  function syncTabs(mode) {
    document
      .querySelectorAll("[data-video-mode]")
      .forEach((button) => {
        button.classList.toggle(
          "active",
          button.dataset.videoMode === mode
        );
      });
  }

  function renderAnalysis(analysis) {
    const visibleVehicles =
      analysis.vehicles.filter((vehicle) =>
        filter === "all" ||
        vehicle.status === filter
      );

    const averageCaution =
      analysis.averageStatus === "caution";

    detailPanel.innerHTML = `
      <div class="zone-status ${averageCaution ? "caution" : "safe"}">
        <div class="zone-status-icon">
          ${averageCaution ? "!" : "✓"}
        </div>

        <div class="zone-status-copy">
          <span>구역 상태</span>
          <strong>${averageCaution ? "주의" : "정상"}</strong>
          <small>
            평균 ${numberText(analysis.averageSpeed)} km/h ·
            제한 ${numberText(analysis.speedLimitKmh, 0)} km/h
          </small>
        </div>
      </div>

      <div class="metric-grid metric-grid-analysis">
        <article class="metric-card">
          <span>인식 차량</span>
          <strong>${analysis.recognizedCount}</strong>
          <small>대</small>
        </article>

        <article class="metric-card ${averageCaution ? "caution" : ""}">
          <span>평균 속도</span>
          <strong>${numberText(analysis.averageSpeed)}</strong>
          <small>km/h</small>
        </article>

        <article class="metric-card caution">
          <span>주의 차량</span>
          <strong>${analysis.cautionCount}</strong>
          <small>대</small>
        </article>

        <article class="metric-card danger">
          <span>위험 차량</span>
          <strong>${analysis.dangerCount}</strong>
          <small>대</small>
        </article>
      </div>

      <div class="filter-tabs">
        ${[
          ["all", "전체"],
          ["danger", "위험"],
          ["caution", "주의"],
          ["safe", "안전"]
        ].map(([value, label]) => `
          <button
            type="button"
            data-filter="${value}"
            class="${filter === value ? "active" : ""}"
          >
            ${label}
          </button>
        `).join("")}
      </div>

      <div class="analysis-table-wrap">
        <table class="analysis-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>현재 속도</th>
              <th>최고 속도</th>
              <th>관측 시간</th>
              <th>신호 위반</th>
              <th>판정</th>
              <th>위험 장면</th>
            </tr>
          </thead>

          <tbody>
            ${
              visibleVehicles.length
                ? visibleVehicles.map((vehicle) => `
                  <tr
                    class="${
                      String(vehicle.vehicleId) ===
                      String(focusedVehicle)
                        ? "focused-row"
                        : ""
                    }"
                  >
                    <td>
                      <strong>${escapeHtml(vehicle.vehicleId)}</strong>
                    </td>

                    <td>${numberText(vehicle.latestSpeed)} km/h</td>
                    <td>${numberText(vehicle.maxSpeed)} km/h</td>
                    <td>${numberText(vehicle.observationSec)} s</td>
                    <td>${vehicle.violation ? "O" : "X"}</td>

                    <td>
                      <span class="status-badge ${vehicle.status}">
                        ${statusKorean(vehicle.status)}
                      </span>
                    </td>

                    <td>
                      ${
                        vehicle.status === "danger" &&
                        Number.isFinite(vehicle.sceneFrame)
                          ? `
                            <div class="scene-buttons">
                              <button
                                type="button"
                                data-scene-mode="original"
                                data-scene-frame="${vehicle.sceneFrame}"
                              >
                                원본
                              </button>

                              <button
                                type="button"
                                data-scene-mode="yolo"
                                data-scene-frame="${vehicle.sceneFrame}"
                              >
                                YOLO
                              </button>

                              <button
                                type="button"
                                data-scene-mode="twin"
                                data-scene-frame="${vehicle.sceneFrame}"
                              >
                                Twin
                              </button>
                            </div>

                            <small class="scene-reason">
                              ${escapeHtml(vehicle.sceneReason)}
                            </small>
                          `
                          : "-"
                      }
                    </td>
                  </tr>
                `).join("")
                : `
                  <tr>
                    <td colspan="7">
                      해당 차량이 없습니다.
                    </td>
                  </tr>
                `
            }
          </tbody>
        </table>
      </div>
    `;

    detailPanel
      .querySelectorAll("[data-filter]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          filter = button.dataset.filter;
          renderAnalysis(currentAnalysis);
        });
      });

    detailPanel
      .querySelectorAll("[data-scene-mode]")
      .forEach((button) => {
        button.addEventListener("click", async () => {
          const mode =
            button.dataset.sceneMode;

          const frame =
            Number(button.dataset.sceneFrame);

          try {
            await controller.jumpTo(
              mode,
              frame
            );

            syncTabs(mode);
            videoModeLabel.textContent =
              modeLabel(mode);
          } catch (error) {
            toast(error.message);
          }
        });
      });
  }

  const controller =
    new VideoController(
      video,
      cctv,
      async (state) => {
        syncVideoStage(
          state.videoWidth,
          state.videoHeight
        );

        signalOverlay.innerHTML =
          signalOverlayHtml(
            data.signal,
            state.currentFrame,
            state.currentTime
          );

        currentAnalysis =
          analyzeAtFrame(
            cctv,
            data,
            state.currentFrame
          );

        const now = performance.now();

        if (
          now - lastAnalysisRenderAt >
          400
        ) {
          lastAnalysisRenderAt = now;
          renderAnalysis(currentAnalysis);
        }

        if (
          heatmapScope === "current" &&
          now - lastHeatmapRenderAt > 400
        ) {
          lastHeatmapRenderAt = now;
          updateHeatmap(state.currentFrame);
        }

        if (
          isNearby(cctv.id) &&
          state.currentFrame >= lastVideoFrame
        ) {
          const hits =
            eventsBetweenFrames(
              cctvEvents,
              lastVideoFrame,
              state.currentFrame
            );

          for (const event of hits) {
            const inserted =
              await recordEvent(
                cctv,
                event,
                settings
              );

            if (inserted) {
              toast(
                `${cctv.name} · ` +
                `${event.label} · ` +
                `${event.vehicleId}번 차량`
              );

              updateNotificationBadge();
            }
          }
        }

        lastVideoFrame =
          state.currentFrame;
      }
    );

  document
    .querySelectorAll("[data-video-mode]")
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          const mode =
            button.dataset.videoMode;

          syncTabs(mode);

          try {
            await controller.switchMode(mode);

            videoModeLabel.textContent =
              modeLabel(mode);
          } catch (error) {
            toast(error.message);
          }
        }
      );
    });

  currentAnalysis =
    analyzeAtFrame(
      cctv,
      data,
      0
    );

  renderAnalysis(currentAnalysis);

  try {
    await controller.init();

    if (
      Number.isFinite(requestedFrame) &&
      requestedFrame >= 0
    ) {
      video.currentTime =
        requestedFrame / cctv.fps;

      controller.emitTick();
    }
  } catch (error) {
    toast(error.message);
  }

  activeCleanup = () => {
    window.removeEventListener("resize", handleViewportChange);
    heatmap.destroy();
    controller.destroy();
  };
}

async function renderRoute() {
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }

  updateNotificationBadge();

  const route = parseRoute();

  if (route.name === "home") {
    renderHome();
    return;
  }

  if (route.name === "notifications") {
    renderNotifications();
    return;
  }

  if (route.name === "settings") {
    renderSettings();
    return;
  }

  if (route.name === "cctv") {
    await renderCctv(route);
  }
}

window.addEventListener(
  "hashchange",
  renderRoute
);

window.addEventListener(
  "beforeinstallprompt",
  (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
  }
);

if ("serviceWorker" in navigator) {
  window.addEventListener(
    "load",
    async () => {
      try {
        const registration =
          await navigator.serviceWorker.register(
            "./sw.js",
            {
              /*
               * sw.js 자체를 HTTP cache에서 재사용하지 말고
               * 서버에서 최신 버전을 확인합니다.
               */
              updateViaCache: "none"
            }
          );

        /*
         * GitHub Pages에 새 sw.js가 올라온 경우 즉시 확인합니다.
         */
        await registration.update();

        console.log(
          "Service Worker 등록 완료:",
          registration.scope
        );
      } catch (error) {
        console.error(
          "Service Worker 등록 실패:",
          error
        );
      }
    }
  );
}

if (!location.hash) {
  location.hash = "#/";
}

renderRoute();
