export function stripBom(text) {
  return String(text ?? "").replace(/^\uFEFF/, "");
}

export function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[()\[\]\/\\\s\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function findHeader(headers, candidates) {
  const map = new Map(headers.map((header) => [normalizeHeader(header), header]));

  for (const candidate of candidates) {
    const hit = map.get(normalizeHeader(candidate));
    if (hit) return hit;
  }

  return null;
}

// quoted CSV까지 지원하는 일반 parser.
// result / violation / signal 같이 비교적 작은 CSV용.
export function parseCsv(text) {
  const source = stripBom(text);
  const rows = [];

  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];

    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows.filter((r) => r.some((v) => String(v).trim() !== ""));
}

export function csvObjects(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];

  const headers = rows[0].map((v) => String(v).trim());

  return rows.slice(1).map((row) => {
    const object = {};
    headers.forEach((header, i) => {
      object[header] = row[i] ?? "";
    });
    return object;
  });
}
