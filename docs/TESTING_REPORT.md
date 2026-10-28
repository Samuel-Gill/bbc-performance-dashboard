# Testing report

**Final executed results: 100 passed, 0 failed · 5 Vitest files.**

## Executed checks

| Check | Status | Evidence / practical limit |
| --- | --- | --- |
| Dependency installation | Passed | npm install completed; package-lock.json delivered |
| TypeScript strict check | Passed | npm run typecheck |
| ESLint | Passed | npm run lint |
| Vite production build | Passed | npm run build; Vite 6.4.5 |
| Formula/boundary tests | Passed | 38 independent calculation tests plus 9 retained domain tests |
| Record mutation tests | Passed | 24 tests for automatic IDs, validation, history and safe deletion |
| Import/export tests | Passed | 20 tests, including original workbook, native table checks, 1904 dates and 1,200-record workload |
| React DOM integration | Passed | 9 tests; actual forms, filters, search, cancel, history opt-in, delete confirmation, persistence and full round trip |
| Original XLSX independent inspection | Passed | 1,294 editable fields; 154 derived values; ZIP CRC; 46 well-formed XML parts |
| Native part preservation | Passed | SHA-256 matches for 20 native parts, including dashboard, 7 charts and slicer/cache parts |
| Dependency advisory scan | Passed | npm audit: zero reported advisories at execution; not a general security certification |
| Playwright discovery | Passed | Four browser cases discovered by npm run test:e2e -- --list |
| Actual Playwright page execution | Not Tested | Local Chromium exited SIGTRAP before page creation; remote browser could not reach local server |
| Responsive visual inspection / screenshots | Not Tested | No real desktop/mobile rendered screenshots could be captured |
| Tooltips, chart painting, browser download UI | Not Tested | DOM chart data is tested, jsdom has no layout engine |
| Real Web Locks / concurrent tabs | Not Tested | Guard implemented; browser test supplied |
| Native Microsoft Excel recalculation / slicer refresh | Not Tested | Excel unavailable; formula/caches/parts inspected independently |
| Live Vercel deployment | Not Tested | No Vercel account deployment connection used |
| Full WCAG/screen-reader audit | Not Tested | Focus/Escape/labels tested in DOM; selected palette contrast computed; full audit remains |
| Browser quota/failure recovery under real storage pressure | Not Tested | Error handling implemented; actual quota exhaustion not simulated in a browser |

## Test file results

| Test file | Passed | Failed |
| --- | --- | --- |
| src/App.test.tsx | 9 | 0 |
| src/lib/calculations.test.ts | 38 | 0 |
| src/lib/domain.test.ts | 9 | 0 |
| src/lib/records.test.ts | 24 | 0 |
| src/lib/workbook.test.ts | 20 | 0 |

## Exact mandatory round-trip execution

1. Imported the actual original workbook: 5 goals, 20 objectives, 38 KPIs, 80 updates.
2. Added G006.
3. Added OBJ021 and OBJ022 under G006.
4. Added KPI039 and KPI040, including a percentage-unit measurement.
5. Added UPD0081 and UPD0082 as historical snapshots.
6. Edited an existing goal and KPI, preserving IDs and numeric precision.
7. Created and safely deleted disposable G007.
8. Exported the updated source workbook with formulas, metadata and reporting date.
9. Imported into a fresh dataset; separately repeated equivalent actions through React forms and a fresh persisted workspace.
10. Compared every business record, relationships, next-ID counters and derived calculations. New next goal ID is G008, so deletion did not allow reuse.

Result: 6 goals, 22 objectives, 40 KPIs and 82 updates. Exact data and derived-result comparisons passed. Python independently parsed the resulting archive and recalculated seven derived values for every objective. Prepared objective table range grew to A1:AC23; original prepared capacities of other tables remain intact.

## Scale check

Created/imported/exported/reimported 1,200 objectives, 1,200 KPIs and 1,200 updates without loss, fixed count truncation, duplicate IDs or orphaned links. End-to-end synthetic test time was 13.76 seconds in Node/jsdom. This is a reproducible functional scale check, not a browser load-time or memory benchmark.

## Browser attempts and failed checks

The ordinary Playwright browser download was unusable in this environment. A registry-provided Chromium binary was available but terminated with SIGTRAP before any page opened, including a blank page attempt. The independent cloud browser returned ERR_CONNECTION_REFUSED for the local app. Therefore the four supplied Playwright cases and screenshots are recorded as Not Tested, not Passed. No persistent site was deployed solely to bypass this limitation.

During development, a preservation assertion initially pointed at the Goals XML instead of resolving the Dashboard part by relationships; the test was corrected and now verifies the actual Dashboard. A focus-restoration test initially used a synthetic click without focusing its trigger; it was corrected to exercise keyboard focus. Both corrected assertions pass in the final run. There are no unresolved failures among the 100 executed tests.

Recharts reports zero-width/height warnings in jsdom because it cannot measure rendered containers. These warnings are retained in development test output. They are an explicit reason not to claim chart layout or painting was validated.

## Reproduce

```bash
npm ci
npm run typecheck
npm run lint
BBC_WORKBOOK_PATH="/absolute/path/to/original.xlsx" npm test
npm run build
python scripts/inspect_xlsx.py .cache/evidence/round-trip.xlsx --expected .cache/evidence/round-trip-expected.json
npx playwright install chromium
npm run test:e2e
```

Without BBC_WORKBOOK_PATH the original-template test is intentionally skipped. No private workbook is bundled. npm test creates the anonymous fixture used by the browser suite. Browser screenshot output paths are defined in e2e/workflows.spec.ts for 390, 834 and 1440-pixel views. Verification scripts never rewrite a workbook using Python spreadsheet libraries.
