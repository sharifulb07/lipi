export function normalizeBangla(input: string): string {
  return input.normalize("NFC").replace(/\u200B|\u200C|\uFEFF/g, "").replace(/[ \t]+/g, " ").replace(/\s+([\u09BE-\u09CC\u09D7])/g, "$1").normalize("NFC").trim();
}
export function countBanglaCharacters(input: string): number {
  return input.match(/[\u0980-\u09FF]/g)?.length ?? 0;
}
export function containsBangla(input: string): boolean {
  return /[\u0980-\u09FF]/.test(input);
}

