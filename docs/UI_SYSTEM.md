# Shared LBA interface

## Selection sliding — 2026-11-11

The owner requested smooth sliding after selecting a button. A shared persistent highlight now follows sign-in portal buttons, workspace destinations and the Home activity-period control. It measures actual button bounds and follows scrolling, font/language changes and responsive layout. CSS transitions retarget the existing marker during rapid clicks. The first measurement is placed without animation, and observers/frames are cleaned up for unmount and React StrictMode replay.

Page content enters with a small directional horizontal movement. The Suspense boundary wraps content so navigation stays mounted during the first lazy research/graph load. Reduced motion uses a static highlight with a short opacity-only content fade. Existing pressed/current-page semantics and button focus remain on the controls.

Local Chromium verified six intermediate movement samples, final alignment, rapid retargeting without remount, language changes, 320/390/1440px layouts, mobile teacher-menu scrolling and reduced-motion computed styles. No runtime exceptions were observed. The existing 18 frontend tests are retained. The live browser check also verifies marker alignment and persistence across lazy content.

The owner approved the learner Home reference for all pages on 2026-11-10. The common materials are a light gray canvas, rounded white cards, green actions, a compact desktop navigation rail and a labelled mobile dock. Teacher and researcher sign-in retain distinct teal and muted violet accents with the existing motto crossfade.

## Implementation

`frontend/src/workspace.css` supplies the shared shell and materials for student, teacher and researcher workspaces, registration, sign-in, assessments, evidence/AI controls, curriculum intake, exam drafting, research tables and the knowledge graph dialog. `design-tokens.css` is the committed CSS export from the local OpenDesigner system. Card and control radii are 24px and 16px. New Home summaries use authenticated profile data, and the subject tree precedes assessment history.

The graph refits on container resize and supports a smaller minimum zoom so all nodes fit narrow screens. Node details remain available through the labelled select and dialog. Tables scroll within their own containers. The teacher dock scrolls horizontally when its six destinations exceed the screen width. Every destination retains its full accessible name.

## Validation

- Nine frontend tests passed, including empty Home data and resuming an unfinished assessment older than the four recent records.
- TypeScript and Vite production build passed.
- A local Chromium review operated 29 role/page states at 1440, 390 and 320px, producing 87 captures. Document overflow, viewport expansion, missing mobile navigation and uncaught runtime exceptions were asserted absent.
- Review included all three sign-in portals, learner registration, student Home/assessments/progress/evidence/assessment form, teacher roster/profile/research/evidence/AI controls/curriculum/exam form, researcher research/curriculum, and graph/graph dialog/dark graph for each role.
- Graph node bounds were checked inside the canvas after resizing, including the eight-concept All subjects view at 320px. Reduced-motion styles disable the existing decorative transitions and counter animation. The first Home review measured its reduced-motion bar transition at 0s.
- Independent source and screenshot review identified clipped navigation labels and graph resize fitting. Both issues were corrected before publication.

Screenshots and local browser data use explicitly labelled synthetic fixtures. Browser review exercised local UI rendering. Safari/iOS and assistive-technology operation were not exercised. AI provider generation and backend capacity were outside this visual change.

The production frontend continues to use the HTTPS backend origin configured in the existing Pages workflow. No API keys, database URLs, login credentials or student records are part of this release.

## Published verification

GitHub Pages deployment [42832405913](https://github.com/phurinutprotron-droid/learning-bottleneck-analyzer/actions/runs/42832405913) passed fresh dependency installation, all nine frontend tests, production build and public HTML/script/logo checks. The new shared CSS was independently fetched from the public site.

Live browser [42832665301](https://github.com/phurinutprotron-droid/learning-bottleneck-analyzer/actions/runs/42832665301) passed actual student registration, subject/profile API calls, CORS, rendered Home and mobile overflow checks. Its synthetic account was erased through the authenticated API during cleanup. This live check covers the student entry flow, while staff and research screen coverage above comes from the local synthetic-fixture review.
