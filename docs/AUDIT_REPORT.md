# Comprehensive application audit

**BBC Perfomance Dashboard · Version 2.0.0 · Review date: 27 October 2026 (America/New_York)**

## Delivery status

The existing React/Vite/TypeScript project was improved in place. The delivered source is build-ready and its executed calculation, record, import/export and DOM tests pass. This is **not a claim of completed browser visual QA, native Excel certification or a verified live deployment**. Those checks could not run here and remain release verification tasks.

## Scope inspected

Read the supplied master brief, complete application source and existing reference documents. Reviewed components, types, calculations, filters, charts, editor forms, relationship handling, IndexedDB, packaging and Vercel configuration. Inspected the actual supplied workbook's eight sheets, source values, table columns/calculated formulas, defined names, dropdown validation, conditional formatting, native chart bindings, slicer parts and calculation chain. Cached values were separated from date-dependent recalculation.

| Worksheet | Business records | Declared dimension | Expanded XML bytes |
| --- | --- | --- | --- |
| Dashboard | Report / control sheet | A1:R1048576 | 52,389,318 |
| Goals | 5 | A1:E31 | 7,931 |
| Objective Entry | 20 | A1:AC121 | 217,342 |
| KPI Tracking | 38 | A1:R183 | 344,151 |
| Objective Updates | 80 | A1:M301 | 409,146 |
| Analysis | Report / control sheet | A1:X59 | 78,023 |
| Lists | Report / control sheet | A1:AC34 | 16,998 |
| Instructions | Report / control sheet | A1:J41 | 9,998 |

The four source tables are tblGoals (A1:E31), tblObjectives (A1:AC21), tblKPI (A1:R181), and tblObjectiveUpdates (A1:M301). Blank prepared rows are not records. Dashboard XML alone expands to 52,389,318 bytes and declares the final Excel row. The importer intentionally avoids expanding Dashboard and Analysis; it reads source tables, controls, relationships and metadata instead.

## Architecture and relationships

Goals have many objectives. Each objective has KPI measurements and historical snapshots. IDs are strings. The raw source fields remain the source of truth; objectiveViews computes current derived fields, buildDashboard aggregates the selected objective scope, summarizeBy computes scorecards, and monthlyTrend averages dated snapshots. records.ts owns reusable validated mutations and ID allocation. workbook.ts owns OOXML interoperability and persistence. App.tsx uses memoized selectors and immutable record arrays.

Overview counts all master records, including newly created goals without objectives. Dashboard counts distinct goals represented by matching objectives. All dashboard cards, charts and exceptions share the filter/search scope; KPIs and updates are restricted to selected objective IDs. Record-page search narrows that page's records. Data Quality and Workbook intentionally inspect the whole workspace. Filters use OR within each dimension and AND between dimensions; year means the current objective's Last Update Date year.

## Findings and changes

| Area | Original behavior | Delivered behavior / action | Verification |
| --- | --- | --- | --- |
| Workbook confidentiality | Original workbook served from public/template.xlsx | Removed the workbook and automatic fetch; first use requires upload | Passed: build/public asset inspection |
| Welcome and naming | Overview was the analytical dashboard; legacy branding | New Overview, separate Dashboard, exact BBC name, favicon and metadata | Passed: source + DOM; rendered browser not tested |
| Reporting date | Implicit browser calendar and export-time date | New York calendar, manual/frozen date, persisted selection, matching export/reimport date | Passed |
| Invalid dates | Date.parse normalized dates such as February 30 | Strict ISO round-trip validation; reversed plans are unavailable and flagged | Passed |
| Variance aggregation | Difference between two averages with potentially different valid populations | Mean of valid objective variances, matching Dashboard I15 | Passed |
| KPI weighting | Executive and scorecard weighting already differed correctly | Preserved both definitions; added the distinct ministry KPI-row chart | Passed: independent unequal-KPI test |
| Required inputs | Blank/bad numeric input could become zero | Missing required progress/rating and malformed numeric cells reject import with record context | Passed |
| Schema and rows | Only the first five headers were checked; incomplete rows could disappear | All columns, four native tables and calculated definitions checked; populated ID-less rows reject | Passed |
| Relationships | Duplicates/orphans could open an ambiguous editable workspace | Case-insensitive duplicate checks, canonical parent references and atomic rejection | Passed |
| Identifiers | Counters not seeded before deletions or exported | Seed on load/import and before mutations; store next IDs in IndexedDB and custom XLSX properties | Passed |
| History/current state | New history could silently overwrite the current objective | Explicit Also apply option with date guard; editing/deleting history alone does not rewind current state | Passed |
| Excel dates | Fractional serial dates rounded to the next day; 1904 not handled | Floor serial dates; support both date systems; explain fake 1900-02-29 | Passed |
| Blank KPI actuals | Excel interpreted a blank actual as zero during division | Exported calculated formula explicitly checks blank target, blank actual and zero target | Passed: formula/cache checks; native Excel engine not tested |
| Export calculation state | Old calculation chain retained; uncontrolled date caches | Remove chain and references; full recalculation; named reporting date; preserve input/derived roles | Passed: structural verification |
| Table growth | Prepared ranges and styles were insufficiently checked | Grow tables/validations; copy cell styles; restore formulas through prepared rows; avoid overlapping rating validation | Passed: XML and round-trip checks |
| Controlled lists | New ministry/role values could be absent from exported controls | Write controlled list values back and grow their named ranges | Passed |
| Local saving | Debounced writes lacked queue/status and race protection | Queued saves, latest-state status, failure notification, pending-save unload prompt | Passed: successful persistence; quota recovery not browser-tested |
| Navigation/accessibility | Small/light text, unnamed icons, decorative menu control | Larger/darker tokens, accessible button names, dialogs with focus trap/Escape, skip link, real sort control | Passed DOM; visual/accessibility audit incomplete |
| Empty views/search | Empty charts lacked explanations; dashboard search narrowed exceptions only | Explicit empty states; shared dashboard search scope; pagination resets after record changes | Passed DOM/data; chart painting not tested |
| Toolchain | No lockfile, lint or browser suite; old Vitest dependency advisories | Lockfile, strict checks, ESLint, Vitest 5, React DOM tests and four Playwright cases | Passed install/type/lint/build; npm audit reports 0 advisories |

## Formula conclusions

The core supplied thresholds are retained: ratings 1–2 at risk; ratings 4–5, no overdue date and status other than Completed on track; variance strictly below -15 pp behind plan; KPI mean strictly below 80% a KPI exception; due in 0–30 days with actual below 70% a due-soon exception. Severity weights remain 100/40/35/25/30/20/20/15 as specified by the source. Ties use later source rows first. There are no invented Critical/High severity bands.

The original arithmetic was mostly correct for complete baseline data. Confirmed differences centered on missing values, malformed dates, paired aggregation, ID persistence and import/export reliability. Completed-objective cards are a new explicit metric: actual equals 100%, independent of manually entered status. A manual Completed status below 100% is reported as inconsistent. Source rating, status and actual progress are not silently rewritten to make them agree.

## Import policy and integrity

Import validates before replacing the active workspace. Duplicate identifiers and orphaned relationships reject the file. Empty prepared rows are ignored; data on a row without an ID is rejected with a row-specific message. Required progress/rating and malformed numbers never become plausible zeros. Optional KPI targets/actuals may remain blank; zero targets remain reviewable and have no ratio. Custom imported dropdown values are retained. Finite invalid ranges and missing descriptive/date fields remain visible in Data Quality for repair rather than being silently discarded.

Rows may be reordered or added without a fixed row-count limit. Columns must retain the supplied schema/order; extra columns, missing table definitions or lost calculated-column definitions receive clear errors. This intentionally refuses unsafe custom schemas rather than exporting them incorrectly. Safety limits are 30 MB compressed, 300 MB declared expanded content, 15 MB per imported source sheet/shared strings, 1 MB per table definition and 10,000 ZIP entries. XML DTD/entity declarations are rejected. ZIP64/very large workbooks are outside this browser workflow.

Input formulas need valid cached results. The source model's editable fields are imported as facts and exported as values; custom formulas placed in these fields are not retained. All supplied calculated table columns are retained and regenerated. This customization boundary is described in the README and formula report.

## Export fidelity and independent evidence

The mandatory workflow imported the actual workbook, added one goal and two objectives, added two KPIs and two history entries, edited an existing goal/KPI, created and safely deleted a disposable goal, exported, and imported into a new dataset. The result contained **6 goals, 22 objectives, 40 KPIs and 82 updates**, with exact source values, stable relationships/counters, and equal derived results. A second test performed the workflow through actual React forms and a fresh local workspace.

Independent Python ZIP/XML inspection matched **1,294 editable fields** and **154 independently recomputed objective values**. All 46 XML/relationship parts were well-formed; ZIP CRC, unique IDs and business references passed. Seven native charts and seven slicer caches remain. SHA-256 comparisons verified 20 preserved dashboard, chart, drawing, slicer, style and theme parts. These are preservation checks, not evidence of native Excel recalculation.

Source tables grow without shrinking prepared capacity. New rows receive styles and formulas. Date-dependent table and Analysis formulas use the exported BBC_ReportingDate name. Reimport restores that reporting date; selecting Today returns to the live New York calendar. Automatic/full recalculation is requested and the obsolete calculation chain is removed. Original Analysis layout and native chart bindings remain; their caches can show the previous snapshot until Microsoft Excel recalculates.

## Native Excel limits

Native goal charts reference only 10 or 11 prepared categories; ministry charts reference seven prepared rows. The Analysis goal scorecard has a 30-row prepared area. These bindings are not automatically expanded to every newly created goal/ministry. Appending a new ministry after placeholder list entries can therefore leave it outside a native chart even when the React view includes it. Slicer category/cache refresh after growth must be checked in desktop Excel. No pixel-perfect or unlimited native Excel reporting claim is made. The React reports use actual observed records and are independent of those capacities.

Export preserves original chart/dashboard/other shared-string caches. Deleting a record removes it from active tables; this is not forensic erasure of every older label/cache in the workbook. Use a separately sanitized workbook before distributing sensitive data. No private workbook is included in public build assets or in the delivered source archive.

## Persistence and performance

IndexedDB stores source bytes, current records, counters and reporting selection in this browser. Saves are queued, with visible status and an export instruction on failure. The old technical database name is retained to migrate previous workspaces. Web Locks implements a one-editor-tab guard where supported; its real-browser behavior remains unverified. Browsers without that API can still have competing tabs; there is no cross-device or multiuser synchronization.

The 1,200-objective/1,200-KPI/1,200-update synthetic creation/import/export/reimport benchmark completed in approximately 13.8 seconds in Node/jsdom. This includes fixture generation and ZIP compression; it is not a browser responsiveness/memory benchmark. XML DOM work remains on the main thread, so worker-based processing is a medium-priority improvement for large files. The original oversized dashboard formatting remains preserved for compatibility.

## Known verification limits

Local Chromium exited with SIGTRAP before opening a page. The remote browser could not reach the local server. Consequently no genuine application screenshots, responsive-layout inspection, tooltip painting, full keyboard/screen-reader audit, download dialog behavior or tab-lock browser test is claimed. DOM interaction and selector tests provide substantial functional evidence but do not replace those checks. Microsoft Excel and Vercel account deployment were unavailable; native recalculation, slicer refresh and a deployed version are Not Tested.
