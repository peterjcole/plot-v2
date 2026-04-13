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
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#C84200",
          borderRadius: "36px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Topo contour lines — white, low opacity */}
        <svg
          width="180"
          height="180"
          viewBox="0 0 180 180"
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <path d="M -10,18 Q 90,5 190,18" fill="none" stroke="#ffffff" strokeWidth="2.5" opacity="0.12" />
          <path d="M -10,32 Q 90,19 190,32" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.07" />
          <path d="M -10,46 Q 90,33 190,46" fill="none" stroke="#ffffff" strokeWidth="2.5" opacity="0.12" />
          <path d="M -10,60 Q 90,47 190,60" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.07" />
          <path d="M -10,74 Q 90,61 190,74" fill="none" stroke="#ffffff" strokeWidth="2.5" opacity="0.12" />
          <path d="M -10,88 Q 90,75 190,88" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.07" />
          <path d="M -10,102 Q 90,89 190,102" fill="none" stroke="#ffffff" strokeWidth="2.5" opacity="0.12" />
          <path d="M -10,116 Q 90,103 190,116" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.07" />
          <path d="M -10,130 Q 90,117 190,130" fill="none" stroke="#ffffff" strokeWidth="2.5" opacity="0.12" />
          <path d="M -10,144 Q 90,131 190,144" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.07" />
          <path d="M -10,158 Q 90,145 190,158" fill="none" stroke="#ffffff" strokeWidth="2.5" opacity="0.12" />
          <path d="M -10,172 Q 90,159 190,172" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.07" />
        </svg>
        {/* GPS route trace above wordmark */}
        <svg
          width="100"
          height="36"
          viewBox="0 0 100 36"
          style={{ position: "relative", marginBottom: "8px" }}
        >
          {/* Route line */}
          <path
            d="M 10,26 C 24,18 30,22 40,14 C 52,6 60,10 75,8"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />
          {/* Start dot */}
          <circle cx="10" cy="26" r="4" fill="#ffffff" opacity="0.7" />
          {/* End waypoint — filled ring */}
          <circle cx="75" cy="8" r="7" fill="#ffffff" opacity="0.9" />
          <circle cx="75" cy="8" r="3.5" fill="#C84200" />
        </svg>
        {/* "plot" wordmark */}
        <span
          style={{
            fontFamily: "RibeyeMarrow",
            fontSize: "72px",
            color: "#FFFFFF",
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
