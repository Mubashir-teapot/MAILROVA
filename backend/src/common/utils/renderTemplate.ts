// ponytail: minimal {{ dot.path }} substitution against a data object. The source
// app's Go html/template + Sprig function library isn't reimplemented — swap in a
// real template engine (e.g. Handlebars) if campaigns need loops/conditionals.
export function renderTemplate(source: string, data: Record<string, unknown>): string {
  return source.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
    const value = path.split(".").reduce<unknown>((acc, key) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
      return undefined;
    }, data);
    return value === undefined || value === null ? "" : String(value);
  });
}
