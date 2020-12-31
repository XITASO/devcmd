export function formatCommandName(commandName: string, baseStyler: Styler, highlightStyler: Styler): string {
  return quoted(commandName, baseStyler, highlightStyler);
}

export function formatCommandArgs(args: string[] | undefined, baseStyler: Styler, highlightStyler: Styler): string {
  return !!args && args.length > 0
    ? baseStyler("[") + args.map((a) => quoted(a, baseStyler, highlightStyler)).join(",") + baseStyler("]")
    : "";
}

function quoted(s: string, quoteStyler: Styler, textStyler: Styler): string {
  return quoteStyler('"') + textStyler(s) + quoteStyler('"');
}

export type Styler = (s: string) => string;
