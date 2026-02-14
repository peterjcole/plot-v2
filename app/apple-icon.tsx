import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const fontData = await fetch(
    "https://fonts.gstatic.com/s/ribeyemarrow/v26/GFDsWApshnqMRO2JdtRZ2d0vEAw.ttf"
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FFF8EC",
          borderRadius: "36px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Contour arcs — more detail at this size */}
        <svg
          width="180"
          height="180"
          viewBox="0 0 180 180"
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <path
            d="M -10,30 Q 90,10 190,30"
            fill="none"
            stroke="#D4872B"
            strokeWidth="3"
            opacity="0.5"
          />
          <path
            d="M -10,46 Q 90,26 190,46"
            fill="none"
            stroke="#D4872B"
            strokeWidth="2"
            opacity="0.35"
          />
          <path
            d="M -10,60 Q 90,40 190,60"
            fill="none"
            stroke="#D4872B"
            strokeWidth="3"
            opacity="0.5"
          />
          <path
            d="M -10,76 Q 90,56 190,76"
            fill="none"
            stroke="#D4872B"
            strokeWidth="2"
            opacity="0.35"
          />
          <path
            d="M -10,92 Q 90,72 190,92"
            fill="none"
            stroke="#D4872B"
            strokeWidth="3"
            opacity="0.5"
          />
          <path
            d="M -10,108 Q 90,88 190,108"
            fill="none"
            stroke="#D4872B"
            strokeWidth="2"
            opacity="0.35"
          />
          <path
            d="M -10,124 Q 90,104 190,124"
            fill="none"
            stroke="#D4872B"
            strokeWidth="3"
            opacity="0.5"
          />
          <path
            d="M -10,140 Q 90,120 190,140"
            fill="none"
            stroke="#D4872B"
            strokeWidth="2"
            opacity="0.35"
          />
          <path
            d="M -10,156 Q 90,136 190,156"
            fill="none"
            stroke="#D4872B"
            strokeWidth="3"
            opacity="0.5"
          />
        </svg>
        {/* "plot" text — legible at 180×180 */}
        <span
          style={{
            fontFamily: "RibeyeMarrow",
            fontSize: "72px",
            color: "#4A5A2B",
            lineHeight: 1,
            position: "relative",
          }}
        >
          plot
        </span>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "RibeyeMarrow",
          data: fontData,
          style: "normal" as const,
          weight: 400 as const,
        },
      ],
    }
  );
}
