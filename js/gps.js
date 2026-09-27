export function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("이 브라우저는 GPS 위치 기능을 지원하지 않습니다."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        const reason = {
          1: "위치 권한이 거부되었습니다. 브라우저/휴대폰 설정에서 위치 권한을 허용해주세요.",
          2: "현재 위치를 확인할 수 없습니다.",
          3: "GPS 위치 확인 시간이 초과되었습니다."
        };

        reject(new Error(reason[error.code] || "위치 확인에 실패했습니다."));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000
      }
    );
  });
}

export function evaluateNearby(cctvs, position, radiusOverrideM = 0) {
  const { latitude, longitude, accuracy } = position.coords;

  const results = cctvs.map((cctv) => {
    if (!Number.isFinite(cctv.latitude) || !Number.isFinite(cctv.longitude)) {
      return {
        cctvId: cctv.id,
        configured: false,
        nearby: false,
        distanceM: null
      };
    }

    const distanceM = haversineMeters(
      latitude,
      longitude,
      cctv.latitude,
      cctv.longitude
    );

    const radiusM =
      Number(radiusOverrideM) > 0
        ? Number(radiusOverrideM)
        : Number(cctv.radiusM);

    return {
      cctvId: cctv.id,
      configured: true,
      nearby: distanceM <= radiusM,
      distanceM,
      radiusM
    };
  });

  return {
    latitude,
    longitude,
    accuracy,
    checkedAt: new Date().toISOString(),
    results
  };
}
