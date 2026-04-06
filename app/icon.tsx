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
          background: "#070E14",
          borderRadius: "6px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle dark-teal contour arcs */}
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <path
            d="M -2,8 Q 16,2 34,8"
            fill="none"
            stroke="#1E4858"
            strokeWidth="1.5"
            opacity="0.7"
          />
          <path
            d="M -2,14 Q 16,8 34,14"
            fill="none"
            stroke="#1E4858"
            strokeWidth="1"
            opacity="0.5"
          />
          <path
            d="M -2,20 Q 16,14 34,20"
            fill="none"
            stroke="#1E4858"
            strokeWidth="1.5"
            opacity="0.7"
          />
          <path
            d="M -2,26 Q 16,20 34,26"
            fill="none"
            stroke="#1E4858"
            strokeWidth="1"
            opacity="0.5"
          />
        </svg>
        {/* "p" monogram in orange */}
        <span
          style={{
            fontFamily: "RibeyeMarrow",
            fontSize: "26px",
            color: "#E07020",
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
