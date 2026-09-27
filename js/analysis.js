function latestViolationAtOrBefore(items, currentFrame) {
  if (!items?.length) return null;

  let found = null;

  for (const item of items) {
    if (item.startFrame <= currentFrame) {
      found = item;
    } else {
      break;
    }
  }

  return found;
}

function speedRules(cctv) {
  return {
    caution: Number(cctv.cautionSpeedKmh) || 50,
    danger: Number(cctv.dangerSpeedKmh) || 100,
    // 130km/h 이상은 이 데이터셋에서 속도 추정 오류로 취급한다.
    noise: Number(cctv.noiseSpeedKmh) || 130
  };
}

function isNoiseSeries(cctv, series) {
  const { noise } = speedRules(cctv);

  return (
    Number.isFinite(series.maxAll) &&
    series.maxAll >= noise
  );
}

export function classifyVehicle(maxSpeed, violation, cctv) {
  if (violation) return "danger";

  const { caution, danger } = speedRules(cctv);

  if (
    Number.isFinite(maxSpeed) &&
    maxSpeed >= danger
  ) {
    return "danger";
  }

  if (
    Number.isFinite(maxSpeed) &&
    maxSpeed >= caution
  ) {
    return "caution";
  }

  return "safe";
}

export function analyzeAtFrame(cctv, data, currentFrame) {
  const vehicles = [];

  let totalSampleSum = 0;
  let totalSampleCount = 0;

  const { danger } = speedRules(cctv);

  for (const [vehicleId, series] of data.speed.entries()) {
    if (isNoiseSeries(cctv, series)) {
      continue;
    }

    if (
      series.firstFrame == null ||
      series.firstFrame > currentFrame
    ) {
      continue;
    }

    const latest = series.latestAt(currentFrame);
    if (!latest) continue;

    const maxSpeed = series.maxAt(currentFrame);
    const sample = series.sumAndCountAt(currentFrame);

    totalSampleSum += sample.sum;
    totalSampleCount += sample.count;

    const observedLastFrame =
      Math.min(series.lastFrame, currentFrame);

    const observationSec =
      Math.max(
        0,
        observedLastFrame - series.firstFrame
      ) / cctv.fps;

    const violation =
      latestViolationAtOrBefore(
        data.violationIndex.get(vehicleId),
        currentFrame
      );

    const firstDanger =
      series.firstAtOrAbove(danger);

    const status =
      classifyVehicle(
        maxSpeed,
        violation,
        cctv
      );

    let sceneFrame = null;
    let sceneReason = null;

    if (violation) {
      sceneFrame = violation.startFrame;
      sceneReason = "신호 위반";
    } else if (
      firstDanger &&
      firstDanger.frame <= currentFrame &&
      status === "danger"
    ) {
      sceneFrame = firstDanger.frame;
      sceneReason = "과속";
    }

    vehicles.push({
      vehicleId,
      latestSpeed: latest.value,
      latestSpeedFrame: latest.frame,
      maxSpeed,
      observationSec,
      violation,
      status,
      sceneFrame,
      sceneReason
    });
  }

  const statusRank = {
    danger: 0,
    caution: 1,
    safe: 2
  };

  vehicles.sort((a, b) => {
    if (
      statusRank[a.status] !==
      statusRank[b.status]
    ) {
      return (
        statusRank[a.status] -
        statusRank[b.status]
      );
    }

    return (
      Number(b.maxSpeed || 0) -
      Number(a.maxSpeed || 0)
    );
  });

  const averageSpeed =
    totalSampleCount > 0
      ? totalSampleSum / totalSampleCount
      : 0;

  const { caution } = speedRules(cctv);

  return {
    recognizedCount: vehicles.length,
    averageSpeed,
    speedLimitKmh: caution,
    averageStatus:
      totalSampleCount > 0 &&
      averageSpeed >= caution
        ? "caution"
        : "safe",

    dangerCount:
      vehicles.filter(
        (vehicle) =>
          vehicle.status === "danger"
      ).length,

    cautionCount:
      vehicles.filter(
        (vehicle) =>
          vehicle.status === "caution"
      ).length,

    safeCount:
      vehicles.filter(
        (vehicle) =>
          vehicle.status === "safe"
      ).length,

    vehicles
  };
}

export function buildCctvEvents(cctv, data) {
  const events = [];
  const { danger } = speedRules(cctv);
  const noiseIds = new Set();

  for (const [vehicleId, series] of data.speed.entries()) {
    if (isNoiseSeries(cctv, series)) {
      noiseIds.add(String(vehicleId));
      continue;
    }

    // 일반 과속은 상세 분석 표에는 남기되, 알림 후보는 위험 속도 초과로 한정한다.
    const firstOverspeed =
      series.firstAtOrAbove(danger);

    if (firstOverspeed) {
      events.push({
        eventKey:
          `${cctv.id}:overspeed:${vehicleId}:${firstOverspeed.frame}`,

        cctvId: cctv.id,
        vehicleId,
        frame: firstOverspeed.frame,
        type: "overspeed",
        label: "고위험 과속",

        message:
          `${vehicleId}번 차량 · ` +
          `${firstOverspeed.value.toFixed(1)} km/h`
      });
    }
  }

  for (const violation of data.violations) {
    if (
      noiseIds.has(
        String(violation.vehicleId)
      )
    ) {
      continue;
    }

    events.push({
      eventKey:
        `${cctv.id}:violation:${violation.vehicleId}:${violation.startFrame}`,

      cctvId: cctv.id,
      vehicleId: violation.vehicleId,
      frame: violation.startFrame,
      type: "violation",
      label: "신호 위반",
      message:
        `${violation.vehicleId}번 차량 · 신호 위반`
    });
  }

  events.sort(
    (a, b) => a.frame - b.frame
  );

  return events;
}

export function eventsBetweenFrames(
  events,
  startExclusive,
  endInclusive
) {
  if (
    endInclusive <
    startExclusive
  ) {
    return [];
  }

  return events.filter(
    (event) =>
      event.frame > startExclusive &&
      event.frame <= endInclusive
  );
}
