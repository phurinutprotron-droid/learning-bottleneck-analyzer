# Connect the GitHub Pages frontend to a backend

The Pages frontend needs a separately deployed FastAPI service and PostgreSQL.
The repository includes render.yaml for a preview with a Free Docker web service
and Free PostgreSQL. Review the plan in Render before creating resources. Free
PostgreSQL expires 30 days after creation and is unsuitable for long-term
student records. Free web services sleep while idle.

Create from the Blueprint:

https://render.com/deploy?repo=https://github.com/phurinutprotron-droid/learning-bottleneck-analyzer

Supply LBA_TEACHER_PASSWORD privately in Render. The handle defaults to
lba_teacher. Use 10 or more characters. Startup applies migrations, creates this
teacher if absent, and serves on Render's PORT. Existing passwords are never
overwritten. Remove the provisioning password from Render after first use.
Production demo accounts remain blocked.

After deployment:

1. Confirm https://YOUR_SERVICE.onrender.com/health returns 200.
2. Test teacher sign-in and cross-role access with synthetic data.
3. Set repository Actions variable VITE_API_BASE_URL to the exact HTTPS backend
   origin, without a trailing /api, and rerun the Pages workflow.
4. Open the public Pages site, sign in, create a synthetic learner, and verify
   assessment submission through the public frontend.

CORS is restricted to https://phurinutprotron-droid.github.io. It excludes the
repository path because browser origins do not contain paths. The blueprint
uses internal PostgreSQL and disables public database access.

To enable AI, set AI_PROVIDER, OPENROUTER_API_KEY, OPENROUTER_MODEL,
GEMINI_API_KEY and GEMINI_MODEL only in Render's server environment. Keep these
keys out of GitHub Pages and Vite variables. The default provider uses local
advisory rules until AI keys are configured.

Backend PostgreSQL checks run on GitHub Actions against a clean PostgreSQL 17
instance, covering migrations, startup, teacher provisioning, health,
authentication and CORS. This CI environment is separate from the hosted service.
