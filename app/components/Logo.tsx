interface LogoProps {
  size: "sm" | "lg";
  className?: string;
}

type ContourLine = { d: string; index?: boolean; elevation?: number };

// Complex mountainous terrain in a 600×300 coordinate space.
// A main ridge runs left-to-right with the summit left-of-center (~230,x).
// A secondary bump/spur appears on the right (~420,x).
// Lines have organic irregularity — wobbles, re-entrants, variable spacing.
// Strictly ordered top-to-bottom, never intersecting.
const contourLines: ContourLine[] = [
  // 450m — near summit, tight and complex
  { d: "M 40,28 C 80,22 120,14 160,8 C 190,3 210,-1 230,-3 C 255,-1 280,4 310,12 C 340,20 370,30 400,36 C 420,34 435,30 448,28 C 462,30 480,36 510,42 C 540,48 580,52 620,54" },
  // 440m
  { d: "M 20,42 C 60,36 100,26 145,18 C 178,11 205,6 230,4 C 258,6 286,14 318,24 C 348,34 376,44 404,48 C 424,45 440,40 454,38 C 470,40 490,48 522,56 C 552,62 590,66 630,68" },
  // 430m
  { d: "M 0,58 C 42,50 84,40 130,30 C 166,22 200,14 230,12 C 262,14 294,26 328,38 C 358,48 384,58 410,62 C 430,58 446,52 462,50 C 480,52 502,60 536,70 C 566,78 600,82 640,84" },
  // 420m
  { d: "M -20,74 C 24,66 68,54 118,44 C 156,35 196,26 230,24 C 266,26 300,38 336,52 C 366,62 392,72 418,76 C 438,72 454,66 470,64 C 490,66 514,74 548,84 C 578,92 614,98 654,100" },
  // 410m
  { d: "M -40,92 C 8,82 54,70 106,58 C 146,48 190,38 230,36 C 268,38 306,52 344,66 C 374,78 400,88 426,92 C 446,87 462,80 478,78 C 498,80 524,90 560,100 C 590,108 628,114 668,116" },
  // 400m — INDEX
  { d: "M -40,110 C 4,100 48,86 98,74 C 140,63 186,52 230,50 C 270,52 310,66 350,82 C 380,94 408,104 434,108 C 454,103 470,96 486,94 C 508,96 534,106 570,116 C 600,124 640,130 680,132", index: true, elevation: 400 },
  // 390m
  { d: "M -40,128 C 0,118 42,104 90,92 C 134,80 182,68 230,66 C 272,68 314,82 356,98 C 386,110 414,120 440,124 C 460,119 476,112 494,110 C 516,112 544,122 580,132 C 612,140 652,146 692,148" },
  // 380m
  { d: "M -40,146 C -4,136 38,122 84,110 C 128,98 178,86 230,84 C 274,86 316,100 360,116 C 390,128 420,138 446,142 C 466,137 482,130 500,128 C 524,130 552,140 588,150 C 620,158 660,164 700,166" },
  // 370m
  { d: "M -40,164 C -8,154 34,140 78,128 C 122,116 174,104 230,102 C 276,104 320,118 364,134 C 394,146 424,156 452,160 C 472,155 488,148 508,146 C 532,148 560,158 596,168 C 628,176 668,182 708,184" },
  // 360m
  { d: "M -40,182 C -12,172 30,158 72,146 C 118,134 170,122 230,120 C 278,122 324,136 368,152 C 398,164 428,174 458,178 C 478,174 494,168 514,166 C 538,168 566,176 602,186 C 634,194 674,200 714,202" },
  // 350m — INDEX
  { d: "M -40,200 C -16,190 26,176 66,164 C 112,152 166,140 230,138 C 280,140 328,154 372,170 C 402,182 432,192 462,196 C 482,192 500,186 520,184 C 546,186 574,196 610,206 C 642,214 680,220 720,222", index: true, elevation: 350 },
  // 340m
  { d: "M -40,218 C -18,208 22,194 60,182 C 108,170 162,158 230,156 C 282,158 330,172 376,188 C 406,200 436,210 466,214 C 486,210 504,204 526,202 C 552,204 582,214 618,224 C 650,232 688,238 726,240" },
  // 330m
  { d: "M -40,234 C -20,226 18,212 56,200 C 104,188 158,178 230,176 C 284,178 332,190 378,206 C 410,218 440,228 470,232 C 490,228 510,222 532,220 C 558,222 588,232 624,242 C 656,250 694,256 732,258" },
  // 320m
  { d: "M -40,250 C -22,242 14,230 52,218 C 100,206 156,196 230,194 C 286,196 334,208 382,224 C 414,236 444,246 474,250 C 494,246 514,240 538,238 C 566,240 596,250 632,260 C 664,268 700,274 738,276" },
  // 310m
  { d: "M -40,266 C -24,258 10,246 48,236 C 96,224 152,214 230,212 C 288,214 338,226 386,242 C 418,254 448,264 478,268 C 498,264 518,258 544,256 C 572,258 602,268 638,278 C 670,286 706,290 744,292" },
  // 300m — INDEX
  { d: "M -40,282 C -26,274 8,264 44,254 C 92,242 148,232 230,230 C 290,232 340,244 390,260 C 422,272 452,282 482,286 C 502,282 524,276 550,274 C 578,276 610,286 646,296 C 678,304 714,308 752,310", index: true, elevation: 300 },
  // 290m
  { d: "M -40,298 C -28,290 6,280 40,270 C 88,260 146,250 230,248 C 292,250 342,262 392,278 C 426,290 456,300 486,304 C 506,300 528,294 556,292 C 586,294 618,304 654,314 C 686,322 720,326 758,328" },
  // 280m
  { d: "M -40,312 C -30,306 4,296 36,288 C 84,278 142,268 230,266 C 294,268 344,280 396,294 C 430,306 460,316 490,320 C 510,316 534,310 562,308 C 592,310 624,320 660,330 C 692,336 726,340 764,342" },
];

const sizeConfig = {
  sm: {
    textClass: "text-3xl",
    viewBox: "40 40 520 240",
    wrapperPadding: "px-10 py-5",
    strokeWidth: 2.2,
    indexStrokeWidth: 4.0,
    showLabels: false,
    fadeStops: [
      { offset: "0%", opacity: 1 },
      { offset: "30%", opacity: 0.85 },
      { offset: "55%", opacity: 0.4 },
      { offset: "75%", opacity: 0.08 },
      { offset: "90%", opacity: 0 },
    ],
    fadeScaleX: 240,
    fadeScaleY: 120,
  },
  lg: {
    textClass: "text-6xl",
    viewBox: "-40 -20 680 360",
    wrapperPadding: "px-24 py-16",
    strokeWidth: 1.4,
    indexStrokeWidth: 2.8,
    showLabels: true,
    fadeStops: [
      { offset: "0%", opacity: 1 },
      { offset: "35%", opacity: 0.95 },
      { offset: "60%", opacity: 0.7 },
      { offset: "80%", opacity: 0.3 },
      { offset: "100%", opacity: 0 },
    ],
    fadeScaleX: 340,
    fadeScaleY: 190,
  },
};

export default function Logo({ size, className = "" }: LogoProps) {
  const config = sizeConfig[size];
  const uid = `logo-${size}`;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${config.wrapperPadding} ${className}`}
    >
      {/* Contour lines SVG */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={config.viewBox}
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <radialGradient
            id={`${uid}-grad`}
            gradientUnits="userSpaceOnUse"
            cx="300"
            cy="160"
            r="1"
            gradientTransform={`translate(300 160) scale(${config.fadeScaleX} ${config.fadeScaleY}) translate(-300 -160)`}
          >
            {config.fadeStops.map((stop, i) => (
              <stop key={i} offset={stop.offset} stopColor="white" stopOpacity={stop.opacity} />
            ))}
          </radialGradient>
          <mask id={`${uid}-mask`}>
            <rect x="-200" y="-200" width="1000" height="700" fill={`url(#${uid}-grad)`} />
          </mask>
        </defs>

        <g mask={`url(#${uid}-mask)`} className="stroke-accent" strokeLinecap="round" strokeLinejoin="round">
          {contourLines.map((line, i) => {
            const pathId = line.index ? `${uid}-p${i}` : undefined;
            return (
              <path
                key={i}
                id={pathId}
                d={line.d}
                strokeWidth={line.index ? config.indexStrokeWidth : config.strokeWidth}
                strokeOpacity={line.index ? 0.8 : 0.5}
              />
            );
          })}

          {/* Elevation labels on index contours */}
          {config.showLabels &&
            contourLines.map((line, i) => {
              if (!line.index || line.elevation == null) return null;
              return (
                <text
                  key={`lbl-${i}`}
                  className="fill-accent"
                  fontSize="12"
                  fontWeight="400"
                  fontFamily="Arial, Helvetica, sans-serif"
                  opacity="0.75"
                  dominantBaseline="central"
                >
                  <textPath
                    href={`#${uid}-p${i}`}
                    startOffset="46%"
                    textAnchor="middle"
                  >
                    {line.elevation}
                  </textPath>
                </text>
              );
            })}
        </g>
      </svg>

      {/* Logo text — translucent so contours weave through */}
      <span
        className={`relative z-10 font-logo text-primary ${config.textClass} leading-none select-none`}
        style={{ opacity: 0.7 }}
      >
        plot
      </span>
    </div>
  );
}
