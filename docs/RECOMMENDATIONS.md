# Outstanding recommendations and acceptance status

## Required release verification and known limits

| Priority | Item | Why it remains | Action / status |
| --- | --- | --- | --- |
| Critical | None identified in executed checks | All 100 executed tests, strict checks and build pass | This does not eliminate untested browser/native risks |
| High | Browser acceptance and visual QA | No browser page could be launched here | Run four Playwright cases, review desktop/mobile screenshots, console, dialogs, tooltips, download and real tab lock |
| High | Native Microsoft Excel acceptance | OOXML preservation and caches cannot prove Excel recalculation or slicer refresh | Open a copy, verify reporting date, all expanded rows, Refresh All/slicers, dashboard totals and native charts |
| High when Excel reports must include new categories | Native fixed chart/category ranges | Goal charts use 10/11 category rows; ministry charts seven prepared rows; new values can be outside bindings | Use React reporting immediately; extend/test native Analysis/chart/slicer bindings before relying on Excel for the additional categories |
| High if shared organizational editing is required | No multiuser storage or access control | Current architecture is browser local by design | Do not treat hosting as a shared workspace; scope authentication, a transactional data store and permissions as a separate project |
| Medium | Large-workbook responsiveness | 1,200-record functional cycle is correct, but DOM/ZIP work stays on main thread | Measure target browsers; move parsing/export to workers if needed |
| Medium | Browser storage failure/concurrency QA | Successful persistence is tested; real quota pressure and missing Web Locks support remain | Test failure recovery and enforce one editor per browser/profile where guard support is absent |
| Low | Workbook over-formatting | Dashboard declares 1,048,576 rows and 52 MB XML | Clean a separate source-template copy in Excel, then compare native objects before adopting it |
| Low | Custom input formulas | Editable input formulas export as cached values; source workbook has none | Keep a source backup or extend formula-aware editing if future customized input formulas are required |

These are known limits and required verification tasks, not concealed passing results. Optional roadmap ideas are separate: installable/offline packaging, record reassignments, configurable fiscal periods, signed audit history and more advanced KPI direction semantics. None is required to reproduce the current workbook's verified arithmetic.

## Acceptance criteria

| Criterion | Status | Evidence or blocker |
| --- | --- | --- |
| Exact product name and church icon | Passed | Current UI/source metadata; icon assets included |
| Larger/darker readable typography | Implemented; visual QA incomplete | CSS/tokens updated; no rendered browser inspection |
| Functional default Overview | Passed | DOM live counts/navigation/empty state |
| Existing pages retained | Passed | Dashboard plus all original management/report pages |
| Excel calculations compared and confirmed discrepancies fixed | Passed | Independent all-objective/date/aggregate tests |
| Dynamic metrics / selectors | Passed | Calculation and DOM mutation tests |
| Rendered charts update/resize correctly | Not Tested in browser | Live data selectors checked; actual SVG painting/tooltip layout unverified |
| Automatic unique Goal/Objective IDs | Passed | Successive adds, gaps, imported max, deletion, remount and XLSX counter metadata |
| CRUD and history workflows | Passed domain/DOM | Full form round trip plus targeted mutation tests; browser E2E not run |
| Original workbook import | Passed | Actual attachment imported |
| Updated export and fresh reimport | Passed | 6/22/40/82 exact round trip |
| Identifiers and relationships survive | Passed | Exact data/next-ID and independent inspection |
| Filters/search/navigation | Passed DOM | Multiple simultaneous filters, clear, search and navigation |
| Responsive rendered interface inspected | Incomplete | CSS reviewed and browser tests supplied; browser execution unavailable |
| Automated tests run | Passed | 100 executed tests; 4 browser cases not executed |
| Production build verified | Passed | TypeScript + Vite build |
| Vercel build readiness | Passed configuration/build | Live Vercel deployment not tested |
| Limitations/incomplete checks disclosed | Passed | README and audit/testing/recommendation reports |
