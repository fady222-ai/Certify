"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignData, DesignElement } from "@/lib/templates";
import { ornamentSvg } from "@/lib/ornaments";

// Sample values shown in place of variables so the preview looks like a real
// finished certificate (mirrors the keys resolved by the PDF renderer).
const SAMPLE: Record<string, string> = {
  recipient_name: "محمد أحمد العبدالله",
  course_name: "أساسيات إدارة المشاريع الاحترافية",
  issue_date: "١ يونيو ٢٠٢٦",
  org_name: "أكاديمية المسار للتدريب",
  verification_code: "CERT-AB12-CD34",
};

/**
 * Renders a template's design_data into a scaled, responsive WYSIWYG preview.
 * Element rendering mirrors certify-api/src/templates/designRenderer.js so the
 * preview matches the generated PDF (same coordinates, rotation origin, etc.).
 */
export function DesignPreview({ design, className }: { design: DesignData; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  const W = design?.width || 1123;
  const H = design?.height || 794;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [W]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: scale ? H * scale : undefined,
        aspectRatio: scale ? undefined : `${W} / ${H}`,
        overflow: "hidden",
        background: design?.background || "#ffffff",
      }}
    >
      {scale > 0 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: W,
            height: H,
            transformOrigin: "top left",
            transform: `scale(${scale})`,
            direction: "rtl",
            fontFamily: '"Cairo","Noto Sans Arabic","Arial",sans-serif',
          }}
        >
          {(design?.elements ?? []).map((el, i) => (
            <Element key={i} el={el} />
          ))}
        </div>
      )}
    </div>
  );
}

function Element({ el }: { el: DesignElement }) {
  const base: React.CSSProperties = {
    position: "absolute",
    left: el.left,
    top: el.top,
    ...(el.width != null ? { width: el.width } : {}),
    ...(el.angle ? { transform: `rotate(${el.angle}deg)`, transformOrigin: "top right" } : {}),
  };

  switch (el.type) {
    case "qr":
      return <QrPlaceholder size={el.width ?? 90} style={base} />;
    case "image":
      // Preset designs have no preset image assets; show a neutral placeholder.
      return (
        <div style={{ ...base, height: el.height ?? el.width ?? 80, background: "#e5e7eb" }} />
      );
    case "rect":
      return (
        <div
          style={{
            ...base,
            height: el.height,
            background: el.gradient
              ? `linear-gradient(${el.gradient.angle ?? 135}deg, ${el.gradient.from}, ${el.gradient.to})`
              : el.fill && el.fill !== "transparent"
              ? el.fill
              : "transparent",
            border: el.stroke ? `${el.strokeWidth ?? 1}px solid ${el.stroke}` : undefined,
            borderRadius: el.rx ? el.rx : undefined,
          }}
        />
      );
    case "ornament":
      return (
        <div
          style={{ ...base, width: el.width, height: el.height ?? el.width, lineHeight: 0 }}
          dangerouslySetInnerHTML={{
            __html: ornamentSvg(el.name ?? "", { color: el.color, orientation: el.orientation }),
          }}
        />
      );
    case "line":
      return (
        <div style={{ ...base, height: el.strokeWidth ?? 2, background: el.stroke ?? "#000" }} />
      );
    case "text":
    case "variable": {
      const raw =
        el.type === "variable" ? SAMPLE[el.variableKey ?? ""] ?? el.variableKey ?? "" : el.text ?? "";
      return (
        <div
          style={{
            ...base,
            fontSize: el.fontSize ?? 24,
            fontWeight: (el.fontWeight as number) ?? 400,
            color: el.fill ?? "#111827",
            textAlign: (el.textAlign as React.CSSProperties["textAlign"]) ?? "center",
            lineHeight: 1.3,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {raw}
        </div>
      );
    }
    default:
      return null;
  }
}

/** A lightweight QR-looking placeholder (the real QR is generated at issue time). */
function QrPlaceholder({ size, style }: { size: number; style: React.CSSProperties }) {
  return (
    <div style={{ ...style, width: size, height: size, background: "#fff", padding: size * 0.06 }}>
      <svg viewBox="0 0 7 7" width="100%" height="100%" shapeRendering="crispEdges">
        <rect width="7" height="7" fill="#fff" />
        {/* three finder squares + a few modules to read as a QR */}
        {[
          [0, 0], [0, 4], [4, 0],
        ].map(([x, y], i) => (
          <g key={i}>
            <rect x={x} y={y} width="3" height="3" fill="#111827" />
            <rect x={x + 1} y={y + 1} width="1" height="1" fill="#fff" />
          </g>
        ))}
        {[[4, 4], [5, 5], [4, 6], [6, 4], [5, 4], [4, 5]].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="1" height="1" fill="#111827" />
        ))}
      </svg>
    </div>
  );
}
