export const RELEASE = {
  GITHUB_OWNER: "hangnb2026",
  REPOSITORY: "hangnb2026.github.io",
  TAG: "videos-v2"
};

export const DEFAULT_SETTINGS = {
  notificationsEnabled: true,
  alertPolicy: "violation",
  gpsRadiusOverrideM: 500
};

export const CCTV_LIST = [
  {
    id: "olympic1",
    name: "올림픽공원 1",
    area: "올림픽공원",
    latitude: 35.8888,
    longitude: 128.6106,
    radiusM: 500,
    fps: 29.32,
    cautionSpeedKmh: 50,
    dangerSpeedKmh: 100,
    noiseSpeedKmh: 130,
    recordingMinutes: 10,
    heatmap: {
      background: "./files/bg_olympicpark.png",
      label: "올림픽공원 BEV"
    },

    releaseFile: {
      original: "cctv_olympic1.mp4",
      yolo: "yolo_olympic1.mp4",
      twin: "twin_olympic1.mp4"
    },

    files: {
      speed: "./files/올림픽공원1_speed.json.gz",
      result: "./files/올림픽공원1_result.csv",
      violation: "./files/올림픽공원1_violation.csv",
      signal: "./files/올림픽공원1_signal.csv"
    },

    violationFormat: "range"
  },

  {
    id: "olympic2",
    name: "올림픽공원 2",
    area: "올림픽공원",
    latitude: 35.8894,
    longitude: 128.6114,
    radiusM: 500,
    fps: 29.29,
    cautionSpeedKmh: 50,
    dangerSpeedKmh: 100,
    noiseSpeedKmh: 130,
    recordingMinutes: 10,
    heatmap: {
      background: "./files/bg_olympicpark.png",
      label: "올림픽공원 BEV"
    },

    releaseFile: {
      original: "cctv_olympic2.mp4",
      yolo: "yolo_olympic2.mp4",
      twin: "twin_olympic2.mp4"
    },

    files: {
      speed: "./files/올림픽공원2_speed.json.gz",
      result: "./files/올림픽공원2_result.csv",
      violation: "./files/올림픽공원2_violation.csv",
      signal: "./files/올림픽공원2_signal.csv"
    },

    violationFormat: "range"
  },

  {
    id: "olympic3",
    name: "올림픽공원 3",
    area: "올림픽공원",
    latitude: 35.8900,
    longitude: 128.6101,
    radiusM: 500,
    fps: 29.27,
    cautionSpeedKmh: 50,
    dangerSpeedKmh: 100,
    noiseSpeedKmh: 130,
    recordingMinutes: 10,
    heatmap: {
      background: "./files/bg_olympicpark.png",
      label: "올림픽공원 BEV"
    },

    releaseFile: {
      original: "cctv_olympic3.mp4",
      yolo: "yolo_olympic3.mp4",
      twin: "twin_olympic3.mp4"
    },

    files: {
      speed: "./files/올림픽공원3_speed.json.gz",
      result: "./files/올림픽공원3_result.csv",
      violation: "./files/올림픽공원3_violation.csv",
      signal: "./files/올림픽공원3_signal.csv"
    },

    violationFormat: "range"
  },

  {
    id: "olympicSouth1",
    name: "올림픽공원 남단 1",
    area: "올림픽공원남단",
    latitude: 35.8878,
    longitude: 128.6110,
    radiusM: 500,
    fps: 29.47,
    cautionSpeedKmh: 50,
    dangerSpeedKmh: 100,
    noiseSpeedKmh: 130,
    recordingMinutes: 30,
    heatmap: {
      background: "./files/bg_olympicparksouth.png",
      label: "올림픽공원남단 BEV"
    },

    releaseFile: {
      original: "cctv_olympic_south1.mp4",
      yolo: "yolo_olympic_south1.mp4",
      twin: "twin_olympic_south1.mp4"
    },

    files: {
      speed: "./files/올림픽공원남단1_speed.json.gz",
      result: "./files/올림픽공원남단1_result.csv",
      violation: "./files/올림픽공원남단1_stopline_violations.csv",
      signal: "./files/올림픽공원남단1_signal.csv"
    },

    violationFormat: "singleFrame"
  },

  {
    id: "walkerhill1",
    name: "워커힐 1",
    area: "워커힐",
    latitude: 35.8885,
    longitude: 128.6089,
    radiusM: 500,
    fps: 29.33,
    cautionSpeedKmh: 40,
    dangerSpeedKmh: 80,
    noiseSpeedKmh: 130,
    recordingMinutes: 10,
    heatmap: {
      background: "./files/bg_walkerhill.png",
      label: "워커힐 BEV"
    },

    releaseFile: {
      original: "cctv_walkerhill1.mp4",
      yolo: "yolo_walkerhill1.mp4",
      twin: "twin_walkerhill1.mp4"
    },

    files: {
      speed: "./files/워커힐1_speed.json.gz",
      result: "./files/워커힐1_result.csv",
      violation: "./files/워커힐1_violation.csv",
      signal: "./files/워커힐1_signal.csv"
    },

    violationFormat: "range"
  },

  {
    id: "walkerhill2",
    name: "워커힐 2",
    area: "워커힐",
    latitude: 35.8896,
    longitude: 128.6090,
    radiusM: 500,
    fps: 28.68,
    cautionSpeedKmh: 40,
    dangerSpeedKmh: 80,
    noiseSpeedKmh: 130,
    recordingMinutes: 10,
    heatmap: {
      background: "./files/bg_walkerhill.png",
      label: "워커힐 BEV"
    },

    releaseFile: {
      original: "cctv_walkerhill2.mp4",
      yolo: "yolo_walkerhill2.mp4",
      twin: "twin_walkerhill2.mp4"
    },

    files: {
      speed: "./files/워커힐2_speed.json.gz",
      result: "./files/워커힐2_result.csv",
      violation: "./files/워커힐2_violation.csv",
      signal: "./files/워커힐2_signal.csv"
    },

    violationFormat: "range"
  },

  {
    id: "walkerhill3",
    name: "워커힐 3",
    area: "워커힐",
    latitude: 35.8879,
    longitude: 128.6098,
    radiusM: 500,
    fps: 28.71,
    cautionSpeedKmh: 40,
    dangerSpeedKmh: 80,
    noiseSpeedKmh: 130,
    recordingMinutes: 10,
    heatmap: {
      background: "./files/bg_walkerhill.png",
      label: "워커힐 BEV"
    },

    releaseFile: {
      original: "cctv_walkerhill3.mp4",
      yolo: "yolo_walkerhill3.mp4",
      twin: "twin_walkerhill3.mp4"
    },

    files: {
      speed: "./files/워커힐3_speed.json.gz",
      result: "./files/워커힐3_result.csv",
      violation: "./files/워커힐3_violation.csv",
      signal: "./files/워커힐3_signal.csv"
    },

    violationFormat: "range"
  }
];

export function getCctv(id) {
  return CCTV_LIST.find((item) => item.id === id) || null;
}

export function getReleaseAssetUrl(filename) {
  if (!filename) return "";

  const owner = encodeURIComponent(RELEASE.GITHUB_OWNER);
  const repo = encodeURIComponent(RELEASE.REPOSITORY);
  const tag = encodeURIComponent(RELEASE.TAG);
  const asset = encodeURIComponent(filename);

  return `https://github.com/${owner}/${repo}/releases/download/${tag}/${asset}`;
}
