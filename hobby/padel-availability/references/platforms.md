# Platform-specific notes

Detailed navigation notes for each club, gathered from live inspection. Sites change their frontends over time — if a step described here doesn't match what you see, adapt based on what's actually on the page rather than assuming the note is wrong forever, but flag the drift to the user so these notes can be refreshed.

## Open platforms (no login required)

### padelisland.ge
- Availability grid: `http://booking.padelisland.ge/Booking/Grid.aspx` (redirects to https)
- Runs on "TPC Matchpoint" booking software — a full grid of courts (rows) x times (columns) for the selected date, color-coded: Busy / Open Matches / Your Booking (open = uncolored/default).
- Multiple locations exist (EXPO Park Tbilisi, Gymnasia Sport Park / Lisi Lake, Marco Polo Gudauri, Ambassadori Kachreti). The grid page shows one location at a time — look for a location switcher near the date picker.
- A cookie consent banner appears on first load; dismiss with "Decline" (privacy-preserving default).
- Take an accessibility snapshot after selecting the date/location — the busy/open state is conveyed visually (color), so use `boxes: true` or zoom into the grid image region if the plain text snapshot doesn't disambiguate slot status clearly.

### padelhub.ge
- Booking wizard: `https://www.padelhub.ge/booking`
- Steps: 1) Select Sport (Padel / Pickleball) 2) Select Court (Open / Closed) 3) Select Date 4) Select Time (only enabled buttons = available; disabled = booked or past) 5) confirm.
- No login appears anywhere through step 4. Stop there — you have the answer (available time buttons) without needing to go further into the flow.
- Cookie banner: click "Reject optional".

### gymbreeze.ge
- Booking widget is embedded directly on the homepage: `https://gymbreeze.ge/eng` (a "Court Booking" side panel, not a separate page).
- Fields: Select Location (combobox — currently "Ninoshvili Street" and "Barbare Bairamashvili" locations), Date (calendar — only ~7 days ahead are enabled), Time (buttons, disabled = booked).
- No login needed to see slot availability. A "Sign In" button exists separately in the header but is not required for viewing.
- Cookie banner: click "Reject".

### kustbapadel.ge
- Booking wizard: `https://kustbapadel.ge/en/booking/`
- Steps: 1) Select Time (date grid, then a list of time slots for that date) 2) Select Service 3) Summary.
- Important quirk: this system only lists slots that are actually available — a booked hour is simply absent from the list rather than shown as disabled. E.g. if the list jumps from 20:00 to 22:00, then 21:00 is booked.
- No login required to view.
- There's a "GE" language link and an "en" prefix on the URL; stick with `/en/` paths for English.

### tbilisipadel.ge
- Booking widget is on the homepage: `https://tbilisipadel.ge/` (Georgian) — an English mirror exists at `https://tbilisipadel.com/`.
- Steps: 1) კორტი / Court (select one of several courts, each has an hourly price) 2) თარიღი და დრო / Date & Time (calendar with enabled/disabled dates, then a duration selector) 3) ინფორმაცია / Info 4) რეზიუმე / Summary.
- No login required to view courts and times. A modal reminding users to refresh before booking may appear on load — just close it.
- If the page loads in Georgian, either read it as-is (labels above are the Georgian originals) or switch to the `.com` English mirror.

## Gated platforms (login required)

### padelbade.com — try the public API first
- The consumer-facing booking app lives at `https://app.padelbade.com`, and clicking "Book Court" on the marketing site sends you straight to `https://app.padelbade.com/#/auth` — a Sign In / Register wall with no calendar visible before authenticating.
- **However**, the app's backend is a SaaS platform called "BookAndGo", and this endpoint is public — no auth, no cookies, just a plain GET:
  `https://api.bookandgo.app/api/v1/apps/58/locations`
  It returns JSON with padelbade's locations, sports, courts (with numeric court IDs), coaches, and `app_bookable_days_in_future` per court. Confirmed working via direct navigation in a browser with no session.
- **Before falling back to the login flow**, try to find a sibling endpoint on `api.bookandgo.app` that returns actual time-slot availability for a given court/location ID — it's very likely to exist given the REST-y shape of `/api/v1/apps/58/locations` (e.g. try patterns like `/api/v1/apps/58/courts/{court_id}/availability`, `/api/v1/apps/58/bookings/{court_id}`, or inspect network requests made by `app.padelbade.com/#/auth` and any other pages of the app for calls to `api.bookandgo.app` that fire before login — some apps fetch a public calendar preview even on the auth screen). Use `browser_network_requests` while navigating the app to look for these.
- If a working availability endpoint is found, hitting it directly with `WebFetch` or a browser navigation is far faster and more reliable than driving the login-walled UI, and this platform effectively becomes an "open" one. Note it here (update this file) if you find and confirm the pattern, so future runs skip straight to it.
- If no such endpoint can be found this run, fall back to the login policy in `SKILL.md` (check persisted session, or ask the user to log in).
- **Patterns tried and confirmed NOT to work** (all returned a generic Express 404 "Cannot GET ..."): `/api/v1/apps/58/courts/{id}/availability`, `/api/v1/apps/58/bookings/availability?court_id={id}&date=...`, `/api/v1/apps/58/slots?court_id={id}&date=...`. Don't re-try these exact patterns — worth trying different shapes (e.g. inspecting the Flutter app's actual XHR calls post-login via `browser_network_requests` once someone has authenticated once, to learn the real endpoint) rather than more blind guessing.
- Known location IDs so far: Tbilisi/Krtsanisi (163), Rustavi/Crocobet Courts (142), Tbilisi/Dighomi (141).

### padelacademy.ge
- Booking app: `https://booking.padelacademy.ge`
- Flow: shows a "sports complex rules" modal first — check the "ვეთანხმები წესებს" (I agree to the rules) checkbox, then click "შესვლა" (Enter), which redirects straight to `/login` (username + password, custom self-hosted system — not BookAndGo).
- No public data API was found for this one on initial inspection — only a translations endpoint (`/api/translations/en`) which carries no booking data. Treat login as unavoidable here unless a future check turns up something.
- After a successful login the booking calendar should be reachable from the app's main screen — explore once authenticated to find the actual grid/wizard.
