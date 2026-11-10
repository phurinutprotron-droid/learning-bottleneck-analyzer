# Judge preview and loading states

The public judge entry is `https://phurinutprotron-droid.github.io/learning-bottleneck-analyzer/?portal=judge`.

The owner requested credentials displayed and filled in. Public preview handle `lba_judge` and password `LBA-Judge-2026!` are convenience values for the isolated frontend demonstration. They do not provision or authenticate a production staff account.

## Preview boundaries

The judge can choose student, teacher or researcher at entry and switch views within the persistent example-data banner. The data in `frontend/src/services/judgePreview.ts` is fixed, illustrative and cloned for each response. There are no real student records, keys or backend sessions in that module.

The API client intercepts exactly three public preview tokens before backend URL construction or fetch. Preview reads are allowlisted. Unknown records and all writes are rejected. The two local POST exceptions close the local preview and open a clearly labelled, prewritten report for an already completed example. New analysis, answer saving, AI generation, interventions and data export remain unavailable in preview. Production authentication, role enforcement and the production demo-account block are unchanged.

Assessment fields can be tried temporarily, with an explicit notice and disabled Save button. They do not change the fixed dataset. Reports state that they are prewritten examples, and the research summary states that its illustrative values are not research results.

## Loading behavior

The initial HTML displays a branded ring while the JavaScript entry is loading. React replaces that markup when the application is ready. Shared Pending indicators use the same mark and optional decorative skeleton lines. Login uses the compact indicator only while its actual request is pending. There are no fabricated percentages, forced minimum waits or simulated analysis-completion timers.

Status text remains accessible to screen readers. `prefers-reduced-motion` renders static marks and skeletons. No new package is required.

## Validation

- Eighteen frontend tests passed. The nine new tests cover public credential entry, no-backend preview loading, independent payloads, write/export/unknown-record rejection, prewritten report boundaries, research demo filtering, preservation of normal authenticated fetch, accessible pending labels and request-bound login loading/error cleanup.
- Local Chromium captured 36 views at 1440, 390 and 320px with no viewport overflow or uncaught runtime exceptions.
- The local judge phase issued zero API network requests. Boot loading was tested by holding the actual entry-module request. Login loading was tested with a held authentication request and a controlled 401 response.
- Reduced-motion animation names were checked as `none`. Login error handling removed the compact loader and re-enabled the button.
- Independent source and screenshot review found no blocking issue. Safari/iOS and screen-reader operation were not exercised.

The live browser workflow runs after a successful Pages deployment. It verifies the public judge link, posted credentials, all three views, no backend record requests from the preview, and real-backend rejection of a public preview token. Its normal synthetic student registration is erased during cleanup.
