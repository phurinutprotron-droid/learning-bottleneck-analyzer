# Synthetic student cohort

Created on 12 November 2026 for the owner's requested software demonstration.
These are invented accounts and responses, not observations from children,
research participants, human assent, or evidence of educational effectiveness.

## Online data

The existing Neon database now contains 100 new `is_demo=true` student identities,
`sim_lba_001` through `sim_lba_100`. Grades 7/8/9 (Thai Mathayom 1/2/3) contain
34/33/33 students. Anonymous labels begin with `SIM-`.

- Ten students have not started; fifteen have a partially answered/open baseline;
  seventy-five have completed mathematics and science sample baselines.
- There are 165 assessments (150 completed, 15 open) and 933 synthetic answers.
- Five scenario patterns vary correctness, reasoning and confidence. These are
  generator parameters, not diagnoses or calibrated student ability estimates.
- Correctness and lexical rubric fields are computed by the existing grader
  from generated answers. The two deployed subject snapshots were retained
  exactly. This is not a full Ministry curriculum simulation.
- No consent, intervention, follow-up result, AI review or diagnostic completion
  was generated. No provider requests or paid services were used.

Research users can enable **Include demonstration accounts in this view and
export** on the Research dashboard. Ordinary research totals exclude the cohort.
The production teacher roster also excludes demo accounts. The separate public
judge interface remains its existing isolated frontend example; it does not read
these database records.

These identities have deliberately unusable credentials. They cannot sign in,
and no sessions were provisioned. They are not 100 accounts for distribution to
real students. Do not convert them into real participants or remove `is_demo`.

## Generation and repeatability

The generator is `app.simulation.cohort` and uses fixed IDs, timestamps and a
seeded random source. The CLI defaults to file generation without database
writes. From the repository root on Windows:

```powershell
& .\.venv\Scripts\python.exe -B scripts\create_simulated_students.py
```

This default uses all locally installed sample packs. The actual online import
used `--existing-packs` with an operator-read snapshot of the two deployed packs.
Generated JSON, CSV and append-only PostgreSQL transaction statements stay in
the ignored `.cache/simulated-students` folder. Generated records are not source
files to commit. `--apply-local` explicitly applies the dataset only to the
existing development SQLite database. It refuses production configuration.

The PostgreSQL importer uses one transaction, an advisory lock, immutable
version checks, cohort collision guards and `ON CONFLICT DO NOTHING`. Reruns do
not reset existing answers. Review the destination before applying an export.
No database schema or existing ordinary account was modified.

## Verification

All 49 tests in the local backend suite passed, including five new tests for
exact cohort size, grade/scenario variety, grading integrity, partial completion,
idempotent import, exclusion from ordinary research and rejected sign-in.
The live database confirmed exactly 100 new students, 165 assessments and 933
answers, no synthetic sessions or consent rows, and the same fingerprint for all
nine pre-existing users. The public API rejected a synthetic sign-in with HTTP
401 and its health endpoint returned HTTP 200. The staff dashboard was not
browser-tested with private staff credentials during this import.
