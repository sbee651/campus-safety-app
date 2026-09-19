 Guardian - NMU Campus Safety Prototype

Guardian is a single-page hackathon prototype for Nelson Mandela University campus safety. It demonstrates student sign-in, SOS escalation, Safe Walk route sharing, trusted guardians, campus alerts, incident reporting, a responder dashboard, privacy notes, and a safety directory.

The app is intentionally self-contained in `index.html`: inline CSS, vanilla JavaScript, no build tools, and no backend. Runtime state is held in a JavaScript object and persisted to `localStorage`.

   How to run

Open `index.html` directly in a browser.

For a local preview server, run:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173/`.

   Data model note

`SQLQuery1.sql` is kept as the intended production data model for a future SQL Server backed version. The current hackathon prototype is not connected to that schema: there is no live backend, API, connection string, or database client in the running web app. `index.html` currently stores prototype state in `localStorage` only.

   Known limitations and simulated features

- Authentication is simulated. Student and campus security roles only route to different prototype screens.
- SOS alerts, guardian notifications, responder acknowledgements, and report submission are simulated in the browser.
- Safe Walk location uses sample NMU campus zones with simulated movement, not live device GPS.
- Directory phone links use `tel:` URLs, but no calls are placed by the app itself.
- Map display depends on Leaflet and remote map tiles; if they are unavailable, the Safe Walk simulation still runs with a visible fallback message.
