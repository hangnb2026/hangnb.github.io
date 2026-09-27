import { getReleaseAssetUrl } from "./config.js";

export class VideoController {
  constructor(video, cctv, onTick) {
    this.video = video;
    this.cctv = cctv;
    this.onTick = onTick;
    this.mode = "original";
    this.intervalId = null;

    this.video.playsInline = true;
    this.video.preload = "metadata";

    this.handleSeeked = () => this.emitTick();
    this.handleLoaded = () => this.emitTick();

    this.video.addEventListener("seeked", this.handleSeeked);
    this.video.addEventListener("loadedmetadata", this.handleLoaded);

    // timeupdate는 브라우저별 빈도가 낮을 수 있으므로 재생 중 250ms 주기 갱신.
    this.intervalId = window.setInterval(() => {
      if (!this.video.paused) {
        this.emitTick();
      }
    }, 250);
  }

  currentFrame() {
    return Math.max(
      0,
      Math.floor((this.video.currentTime || 0) * this.cctv.fps)
    );
  }

  emitTick() {
    this.onTick?.({
      currentTime: this.video.currentTime || 0,
      currentFrame: this.currentFrame(),
      paused: this.video.paused,
      mode: this.mode,
      videoWidth: this.video.videoWidth,
      videoHeight: this.video.videoHeight
    });
  }

  async init() {
    await this.switchMode("original", {
      preserveTime: false,
      preservePlay: false
    });
  }

  async switchMode(
    mode,
    {
      preserveTime = true,
      preservePlay = true,
      targetFrame = null
    } = {}
  ) {
    const filename = this.cctv.releaseFile[mode];

    if (!filename) {
      throw new Error(`${mode} 영상 파일명이 config.js에 없습니다.`);
    }

    const url = getReleaseAssetUrl(filename);

    if (!url) {
      throw new Error(
        "GitHub Release 주소가 설정되지 않았습니다. js/config.js의 GITHUB_OWNER와 REPOSITORY를 수정하세요."
      );
    }

    const previousTime = preserveTime
      ? (this.video.currentTime || 0)
      : 0;

    const wasPlaying = preservePlay
      ? !this.video.paused
      : false;

    const playbackRate = this.video.playbackRate || 1;

    const desiredTime = Number.isFinite(targetFrame)
      ? targetFrame / this.cctv.fps
      : previousTime;

    this.mode = mode;

    await new Promise((resolve, reject) => {
      const cleanup = () => {
        this.video.removeEventListener("loadedmetadata", handleLoaded);
        this.video.removeEventListener("error", handleError);
      };

      const handleError = () => {
        cleanup();
        reject(
          new Error(
            `영상 재생 실패: ${filename}. GitHub Release의 파일명/Tag/공개 상태를 확인하세요.`
          )
        );
      };

      const handleLoaded = async () => {
        cleanup();

        try {
          const maxTime = Number.isFinite(this.video.duration)
            ? Math.max(0, this.video.duration - 0.05)
            : desiredTime;

          this.video.currentTime = Math.min(
            Math.max(0, desiredTime),
            maxTime
          );

          this.video.playbackRate = playbackRate;

          if (wasPlaying) {
            try {
              await this.video.play();
            } catch {
              // 모바일 브라우저 autoplay 제한은 정상일 수 있음.
            }
          }

          this.emitTick();
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      this.video.addEventListener(
        "loadedmetadata",
        handleLoaded,
        { once: true }
      );

      this.video.addEventListener(
        "error",
        handleError,
        { once: true }
      );

      // GitHub Release는 다른 origin으로 redirect될 수 있으므로
      // crossOrigin 속성을 강제로 설정하지 않는다.
      this.video.src = url;
      this.video.load();
    });
  }

  async jumpTo(mode, frame) {
    const wasPlaying = !this.video.paused;

    if (mode !== this.mode) {
      await this.switchMode(mode, {
        preserveTime: false,
        preservePlay: wasPlaying,
        targetFrame: frame
      });

      return;
    }

    this.video.currentTime = Math.max(
      0,
      Number(frame) / this.cctv.fps
    );

    if (wasPlaying) {
      try {
        await this.video.play();
      } catch {}
    }

    this.emitTick();
  }

  destroy() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
    }

    this.video.removeEventListener("seeked", this.handleSeeked);
    this.video.removeEventListener("loadedmetadata", this.handleLoaded);

    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();
  }
}
