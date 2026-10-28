# Vercel deployment instructions

1. Extract the ZIP and use the folder containing package.json as the project root. Keep private workbooks outside this folder; public/ contains only icon assets.
2. Use a supported Node 22.12+ or Node 24.x environment; this delivery was tested with Node 24.22.1. Run npm ci, npm run check, and the browser suite before release.
3. Push the source to your repository and import the repository into Vercel. Select the Vite framework preset and the correct project root.
4. Use install command `npm ci`, build command `npm run build`, and output directory `dist`. The existing vercel.json already declares the Vite build/output and SPA rewrite. Select Node 24.x for parity with the verified runtime where available.
5. No environment variables, server/API, external database or secrets are required for this local-browser version. Test-only BBC_WORKBOOK_PATH and BROWSER_EXECUTABLE variables are optional developer settings, not production configuration.
6. Open the deployment: check the exact title/favicon, empty Overview, upload the workbook, edit/test records, refresh, export and reimport. Inspect desktop/mobile layouts, chart labels and the browser console. Verify that a second tab becomes view only in browsers supporting Web Locks.
7. Open an exported copy in desktop Microsoft Excel and complete the native-report/slicer checks described in the testing report. Keep an exported backup before replacing or clearing a workspace.

Only dist/ is served. No private source workbook is included in it. .vercelignore excludes test/evidence folders, and .gitignore excludes workbooks generated in .cache, dependency folders and build outputs. This version provides a local browser workspace; hosting the shell does not add shared data, cloud backup or sign-in.

**Live deployment: Not Tested.** No Vercel project was created or modified during this assignment. Build success/configuration checks establish build readiness, not a verified hosted session.

Official references: [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build) and [Vite static deployment](https://vite.dev/guide/static-deploy). These support the explicit build/output settings above; they do not substantiate any claim that this project has been deployed.
