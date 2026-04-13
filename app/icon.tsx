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
          background: "#C84200",
          borderRadius: "6px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Topo contour lines — white, very subtle */}
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <path
            d="M -2,7 Q 16,3 34,7"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.2"
            opacity="0.12"
          />
          <path
            d="M -2,13 Q 16,9 34,13"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1"
            opacity="0.08"
          />
          <path
            d="M -2,19 Q 16,15 34,19"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.2"
            opacity="0.12"
          />
          <path
            d="M -2,25 Q 16,21 34,25"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1"
            opacity="0.08"
          />
        </svg>
        {/* "p" monogram — white on orange */}
        <span
          style={{
            fontFamily: "RibeyeMarrow",
            fontSize: "26px",
            color: "#FFFFFF",
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
