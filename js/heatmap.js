function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function positionPoints(violations) {
  return violations
    .filter((item) =>
      Number.isFinite(item?.position?.x) &&
      Number.isFinite(item?.position?.y)
    )
    .map((item) => ({
      x: item.position.x,
      y: item.position.y,
      frame: item.startFrame,
      vehicleId: item.vehicleId
    }));
}

function paintEmptyState(context, width, height) {
  const boxWidth = Math.min(width - 32, 310);
  const boxHeight = 76;
  const x = (width - boxWidth) / 2;
  const y = (height - boxHeight) / 2;

  context.fillStyle = "rgba(15, 23, 42, .84)";
  context.beginPath();
  context.roundRect(x, y, boxWidth, boxHeight, 14);
  context.fill();

  context.fillStyle = "#f8fafc";
  context.font = "700 14px system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText("공간 좌표가 포함된 위반 데이터가 없습니다", width / 2, y + 31);
  context.fillStyle = "#cbd5e1";
  context.font = "12px system-ui, sans-serif";
  context.fillText("x, y 열이 있는 CSV는 자동으로 지도에 표시됩니다", width / 2, y + 53);
}

/**
 * 사전 생성된 BEV 배경 위에 원본 좌표를 그대로 그리는 Canvas heatmap.
 * 배경의 자연 해상도를 canvas backing size로 사용하여 화면 크기와 관계없이
 * 좌표가 어긋나지 않는다.
 */
export function createViolationHeatmap({
  canvas,
  backgroundUrl,
  violations,
  onChange
}) {
  const context = canvas.getContext("2d");
  const image = new Image();
  const points = positionPoints(violations);
  let loaded = false;
  let destroyed = false;
  let scope = "current";
  let frame = 0;

  function selectedPoints() {
    if (scope === "all") return points;
    return points.filter((point) => point.frame <= frame);
  }

  function clusterPoints(items, threshold) {
    const clusters = [];

    for (const point of items) {
      const target = clusters.find((cluster) =>
        Math.hypot(cluster.x - point.x, cluster.y - point.y) <= threshold
      );

      if (!target) {
        clusters.push({ ...point, count: 1 });
        continue;
      }

      target.x = (target.x * target.count + point.x) / (target.count + 1);
      target.y = (target.y * target.count + point.y) / (target.count + 1);
      target.count += 1;
    }

    return clusters;
  }

  function drawMarker(context, cluster, baseRadius) {
    const radius = clamp(
      baseRadius + Math.sqrt(cluster.count - 1) * 4,
      baseRadius,
      baseRadius + 12
    );

    context.fillStyle =
      cluster.count > 1
        ? "rgba(220, 38, 38, .94)"
        : "rgba(249, 115, 22, .94)";
    context.beginPath();
    context.arc(cluster.x, cluster.y, radius, 0, Math.PI * 2);
    context.fill();

    context.lineWidth = 2.5;
    context.strokeStyle = "rgba(255, 255, 255, .96)";
    context.stroke();

    if (cluster.count > 1) {
      context.fillStyle = "#fff";
      context.font = `800 ${Math.round(radius)}px system-ui, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(cluster.count), cluster.x, cluster.y + .5);
    }
  }

  function draw() {
    if (!loaded || destroyed) return;

    const width = image.naturalWidth;
    const height = image.naturalHeight;

    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    context.fillStyle = "rgba(2, 6, 23, .05)";
    context.fillRect(0, 0, width, height);

    const activePoints = selectedPoints()
      .filter((point) =>
        point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height
      );

    if (!activePoints.length) {
      paintEmptyState(context, width, height);
    } else {
      const radius = clamp(Math.min(width, height) * .022, 10, 17);
      const clusters = clusterPoints(activePoints, radius * 2.2);
      clusters.forEach((cluster) => drawMarker(context, cluster, radius));
    }

    onChange?.({
      visibleCount: activePoints.length,
      totalWithPosition: points.length,
      totalViolations: violations.length
    });
  }

  image.addEventListener("load", () => {
    loaded = true;
    draw();
  });

  image.addEventListener("error", () => {
    onChange?.({
      error: true,
      visibleCount: 0,
      totalWithPosition: points.length,
      totalViolations: violations.length
    });
  });

  image.src = backgroundUrl;

  return {
    update(nextFrame, nextScope = scope) {
      frame = Math.max(0, Number(nextFrame) || 0);
      scope = nextScope;
      draw();
    },
    destroy() {
      destroyed = true;
      image.removeAttribute("src");
    }
  };
}
