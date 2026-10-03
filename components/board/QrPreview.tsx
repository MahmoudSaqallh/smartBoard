import { encodeQr, qrPathData } from "@/features/whiteboard/insert/qr";

/** Live QR preview built as React SVG from the module matrix (no HTML injection). */
export function QrPreview({ content, size = 148 }: { content: string; size?: number }) {
  const matrix = encodeQr(content);
  if (!matrix.ok) {
    return (
      <div
        aria-hidden
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-md border border-dashed border-line-strong bg-subtle p-3 text-center text-xs text-ink-faint"
      >
        Preview appears here
      </div>
    );
  }
  return (
    <svg
      role="img"
      aria-label="QR code preview"
      width={size}
      height={size}
      viewBox={`0 0 ${matrix.count} ${matrix.count}`}
      shapeRendering="crispEdges"
      className="rounded-md border border-line bg-white"
    >
      <path d={qrPathData(matrix.modules)} fill="#000000" />
    </svg>
  );
}
