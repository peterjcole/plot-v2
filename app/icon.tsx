import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
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
          borderRadius: "6px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Contour arcs */}
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <path
            d="M -2,8 Q 16,2 34,8"
            fill="none"
            stroke="#D4872B"
            strokeWidth="1.5"
            opacity="0.5"
          />
          <path
            d="M -2,13 Q 16,7 34,13"
            fill="none"
            stroke="#D4872B"
            strokeWidth="1"
            opacity="0.4"
          />
          <path
            d="M -2,18 Q 16,12 34,18"
            fill="none"
            stroke="#D4872B"
            strokeWidth="1.5"
            opacity="0.5"
          />
          <path
            d="M -2,23 Q 16,17 34,23"
            fill="none"
            stroke="#D4872B"
            strokeWidth="1"
            opacity="0.4"
          />
          <path
            d="M -2,28 Q 16,22 34,28"
            fill="none"
            stroke="#D4872B"
            strokeWidth="1.5"
            opacity="0.5"
          />
        </svg>
        {/* "p" monogram — absolute positioned to visually center
             (descender on "p" shifts baseline centering down) */}
        <span
          style={{
            fontFamily: "RibeyeMarrow",
            fontSize: "26px",
            color: "#4A5A2B",
            lineHeight: 1,
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -66%)",
          }}
        >
          p
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
