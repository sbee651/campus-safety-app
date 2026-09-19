# Vigil - NMU Campus Safety Prototype

Vigil is a hackathon prototype for Nelson Mandela University campus safety. It demonstrates student sign-in, terms acceptance, area-based security patrol assignment, SOS escalation, silent duress, Safe Walk route sharing, trusted contacts, campus alerts, incident reporting, a responder dashboard, privacy notes, language preference, and a safety directory.

The front end is intentionally small: one `index.html` file with inline CSS and vanilla JavaScript. A thin Node/Express API in `server/` connects the signup/signin path to SQL Server when available. If the API or database is unavailable, the front end falls back to local demo state and shows an inline offline-mode note.

## How to run

Open `index.html` directly in a browser.

For a local preview server, run:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173/`.

## Running the API

Prerequisites:

- Node.js 18 or newer.
- SQL Server, SQL Server Express, or LocalDB with the `CampusSafetyApp` database created by `SQLQuery1.sql`.

Set up the API:

```powershell
cd server
copy .env.example .env
npm install
npm start
```

The API runs on `http://localhost:3000` by default. `index.html` calls that hardcoded localhost URL for the hackathon demo. When the page is hosted over HTTPS, browser mixed-content rules can block calls to this local HTTP API. For the connected demo path, open `index.html` directly or serve it locally over HTTP.

Configure `server/.env` as needed:

- `DB_SERVER=(localdb)\MSSQLLocalDB`
- `DB_DATABASE=CampusSafetyApp`
- `DB_TRUSTED_CONNECTION=true` for Windows trusted auth / LocalDB.
- Or set `DB_USER`, `DB_PASSWORD`, `DB_SERVER`, `DB_DATABASE`, and optional `DB_PORT` for a full SQL Server instance.
- Optional Resend email delivery: set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `API_PUBLIC_BASE_URL`, and any patrol/security email recipients.

Quick checks:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
powershell -ExecutionPolicy Bypass -File scripts\test-api-contract.ps1
```

`GET /api/health` is intentionally a fast API liveness check and does not require SQL Server. Use signup/signin, analytics, or the SQL verification script to confirm database access. To verify the SQL script itself, run it twice with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify-sql.ps1
```

Use `-Server ".\SQLEXPRESS"` or another SQL Server name if LocalDB is not available.

The API exposes:

- `GET /api/health`
- `GET /api/patrol-coverage`
- `POST /api/signup`
- `POST /api/signin`
- `POST /api/forgot-password`
- `POST /api/reset-password`
- `POST /api/notify-emergency`
- `POST /api/alerts/:id/status`
- `GET /api/analytics/summary`

Password note: the API stores bcrypt password hashes in `dbo.Student.PasswordHash`. It never stores plaintext passwords. Seed students in `SQLQuery1.sql` intentionally have no password hash and must use the reset-password flow before real API sign-in. If Resend is not configured and `DEMO_MODE=true`, the API returns a short-lived demo reset token so the reset screen can still be judged locally.

## Data model note

`SQLQuery1.sql` is the SQL Server data model for the prototype. The signup/signin/reset path can now use the Express API to create and read `dbo.Student` rows, record accepted terms, store password hashes, and create an official `security-patrol` trusted contact when SQL Server is reachable. The API also returns short-lived in-memory auth tokens after signup, signin, and password reset. Emergency notification, alert-status, password reset, and analytics endpoints exist for demo integration, but most live response workflows are still simulated by the browser UI.

## Security patrol assignment

During signup, students choose their residential area. Vigil maps that area to ATLAS Security and/or CityWide Security coverage using the supplied Port Elizabeth area lists. If both providers cover the selected area, the student must choose one explicitly. The selected provider is added as an official, non-removable patrol contact.

Configured patrol contact details:

- ATLAS Security: `0861 585 585`, `info@atlas24.co.za`
- CityWide Security: `041 072 084`, `tech@citywide.co.za`

## Known limitations and simulated features

- Authentication is now backed by SQL Server and bcrypt for the signup/signin/reset demo slice, with short-lived in-memory API tokens. There are still no production JWTs, MFA, persistent sessions, or account lockout policy.
- SOS dispatch, trusted-contact notifications, responder acknowledgements, report submission, Safe Walk location, and analytics are still demo workflows unless the local API/email/database stack is configured and reachable.
- Silent duress is a long-press SOS prototype path with pointer, touch, and mouse support. It reuses the normal SOS notification flow and marks the alert as silent in the UI, but it is not connected to a production dispatch center.
- Language preference currently cycles the UI setting between English, isiXhosa, and Afrikaans; full app translation is not implemented.
- Safe Walk location uses sample NMU campus zones with simulated movement, not live device GPS.
- Directory and SOS phone links use `tel:` URLs; the user must tap the prepared call button before a call is placed.
- Map display depends on Leaflet and remote map tiles; if they are unavailable, the Safe Walk simulation still runs with a visible fallback message.
