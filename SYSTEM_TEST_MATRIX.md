# LBA system test matrix

| Workflow | Executed evidence | Result / remaining coverage |
| --- | --- | --- |
| Registration, login, logout, role access | API tests and live student, teacher and researcher demo smoke | Pass. Invalid credentials, ownership and expired session rejection tested. Live administrative provisioning not exercised. |
| Classroom CRUD, import and teacher boundaries | Route/schema inspection | Missing classroom features. Student ownership is enforced and teachers have access across the deployment. |
| Assessment validation and persistence | API workflow and frontend form tests | Pass for current sample multiple choice, short answers, reasoning, confidence, immutable responses, consent and completion. Image and executable-code formats absent. |
| Math, science, coding | Isolated API workflows and versioned pack inspection | Sample workflows pass. Grade- and difficulty-stratified accuracy and alignment remain unverified. |
| Diagnostic evidence and competing hypotheses | Synthetic deterministic fixtures | Pass for the tested correctness/reasoning combinations, confidence independence, contradiction and insufficient evidence. Human diagnostic accuracy pending. |
| Graph traversal | Unit tests | Prerequisite traversal and cycle rejection pass. Depth, missing edges and contradictory provenance require further checks. |
| Verification | Unit and integrated API tests | Pending assignment reuse, distinct item eligibility and contradictory evidence pass. No validated stopping criterion or difficulty adjustment. |
| Intervention, post and transfer | Integrated API test | Assignment, completion, post and transfer persistence pass. Early retention request rejected. Successful delayed retention was not exercised in this pass. |
| Reporting and export | Integrated API, demo exclusion and metric tests | Aggregate export excludes raw learner identifiers in the fixture and excludes demo data by default. Date-range and classroom filters absent. |
| Gemini | Mock provider suite and live MCP call | Mock schema and fallback cases pass. Live model lookup 200 and generation 503. Deterministic fallback returned with explicit provenance. |
| Curriculum | API role check and source archive inspection | Student access denied, staff status returned, generation readiness false. Full ingestion coverage, OCR and expert review pending. |
| Migration and build | scripts/test.ps1 | 33 backend tests, 7 frontend tests, migration drift check and production build passed. SQLite migration round-trip covered by backend tests. |
| Browser/device and PostgreSQL deployment | Scope review | Not exercised in this pass. Frontend tests use a simulated DOM and mocked API; live smoke verifies HTTP and role endpoints. |

All test learners and assessment observations used for automated validation are synthetic. The live smoke read demo views and signed out the test sessions. No student assessment evidence was submitted to the live installation.
