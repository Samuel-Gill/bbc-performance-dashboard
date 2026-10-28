# UI/UX change summary

## Branding and navigation

The browser title, description, loading view, sidebar, welcome heading, exported filename/core title, package metadata and current documentation use **BBC Perfomance Dashboard**. Existing technical worksheet names and the previous IndexedDB name remain for compatibility. A hand-authored minimal navy church/cross SVG is supplied, with 16/32-pixel PNGs, an ICO and a 180-pixel touch icon. The 32-pixel icon was visually inspected.

Overview is now the default welcome page. Its church-inspired banner links to Dashboard and upload; live master counts, completion, schedule comparison, an at-risk/overdue union count, data status, five getting-started steps and seven working navigation tiles use actual workspace data. Empty state contains no invented performance figures. The existing analytical view remains as Dashboard; all other management/report pages remain available.

## Readability and interaction

Body text is 16 px, table content 14 px, form inputs 15 px, navigation 15 px, section headings approximately 20–23 px and page headings 28–30 px. Chart text is generally 13 px. Dark navy/charcoal and darker secondary text replace pale gray. Status badges retain words and values, not color alone. Planned/actual colors, rating colors, progress markers and labeled legends remain distinct. Objective details explain rating/status/schedule classifications. Scorecards retain their specific KPI weighting.

Primary actions use a restrained blue/teal palette; red/amber/green are semantic. Delivery status colors are mapped by status rather than the incidental group order. Empty charts display an explanation. Tables scroll within their containers. Objectives have a functional sort selector; filters, search, pagination, record dialogs and notifications perform real actions. Decorative nonfunctional menu dots were removed.

## Accessibility and responsive work

Added named navigation landmarks, current-page indication, named edit/delete/close/pagination controls, expanded state for filters, Escape closing, dialog focus containment/restoration, skip-to-content, native required fields, error alerts and reduced-motion support. Existing responsive structure was retained and updated at 650/850/1180/1350 px breakpoints, with mobile navigation, wrapped actions, readable cards and horizontal table scrolling.

Selected normal/hover/disabled text palettes were calculated against their backgrounds; see evidence/contrast.json. This is a token-level contrast check, not a claim that every composed state meets WCAG AA. Full screen-reader and contrast inspection is still required.

**Screenshots and rendered responsive QA: Not Tested.** Browser execution was blocked before page creation. No mock image is presented as a genuine screenshot. The supplied Playwright cases create Overview, Dashboard, Objective and multiple-width screenshots when run in a browser-capable environment.
