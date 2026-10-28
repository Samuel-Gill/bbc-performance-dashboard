# BBC Perfomance Dashboard — 2.0.1 patch

## Apply this patch

1. Stop the development server. Back up your project and export any browser workspace changes you need to keep.
2. Extract **BBC_Perfomance_Dashboard_Patch.zip into the project folder containing package.json**. Allow replacement of the existing files. The patch contains changed files, new server files, and your actual original Excel workbook.
3. Run `npm ci`, then `npm run dev`. Open the printed localhost URL. Your workbook loads automatically when there is no saved workspace: **5 goals, 20 objectives, 38 KPIs, 80 updates**.

Alternatively, extract the complete **BBC_Perfomance_Dashboard_Fixed.zip** and run the same commands inside its project folder.

Existing browser work is preserved. If a previous workspace opens instead of the original church data, export changes first, then use Workbook → Clear this workspace. On Overview choose **Load included workbook**, or reload the page. Locally, no workbook password is needed. Upload Excel remains available independently of the included workbook.

## Vercel setup

The workbook is intentionally included at `private/starter.xlsx`, outside `public/` and `dist/`. Use a **private source repository** because the source archive contains your real church workbook.

In Vercel project environment variables, set **BBC_WORKBOOK_PASSWORD** to a strong password of your choice and redeploy. On the first visit, enter that password in **Open your included church workbook**. The protected `/api/starter-workbook` endpoint returns the workbook only after password verification. With no password configured, the endpoint refuses access; Upload Excel still works. Never use a `VITE_` prefix for this server password.

Build command: `npm run build`. Output directory: `dist`. Keep the supplied `vercel.json`, `api/` and `private/` folders together. Do not upload only `dist/` to a static host if you expect included-workbook loading; a static-only host can still use ordinary Excel upload.

## Fixes

- Removed the lifetime Web Locks gate that could leave upload/editing disabled after Strict Mode setup/cleanup or unavailable locks. There is no longer a view-only startup lock. This browser-local app does not synchronize competing tabs; use one editing tab for a workspace.
- Added a FileReader fallback for browsers without File.arrayBuffer.
- Added original-workbook loading on first use, safe fallback when browser storage is unavailable, and a 15-second timeout so a stalled starter request cannot block startup indefinitely.
- Added protected Vercel loading without placing the workbook in public static assets. The password stays server-side; the entered value is sent in an authorization header and cleared from the form after loading.
- Changed the main palette and favicon to **church purple, gold, and white**. Semantic risk/completion badges retain their meaningful colors.

The earlier v2.0 audit reports remain historical references. This patch supersedes their statements about an empty first launch, no included workbook, the Web Locks guard and the original navy/teal palette. Formula rules and existing Excel round-trip behavior are unchanged.

Browser screenshots/responsive painting and a live Vercel deployment remain unverified in this execution environment. See PATCH_TEST_RESULTS.json for executed checks.
