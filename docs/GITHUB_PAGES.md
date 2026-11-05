# GitHub Pages deployment

1. Create a public repository named learning-bottleneck-analyzer and initialize it with a README.
2. Upload this source tree to its main branch. Exclude node_modules, dist, local environment files and databases.
3. In repository Settings, open Pages and select GitHub Actions as the build source.
4. Run the Deploy LBA to GitHub Pages workflow, or push a commit to main. The workflow tests, builds, and publishes frontend/dist.
5. Open https://phurinutprotron-droid.github.io/learning-bottleneck-analyzer/ after the Pages deployment succeeds.

## Connect the application backend

GitHub Pages serves the React frontend. Run the FastAPI backend and PostgreSQL using docs/DEPLOYMENT.md on a host with HTTPS and persistent storage.

Set the repository Actions variable VITE_API_BASE_URL to the HTTPS origin of that backend, without /api at the end. This URL is public configuration. Gemini and OpenRouter keys belong exclusively in the backend environment.

Set backend CORS_ORIGINS to ["https://phurinutprotron-droid.github.io"]. Origins do not include the repository path. Run migrations, create a teacher account, and verify /health on the backend host. Then rerun the Pages workflow.

Without the backend variable, the published frontend displays its sign-in page and reports a configuration error when an API action is attempted. It does not simulate successful sign-in or learner results.

Direct portal links use the published 404.html SPA fallback and may have HTTP status 404 while displaying the application. Prefer the site root when sharing the link.

## Verification before public use

Confirm workflow success and asset loading. Through the HTTPS site, test teacher and student sign-in, cross-student access denial, assessment submission, and authorized AI use. Local tests and build results do not establish that this public integration works.
