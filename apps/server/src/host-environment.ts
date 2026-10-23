/** Provider credentials must never be inherited by the evaluated MCP child. */
export function safeChildEnvironment(
  excludedNames: string[] = [],
  environment = process.env,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(environment).filter(
      (entry): entry is [string, string] =>
        entry[1] !== undefined &&
        !excludedNames.some((name) => name.toLowerCase() === entry[0].toLowerCase()) &&
        !/(key|token|secret|password|credential)/i.test(entry[0]),
    ),
  );
}
