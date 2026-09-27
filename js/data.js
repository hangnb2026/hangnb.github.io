import { csvObjects, findHeader } from "./csv.js";

const dataCache = new Map();

async function fetchText(path, optional = false) {
  if (!path) return null;

  try {
    const response = await fetch(path, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    if (optional) {
      console.warn(`[optional file] ${path}`, error);
      return null;
    }

    throw new Error(`${path} 파일을 불러오지 못했습니다: ${error.message}`);
  }
}

async function fetchGzipJson(path) {
  if (!path) {
    throw new Error("압축 speed 파일 경로가 없습니다.");
  }

  const response = await fetch(path, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`${path} 로드 실패: ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error("현재 브라우저에서 streaming response를 사용할 수 없습니다.");
  }

  if (!("DecompressionStream" in window)) {
    throw new Error(
      "현재 브라우저가 gzip 압축 해제 API(DecompressionStream)를 지원하지 않습니다. 최신 Chrome/Edge/Safari/Firefox를 사용해주세요."
    );
  }

  const decompressedStream =
    response.body.pipeThrough(new DecompressionStream("gzip"));

  const text =
    await new Response(decompressedStream).text();

  return JSON.parse(text);
}

function rightmostLE(array, target) {
  let low = 0;
  let high = array.length - 1;
  let answer = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;

    if (array[mid] <= target) {
      answer = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return answer;
}

function createSparseSeries(frameArray, valueArray) {
  const prefixMax = new Float32Array(valueArray.length);
  const prefixSum = new Float64Array(valueArray.length);

  let maxValue = -Infinity;
  let sumValue = 0;

  for (let i = 0; i < valueArray.length; i++) {
    maxValue = Math.max(maxValue, valueArray[i]);
    sumValue += valueArray[i];

    prefixMax[i] = maxValue;
    prefixSum[i] = sumValue;
  }

  return {
    frames: frameArray,
    values: valueArray,
    prefixMax,
    prefixSum,
    maxAll:
      Number.isFinite(maxValue)
        ? maxValue
        : null,

    firstFrame:
      frameArray.length
        ? frameArray[0]
        : null,

    lastFrame:
      frameArray.length
        ? frameArray[frameArray.length - 1]
        : null,

    latestAt(frame) {
      const index =
        rightmostLE(frameArray, frame);

      if (index < 0) return null;

      return {
        index,
        frame: frameArray[index],
        value: valueArray[index]
      };
    },

    maxAt(frame) {
      const index =
        rightmostLE(frameArray, frame);

      return index < 0
        ? null
        : prefixMax[index];
    },

    sumAndCountAt(frame) {
      const index =
        rightmostLE(frameArray, frame);

      if (index < 0) {
        return {
          sum: 0,
          count: 0
        };
      }

      return {
        sum: prefixSum[index],
        count: index + 1
      };
    },

    firstAtOrAbove(limit) {
      for (
        let i = 0;
        i < valueArray.length;
        i++
      ) {
        if (valueArray[i] >= limit) {
          return {
            frame: frameArray[i],
            value: valueArray[i]
          };
        }
      }

      return null;
    },

    firstAbove(limit) {
      for (
        let i = 0;
        i < valueArray.length;
        i++
      ) {
        if (valueArray[i] > limit) {
          return {
            frame: frameArray[i],
            value: valueArray[i]
          };
        }
      }

      return null;
    }
  };
}

/*
 * converter가 생성하는 포맷:
 *
 * {
 *   "format": "traffic-speed-v1",
 *   "vehicles": {
 *     "123": {
 *       "d": [100, 1, 1, 2, ...],
 *       "v": [20.3, 21.1, 21.9, ...]
 *     }
 *   }
 * }
 *
 * d[0] = 첫 frame의 절대값
 * d[1:] = 직전 frame 대비 delta
 */
export function decodeCompressedSpeedJson(payload) {
  if (
    !payload ||
    typeof payload.vehicles !== "object"
  ) {
    throw new Error("지원하지 않는 speed 압축 포맷입니다.");
  }

  const result = new Map();

  for (
    const [vehicleId, packed]
    of Object.entries(payload.vehicles)
  ) {
    const deltas = packed?.d;
    const values = packed?.v;

    if (
      !Array.isArray(deltas) ||
      !Array.isArray(values) ||
      deltas.length !== values.length ||
      deltas.length === 0
    ) {
      continue;
    }

    const frames =
      new Int32Array(deltas.length);

    const speeds =
      new Float32Array(values.length);

    let frame = 0;

    for (
      let i = 0;
      i < deltas.length;
      i++
    ) {
      frame =
        i === 0
          ? Number(deltas[i])
          : frame + Number(deltas[i]);

      frames[i] = frame;
      speeds[i] = Number(values[i]);
    }

    result.set(
      vehicleId,
      createSparseSeries(
        frames,
        speeds
      )
    );
  }

  return result;
}

export function parseResultCsv(text) {
  if (!text) return new Map();

  const rows = csvObjects(text);
  if (!rows.length) return new Map();

  const headers = Object.keys(rows[0]);

  const idKey = findHeader(
    headers,
    ["ID", "vehicle_id"]
  );

  const maxKey = findHeader(
    headers,
    [
      "Max Velocity(km/h)",
      "max_velocity_km_h",
      "max velocity"
    ]
  );

  const minKey = findHeader(
    headers,
    [
      "Min Velocity(km/h)",
      "min_velocity_km_h",
      "min velocity"
    ]
  );

  const avgKey = findHeader(
    headers,
    [
      "Avg Velocity(km/h)",
      "avg_velocity_km_h",
      "avg velocity"
    ]
  );

  const result = new Map();

  for (const row of rows) {
    const id =
      String(row[idKey] ?? "").trim();

    if (!id) continue;

    result.set(id, {
      max: Number(row[maxKey]),
      min: Number(row[minKey]),
      avg: Number(row[avgKey])
    });
  }

  return result;
}

export function parseViolationCsv(text, format) {
  if (!text) return [];

  const rows = csvObjects(text);
  if (!rows.length) return [];

  const headers = Object.keys(rows[0]);

  const idKey = findHeader(
    headers,
    ["ID", "vehicle_id", "vehicle id"]
  );

  if (!idKey) return [];

  // 일부 위반 데이터(예: 남단 정지선)는 검출 당시의 영상 좌표를
  // 함께 제공한다. 좌표가 없는 기존 range CSV와 같은 형식으로 다루되,
  // heatmap에서만 선택적으로 사용한다.
  const xKey = findHeader(headers, ["x", "center_x", "cx", "pos_x"]);
  const yKey = findHeader(headers, ["y", "center_y", "cy", "pos_y"]);

  function positionOf(row) {
    if (!xKey || !yKey) return null;

    const x = Number(row[xKey]);
    const y = Number(row[yKey]);

    return Number.isFinite(x) && Number.isFinite(y)
      ? { x, y }
      : null;
  }

  if (format === "singleFrame") {
    const frameKey = findHeader(
      headers,
      [
        "frame_number",
        "frame",
        "violation_frame"
      ]
    );

    if (!frameKey) return [];

    return rows
      .map((row) => {
        const frame =
          Number.parseInt(
            row[frameKey],
            10
          );

        return {
          vehicleId:
            String(
              row[idKey] ?? ""
            ).trim(),

          startFrame: frame,
          endFrame: frame,
          type: "signal",
          position: positionOf(row),
          detail: row
        };
      })
      .filter(
        (item) =>
          item.vehicleId &&
          Number.isFinite(
            item.startFrame
          )
      );
  }

  const startKey = findHeader(
    headers,
    [
      "start_frame",
      "start_rame",
      "startframe",
      "start frame"
    ]
  );

  const endKey = findHeader(
    headers,
    [
      "end_frame",
      "endframe",
      "end frame"
    ]
  );

  if (!startKey) return [];

  return rows
    .map((row) => {
      const startFrame =
        Number.parseInt(
          row[startKey],
          10
        );

      const parsedEnd =
        Number.parseInt(
          row[endKey],
          10
        );

      return {
        vehicleId:
          String(
            row[idKey] ?? ""
          ).trim(),

        startFrame,

        endFrame:
          Number.isFinite(parsedEnd)
            ? parsedEnd
            : startFrame,

        type: "signal",
        position: positionOf(row),
        detail: row
      };
    })
    .filter(
      (item) =>
        item.vehicleId &&
        Number.isFinite(
          item.startFrame
        )
    );
}

function buildViolationIndex(violations) {
  const result = new Map();

  for (const item of violations) {
    if (!result.has(item.vehicleId)) {
      result.set(
        item.vehicleId,
        []
      );
    }

    result
      .get(item.vehicleId)
      .push(item);
  }

  for (
    const items of result.values()
  ) {
    items.sort(
      (a, b) =>
        a.startFrame - b.startFrame
    );
  }

  return result;
}

export function parseSignalCsv(text) {
  if (!text) return null;

  const rows = csvObjects(text);
  if (!rows.length) return null;

  const headers =
    Object.keys(rows[0]);

  const frameKey =
    findHeader(
      headers,
      [
        "frame",
        "frame_number",
        "frame_no",
        "frame_idx"
      ]
    );

  const timeKey =
    findHeader(
      headers,
      [
        "time_sec",
        "time",
        "seconds",
        "sec"
      ]
    );

  const startTimeKey =
    findHeader(
      headers,
      [
        "start_time",
        "start_sec",
        "start"
      ]
    );

  const endTimeKey =
    findHeader(
      headers,
      [
        "end_time",
        "end_sec",
        "end"
      ]
    );

  const timeHeaders =
    new Set(
      [
        frameKey,
        timeKey,
        startTimeKey,
        endTimeKey
      ].filter(Boolean)
    );

  const valueHeaders =
    headers.filter(
      (header) =>
        !timeHeaders.has(header)
    );

  const records =
    rows.map(
      (row, index) => ({
        index,

        frame:
          frameKey
            ? Number(row[frameKey])
            : null,

        time:
          timeKey
            ? Number(row[timeKey])
            : null,

        startTime:
          startTimeKey
            ? Number(
                row[startTimeKey]
              )
            : null,

        endTime:
          endTimeKey
            ? Number(
                row[endTimeKey]
              )
            : null,

        values:
          Object.fromEntries(
            valueHeaders
              .map(
                (header) => [
                  header,
                  String(
                    row[header] ?? ""
                  ).trim()
                ]
              )
              .filter(
                ([, value]) =>
                  value !== ""
              )
          )
      })
    );

  if (frameKey) {
    records.sort(
      (a, b) =>
        a.frame - b.frame
    );
  } else if (timeKey) {
    records.sort(
      (a, b) =>
        a.time - b.time
    );
  } else if (startTimeKey) {
    records.sort(
      (a, b) =>
        a.startTime - b.startTime
    );
  }

  function latestRecord(
    target,
    getter
  ) {
    let low = 0;
    let high =
      records.length - 1;
    let answer = -1;

    while (low <= high) {
      const mid =
        (low + high) >> 1;

      const value =
        getter(records[mid]);

      if (
        Number.isFinite(value) &&
        value <= target
      ) {
        answer = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return answer >= 0
      ? records[answer]
      : null;
  }

  return {
    at(frame, timeSec) {
      if (!records.length) {
        return null;
      }

      if (
        startTimeKey &&
        endTimeKey
      ) {
        return (
          records.find(
            (record) =>
              Number.isFinite(
                record.startTime
              ) &&
              Number.isFinite(
                record.endTime
              ) &&
              record.startTime <=
                timeSec &&
              timeSec <=
                record.endTime
          ) ||
          null
        );
      }

      if (frameKey) {
        return latestRecord(
          frame,
          (record) =>
            record.frame
        );
      }

      if (timeKey) {
        return latestRecord(
          timeSec,
          (record) =>
            record.time
        );
      }

      return records[0] || null;
    }
  };
}

export async function loadCctvData(cctv) {
  if (dataCache.has(cctv.id)) {
    return dataCache.get(cctv.id);
  }

  const promise =
    (async () => {
      const [
        speedPayload,
        resultText,
        violationText,
        signalText
      ] =
        await Promise.all([
          fetchGzipJson(
            cctv.files.speed
          ),

          fetchText(
            cctv.files.result,
            true
          ),

          fetchText(
            cctv.files.violation,
            true
          ),

          fetchText(
            cctv.files.signal,
            true
          )
        ]);

      const speed =
        decodeCompressedSpeedJson(
          speedPayload
        );

      const result =
        parseResultCsv(
          resultText
        );

      const violations =
        parseViolationCsv(
          violationText,
          cctv.violationFormat
        );

      const signal =
        parseSignalCsv(
          signalText
        );

      return {
        speed,
        result,
        violations,

        violationIndex:
          buildViolationIndex(
            violations
          ),

        signal
      };
    })();

  dataCache.set(
    cctv.id,
    promise
  );

  try {
    return await promise;
  } catch (error) {
    dataCache.delete(cctv.id);
    throw error;
  }
}

export function clearDataCache() {
  dataCache.clear();
}
