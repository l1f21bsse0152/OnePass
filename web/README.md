# OnePass Control Center

The shared web dashboard provides role-based workspaces for administrators and facility accounts. Ordinary users continue to use the OnePass mobile app.

## Run locally

1. Start the backend from the repository root with `npm --prefix backend run dev`.
2. In another terminal, run `npm --prefix web run dev`.
3. Open the Vite URL (normally `http://localhost:5173`) and sign in with an admin or facility account. Authentication always uses the existing OnePass backend.
4. Choose **Sample data** to browse the isolated dashboard fixtures, or **Live OnePass data** to use existing records. You can switch the data source from the dashboard header.

The Vite development server proxies `/api` requests to `http://localhost:5000`. Sample records are maintained in `backend/src/data/demo/dashboard.json` and served by the separate `/api/demo` routes. They are never inserted into MongoDB or mixed with live API results. Demo edits exist in server memory only and reset when the backend restarts. Set `VITE_API_URL` to the deployed API URL, including its `/api` path, when building for another environment.

## Create dashboard accounts

Use **Create account** on the sign-in page to register a Facility or Admin account. Registrations require email verification. Admin registration is restricted by the server-side `ADMIN_SIGNUP_EMAIL` setting and is disabled after an admin account exists; facility accounts can self-register but need an admin to assign their locations.

The authorized admin email is configured in the local backend environment and is not included in the repository. If SMTP verification is unavailable, from the repository root run `npm --prefix backend run create-admin` in an interactive terminal. The command asks for a name and email, then prompts for a password without displaying it. It creates an admin only when the configured database has no admin account.

Use **Forgot password?** on the sign-in page to request a one-time email code and set a new password. Codes expire after 10 minutes.

The sign-in page can remember the email address on the current device. Passwords are never stored by the dashboard; the password fields use browser password-manager autocomplete. The profile button at the bottom of the dashboard sidebar opens real account details, profile-photo controls, and password settings backed by the protected `/api/auth/me` endpoints.

Admins can request a login-email change from Profile & settings. The current password and an OTP sent to the new address are required before the account email is replaced. The authorized Admin signup email is configured separately with `ADMIN_SIGNUP_EMAIL`.

## Dashboard features

- Admin: platform overview, analytics, user directory, facility approvals and directory, transactions, and access activity.
- Facility: owned facility overview, check-in history, and QR-code generation.
- Both dashboard roles can open profile and account settings from the sidebar.
- Facility QR tokens are stored as hashes and are returned only once. Download or print a newly generated QR immediately; replacing it revokes the existing code.

Build the production bundle with `npm --prefix web run build`.
