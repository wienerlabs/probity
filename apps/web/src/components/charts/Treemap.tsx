interface Cell {
  label: string;
  value: number;
  color: string;
  detail?: string;
}

interface Props {
  cells: Cell[];
  width?: number;
  height?: number;
  emptyLabel?: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  cell: Cell;
}

function squarify(
  cells: Cell[],
  x: number,
  y: number,
  w: number,
  h: number,
): Rect[] {
  if (cells.length === 0) return [];
  const total = cells.reduce((a, c) => a + c.value, 0);
  if (total <= 0) return [];
  const out: Rect[] = [];
  let remaining = cells.slice().sort((a, b) => b.value - a.value);
  let cx = x;
  let cy = y;
  let cw = w;
  let ch = h;
  while (remaining.length > 0) {
    const sumRem = remaining.reduce((a, c) => a + c.value, 0);
    const horizontal = cw >= ch;
    const row: Cell[] = [];
    let rowSum = 0;
    let worst = Infinity;
    for (const c of remaining) {
      const next = rowSum + c.value;
      const tryRow = [...row, c];
      const len = horizontal ? ch : cw;
      const trySpan = (next / sumRem) * (horizontal ? cw : ch);
      const w2 = tryRow.reduce((a, b) => a + b.value, 0);
      let worstRatio = 0;
      for (const x of tryRow) {
        const a = (x.value / w2) * len;
        const b = trySpan;
        worstRatio = Math.max(worstRatio, Math.max(a / b, b / a));
      }
      if (worstRatio < worst) {
        worst = worstRatio;
        row.push(c);
        rowSum = next;
      } else {
        break;
      }
    }
    if (row.length === 0) {
      row.push(remaining[0]!);
      rowSum = remaining[0]!.value;
    }
    const rowSpan = (rowSum / sumRem) * (horizontal ? cw : ch);
    let offset = horizontal ? cy : cx;
    for (const c of row) {
      const cellLen = (c.value / rowSum) * (horizontal ? ch : cw);
      const rect: Rect = horizontal
        ? { x: cx, y: offset, w: rowSpan, h: cellLen, cell: c }
        : { x: offset, y: cy, w: cellLen, h: rowSpan, cell: c };
      out.push(rect);
      offset += cellLen;
    }
    if (horizontal) {
      cx += rowSpan;
      cw -= rowSpan;
    } else {
      cy += rowSpan;
      ch -= rowSpan;
    }
    remaining = remaining.slice(row.length);
  }
  return out;
}

export function Treemap({
  cells,
  width = 380,
  height = 220,
  emptyLabel = "no data",
}: Props) {
  if (cells.length === 0) {
    return (
      <div
        className="surface-2 flex items-center justify-center text-xs text-[var(--color-muted-2)]"
        style={{ width, height }}
      >
        {emptyLabel}
      </div>
    );
  }
  const rects = squarify(cells, 0, 0, width, height);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {rects.map((r, i) => (
        <g key={i}>
          <rect
            x={r.x + 1}
            y={r.y + 1}
            width={Math.max(0, r.w - 2)}
            height={Math.max(0, r.h - 2)}
            fill={r.cell.color}
            fillOpacity={0.18}
            stroke={r.cell.color}
            strokeWidth={1}
            rx={6}
          />
          {r.w > 60 && r.h > 26 && (
            <>
              <text
                x={r.x + 8}
                y={r.y + 16}
                fontSize={10}
                letterSpacing={1.4}
                fill={r.cell.color}
                style={{ textTransform: "uppercase" }}
              >
                {r.cell.label.length > 18
                  ? r.cell.label.slice(0, 16) + "…"
                  : r.cell.label}
              </text>
              <text
                x={r.x + 8}
                y={r.y + 30}
                fontSize={11}
                fill="var(--color-text)"
                className="mono"
              >
                {r.cell.detail ?? r.cell.value.toString()}
              </text>
            </>
          )}
        </g>
      ))}
    </svg>
  );
}
