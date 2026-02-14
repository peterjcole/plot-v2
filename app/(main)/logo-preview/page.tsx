import Logo from "@/app/components/Logo";

// Dark mode token values for inline style overrides
const darkTokens = {
  "--background": "#1C1008",
  "--foreground": "#F0ECE6",
  "--primary": "#A3B86E",
  "--primary-light": "#B8CC83",
  "--primary-lighter": "#CDDF9C",
  "--primary-dark": "#8FA45A",
  "--accent": "#E09B45",
  "--accent-light": "#EBAF62",
  "--text-primary": "#F0ECE6",
} as React.CSSProperties;

export default function LogoPreviewPage() {
  return (
    <div className="min-h-screen bg-background p-8 md:p-12">
      <h1 className="text-3xl font-semibold text-text-primary mb-2">Logo Preview</h1>
      <p className="text-text-secondary mb-12">Large and small variants, light and dark</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Light mode */}
        <div className="rounded-xl border border-border p-8 bg-[#FFF8EC]">
          <p className="text-xs uppercase tracking-wider text-[#7A7168] mb-6">
            Light
          </p>
          <div className="flex flex-col items-center gap-12">
            <Logo size="lg" />
            <Logo size="sm" />
          </div>
        </div>

        {/* Dark mode (inline token overrides) */}
        <div
          className="rounded-xl border border-[#4A3420] p-8"
          style={{ backgroundColor: "#1C1008", ...darkTokens }}
        >
          <p className="text-xs uppercase tracking-wider text-[#8E857A] mb-6">
            Dark
          </p>
          <div className="flex flex-col items-center gap-12">
            <Logo size="lg" />
            <Logo size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
