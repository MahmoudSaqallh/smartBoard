"use client";

import { Group, Image as KonvaImage, Rect, Text } from "react-konva";
import { CANVAS_FONT_FAMILY } from "../constants";
import { useAssetImage } from "../insert/asset-cache";
import { useBoardStore } from "../store/board-store";
import type { ImageElement } from "../types";
import type { CommonNodeProps } from "./node-props";

/**
 * Always a Group with the same identity, whether the image is loading,
 * loaded or broken, so the selection transformer never points at a
 * destroyed node when the pixels arrive.
 */
export function ImageNode({ element, common }: { element: ImageElement; common: CommonNodeProps }) {
  const asset = useBoardStore((s) => s.doc.assets[element.assetId]);
  const { image, status } = useAssetImage(asset);
  const { width, height, crop } = element;

  const cropRect =
    image && crop
      ? {
          x: crop.left * image.naturalWidth,
          y: crop.top * image.naturalHeight,
          width: image.naturalWidth * (1 - crop.left - crop.right),
          height: image.naturalHeight * (1 - crop.top - crop.bottom),
        }
      : undefined;

  return (
    <Group {...common} width={width} height={height} opacity={common.opacity * element.opacity}>
      {image ? (
        <KonvaImage image={image} width={width} height={height} crop={cropRect} perfectDrawEnabled={false} />
      ) : (
        <>
          <Rect width={width} height={height} fill="#f1f1f2" stroke="#cfcfd4" strokeWidth={1} dash={[6, 4]} strokeScaleEnabled={false} />
          <Text
            width={width}
            height={height}
            align="center"
            verticalAlign="middle"
            text={status === "loading" ? "Loading image…" : "Image unavailable"}
            fontSize={Math.max(10, Math.min(18, width / 14))}
            fontFamily={CANVAS_FONT_FAMILY}
            fill="#6b6b76"
            listening={false}
          />
        </>
      )}
    </Group>
  );
}
