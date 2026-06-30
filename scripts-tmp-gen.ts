// @ts-nocheck
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.window = globalThis;
globalThis.document = { addEventListener: () => {} };
const { generatePreparerWeeklyReports } = await import('./src/services/preparerReportGenerator');
const week = process.argv[2];
const r = await generatePreparerWeeklyReports(week);
console.log(JSON.stringify(r));
