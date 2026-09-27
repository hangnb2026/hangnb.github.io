import { CCTV_LIST, getCctv } from "./config.js";
import {
  loadLocationState,
  loadMonitorState,
  saveMonitorState
} from "./store.js";
import { loadCctvData } from "./data.js";
import { buildCctvEvents, eventsBetweenFrames } from "./analysis.js";
import { recordEvent } from "./notifications.js";

/*
 * GitHub Pages에는 서버 프로세스가 없다.
 * 이 monitor는 "웹앱이 열려 있는 동안" GPS 근처 CCTV들의
 * 사전 생성 CSV를 실시간 시뮬레이션한다.
 *
 * GPS 검색 시 monitor startAt을 새로 만들고,
 * elapsed seconds * fps를 현재 frame처럼 사용한다.
 */

export class NearbyMonitor {
  constructor(getSettings, onEvent) {
    this.getSettings = getSettings;
    this.onEvent = onEvent;
    this.timer = null;
    this.cache = new Map();
    this.running = false;
  }

  async prepareCctv(cctv) {
    if (this.cache.has(cctv.id)) {
      return this.cache.get(cctv.id);
    }

    const data = await loadCctvData(cctv);
    const events = buildCctvEvents(
      cctv,
      data
    );

    const prepared = {
      data,
      events
    };

    this.cache.set(cctv.id, prepared);
    return prepared;
  }

  startNew() {
    const location = loadLocationState();

    const activeCctvIds = (location?.results || [])
      .filter((item) => item.nearby)
      .map((item) => item.cctvId);

    const state = {
      startedAt: Date.now(),
      activeCctvIds,
      lastFrameByCctv: Object.fromEntries(
        activeCctvIds.map((id) => [id, -1])
      )
    };

    saveMonitorState(state);
    this.start();
  }

  start() {
    if (this.running) return;

    this.running = true;

    const existing = loadMonitorState();

    // 새로고침으로 돌아온 경우 기존 이벤트가 한꺼번에 쏟아지지 않도록
    // 현재 elapsed frame을 baseline으로 재설정한다.
    if (existing?.startedAt) {
      const now = Date.now();
      existing.lastFrameByCctv ||= {};

      for (const id of existing.activeCctvIds || []) {
        const cctv = getCctv(id);
        if (!cctv) continue;

        const elapsedSec =
          Math.max(0, now - existing.startedAt) / 1000;

        existing.lastFrameByCctv[id] =
          Math.floor(elapsedSec * cctv.fps);
      }

      saveMonitorState(existing);
    }

    this.timer = window.setInterval(
      () => this.tick().catch(console.error),
      1000
    );
  }

  async tick() {
    const state = loadMonitorState();

    if (!state?.startedAt || !state.activeCctvIds?.length) {
      return;
    }

    const now = Date.now();
    const settings = this.getSettings();

    for (const cctvId of state.activeCctvIds) {
      const cctv = getCctv(cctvId);
      if (!cctv) continue;

      const elapsedSec =
        Math.max(0, now - state.startedAt) / 1000;

      const currentFrame =
        Math.floor(elapsedSec * cctv.fps);

      const previousFrame =
        Number(state.lastFrameByCctv?.[cctvId] ?? -1);

      if (currentFrame <= previousFrame) continue;

      try {
        const prepared = await this.prepareCctv(cctv);

        const hits = eventsBetweenFrames(
          prepared.events,
          previousFrame,
          currentFrame
        );

        for (const event of hits) {
          const inserted = await recordEvent(
            cctv,
            event,
            settings
          );

          if (inserted) {
            this.onEvent?.(cctv, event);
          }
        }
      } catch (error) {
        console.warn(`[monitor] ${cctv.name}`, error);
      }

      state.lastFrameByCctv ||= {};
      state.lastFrameByCctv[cctvId] = currentFrame;
    }

    saveMonitorState(state);
  }

  stop() {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }

    this.running = false;
  }
}
