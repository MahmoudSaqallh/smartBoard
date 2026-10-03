"use client";

import type Konva from "konva";
import type { Context } from "konva/lib/Context";
import { useCallback, type Ref } from "react";
import { Layer, Shape } from "react-konva";
import { useAssetImage } from "../insert/asset-cache";
import { useBoardStore } from "../store/board-store";
import type { PageBackground } from "../types";
import { visibleWorldRect } from "./geometry";
import { drawBackground } from "./render";

interface BackgroundLayerProps {
  background: PageBackground;
  layerRef?: Ref<Konva.Layer>;
}

/**
 * Page background below all content. Not listening, so it can never be
 * selected, dragged or hit by a tool. The visible world rectangle is derived
 * from the canvas transform at draw time, so the same code fills the live
 * viewport and any region requested by export.
 */
export function BackgroundLayer({ background, layerRef }: BackgroundLayerProps) {
  const asset = useBoardStore((s) => (background.image ? s.doc.assets[background.image.assetId] : undefined));
  const { image } = useAssetImage(asset);

  const draw = useCallback(
    (context: Context) => {
      const ctx = context._context;
      const matrix = ctx.getTransform();
      const pixelRatio = context.canvas.getPixelRatio() || 1;
      const view = visibleWorldRect(matrix, ctx.canvas.width, ctx.canvas.height);
      const devicePerWorld = Math.hypot(matrix.a, matrix.b) || 1;
      drawBackground(ctx, background, view, { devicePerWorld, cssPerWorld: devicePerWorld / pixelRatio }, image);
    },
    [background, image],
  );

  return (
    <Layer ref={layerRef} listening={false}>
      <Shape sceneFunc={draw} perfectDrawEnabled={false} />
    </Layer>
  );
}
