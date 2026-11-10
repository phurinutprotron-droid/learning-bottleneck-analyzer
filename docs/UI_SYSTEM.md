# Shared LBA interface

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
