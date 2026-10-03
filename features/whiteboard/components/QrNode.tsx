"use client";

import type { Context } from "konva/lib/Context";
import { useMemo } from "react";
import { Group, Rect, Shape, Text } from "react-konva";
import { CANVAS_FONT_FAMILY } from "../constants";
import { encodeQr } from "../insert/qr";
import type { QrElement } from "../types";
import { qrHeight } from "../utils/elements";
import type { CommonNodeProps } from "./node-props";

/**
 * QR code drawn from its module matrix in a single path fill: crisp at any
 * zoom, no seams between modules, and included in PNG export like any shape.
 * Always black on white for reliable scanning.
 */
export function QrNode({ element, common }: { element: QrElement; common: CommonNodeProps }) {
  const matrix = useMemo(() => encodeQr(element.content), [element.content]);
  const { size, label } = element;
  const height = qrHeight(element);
  const caption = label.trim();

  const drawModules = useMemo(() => {
    if (!matrix.ok) return null;
    const { modules, count } = matrix;
    return (ctx: Context) => {
      const unit = size / count;
      ctx.beginPath();
      modules.forEach((row, y) => {
        let x = 0;
        while (x < row.length) {
          if (!row[x]) {
            x += 1;
            continue;
          }
          const start = x;
          while (x < row.length && row[x]) x += 1;
          ctx.rect(start * unit, y * unit, (x - start) * unit, unit);
        }
      });
      ctx.fillStyle = "#000000";
      ctx.fill();
    };
  }, [matrix, size]);

  return (
    <Group {...common} width={size} height={height}>
      <Rect width={size} height={height} fill="#ffffff" stroke="#e3e3e6" strokeWidth={1} strokeScaleEnabled={false} cornerRadius={2} />
      {drawModules ? (
        <Shape sceneFunc={drawModules} listening={false} perfectDrawEnabled={false} />
      ) : (
        <Text width={size} height={size} align="center" verticalAlign="middle" text="Invalid QR content" fontSize={14} fill="#b42318" fontFamily={CANVAS_FONT_FAMILY} listening={false} />
      )}
      {caption && (
        <Text
          y={size - size * 0.02}
          width={size}
          height={height - size + size * 0.02}
          align="center"
          verticalAlign="middle"
          text={caption}
          fontSize={Math.max(8, size * 0.075)}
          fontStyle="600"
          fontFamily={CANVAS_FONT_FAMILY}
          fill="#1f2328"
          wrap="none"
          ellipsis
          padding={size * 0.03}
          listening={false}
        />
      )}
    </Group>
  );
}
