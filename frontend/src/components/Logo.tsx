// The real brand mark (public/logo-mark-{light,dark}.png), swapped for the
// theme via CSS (`dark:` classes react to the same <html class="dark">
// the blocking inline script in layout.tsx sets before first paint) rather
// than JS state, so there's no flash of the wrong-color logo on load.
//
// `forceDark` is for a container with a fixed dark background regardless
// of the app theme (e.g. the sidebar) — there the light variant would be
// invisible if the auto dark:/light: swap picked it in light mode.
export function LogoMark({ size = 22, className, forceDark = false }: { size?: number; className?: string; forceDark?: boolean }) {
  const style = { height: size, width: "auto" };

  if (forceDark) {
    return <img src="/logo-mark-dark.png" alt="" style={style} className={className} />;
  }

  return (
    <>
      <img src="/logo-mark-light.png" alt="" style={style} className={`dark:hidden ${className ?? ""}`} />
      <img src="/logo-mark-dark.png" alt="" style={style} className={`hidden dark:block ${className ?? ""}`} />
    </>
  );
}
