# Guardian - NMU Campus Safety Prototype

Guardian is a hackathon prototype for Nelson Mandela University campus safety. It demonstrates student sign-in, SOS escalation, Safe Walk route sharing, trusted guardians, campus alerts, incident reporting, a responder dashboard, privacy notes, and a safety directory.

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

The API runs on `http://localhost:3000` by default. `index.html` calls that hardcoded localhost URL for the hackathon demo.

Configure `server/.env` as needed:

- `DB_SERVER=(localdb)\MSSQLLocalDB`
- `DB_DATABASE=CampusSafetyApp`
- `DB_TRUSTED_CONNECTION=true` for Windows trusted auth / LocalDB.
- Or set `DB_USER`, `DB_PASSWORD`, `DB_SERVER`, `DB_DATABASE`, and optional `DB_PORT` for a full SQL Server instance.

Quick checks:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

The API exposes:

- `GET /api/health`
- `POST /api/signup`
- `POST /api/signin`

Password note: this prototype does not store passwords in SQL Server. The API requires the password field so the current form remains realistic, but signup stores only the student profile, and signin is an email lookup. This keeps the demo from storing plaintext passwords while avoiding a rushed production-auth implementation.

## Data model note

`SQLQuery1.sql` is the SQL Server data model for the prototype. The signup/signin path can now use the Express API to create and read `dbo.Student` rows when SQL Server is reachable. All other app features still run as browser-side simulation/local state.

## Known limitations and simulated features

- Authentication is not production-secure. Passwords are not stored or verified; signin is a prototype email lookup through the API when available, or a local demo fallback when unavailable.
- SOS alerts, guardian notifications, responder acknowledgements, and report submission are simulated in the browser.
- Safe Walk location uses sample NMU campus zones with simulated movement, not live device GPS.
- Directory phone links use `tel:` URLs, but no calls are placed by the app itself.
- Map display depends on Leaflet and remote map tiles; if they are unavailable, the Safe Walk simulation still runs with a visible fallback message.
