---
name: padel-availability
description: Find available/free padel court booking slots across Tbilisi padel clubs (padelisland.ge, padelhub.ge, gymbreeze.ge, kustbapadel.ge, tbilisipadel.ge, padelbade.com, padelacademy.ge) for a given date, time window, or location. Use this skill whenever the user asks about padel court availability, free padel slots, booking a padel court in Tbilisi, wants to compare multiple padel venues at once, or asks something like "any padel courts free tonight/tomorrow/this weekend" — even if they only name one club, or don't name any club at all. Also use this skill if the user asks to set up, reconnect, or troubleshoot the Playwright browser session used to check these sites (e.g. "the padel skill needs login again", "reconnect padel bade").
---

# Padel Court Availability

Check real-time court availability across Tbilisi's padel clubs and hand back one unified answer instead of making the user click through seven different booking sites themselves.

## Before anything else: confirm Playwright is set up

This skill drives real browser sessions via the Playwright MCP server, and needs it configured with a **persistent** profile so that logins survive across runs (see "The login boundary" below for why that matters).

1. Check whether a `playwright` MCP server is already configured and connected (look for `mcp__playwright__*` tools, or check `.mcp.json` in the project root).
2. If it's missing, add it yourself:
   ```
   claude mcp add playwright --scope project -- npx -y @playwright/mcp@latest --user-data-dir ./.playwright-profile
   ```
   This merges into any existing `.mcp.json` rather than overwriting it.
3. Make sure `.playwright-profile/` is listed in `.gitignore` at the project root — add the line if it's missing. This directory ends up holding real login session cookies once the user authenticates anywhere, so it must never be committed or shared between people. Each user builds up their own local profile through their own logins.
4. If you just added the server in step 2, it won't be usable yet — MCP servers only connect at Claude Code startup. Tell the user setup is done and ask them to restart Claude Code, then run this skill again. Don't try to proceed further in this same run.
5. If Playwright was already configured and connected, skip straight to the workflow below.

## The login boundary — read this before touching any gated site

Two of the seven platforms (padelbade.com, padelacademy.ge) don't show any calendar until you're logged in. It's tempting to just power through that with a throwaway account, but don't — **never create an account or type into a password/login field yourself, on any platform, even if the user explicitly says it's fine.** This holds regardless of the account being real or disposable, and regardless of permission given. It's the same category of boundary as "don't enter someone's credit card number" — not a judgment call to make case by case.

What you do instead: open the login or signup page in the browser (Playwright MCP runs headed by default, so a real, visible browser window appears on the user's screen) and explicitly hand off — tell the user the page is ready and ask them to complete signup/login themselves in that window. Wait for a sign it succeeded (the URL moving off `/login` or `/#/auth`, or a post-login element like an account menu appearing) before you resume driving the page.

Because the browser profile is persistent (see setup above), this is a one-time cost per platform per user — once they've logged in, the session sticks around for every future run.

## Workflow

**1. Figure out what the user wants.** Extract a date/time window and, if mentioned, a preferred area of Tbilisi from their request. If they didn't specify, default to "today and tomorrow, any location" and say that's what you're checking — don't stop to ask unless the request is genuinely ambiguous (e.g. they said "this weekend" and it's unclear which weekend).

**2. Check the 5 open platforms directly** — no login involved, always do these regardless of what happens with the gated two: padelisland.ge, padelhub.ge, gymbreeze.ge, kustbapadel.ge, tbilisipadel.ge. Read `references/platforms.md` for the specific URL and navigation steps for each — they each have a different booking widget shape, so don't assume one pattern fits all.

Be a good citizen of these sites: navigate and read at a normal pace, don't hammer the same page in a tight loop, and prefer reading the accessibility snapshot over repeated screenshots.

**3. Handle the 2 gated platforms.** For each of padelbade.com and padelacademy.ge:
- First, for padelbade.com specifically, check `references/platforms.md` for the public BookAndGo API lead — if a working availability endpoint exists (either already documented there or found by you this run via `browser_network_requests`), use it directly instead of the browser UI. No login needed, no boundary concern, much faster.
- Otherwise, check whether the persisted session is still valid: navigate to the booking page and see whether it bounces to a login/auth screen.
  - **Session valid** → read availability the same way as the open platforms, silently, no need to involve the user.
  - **Session missing or expired** → stop and ask the user in chat whether they want to log in now (you'll open the page and hand off per the login boundary above) or skip this platform for the current search. Respect whatever they choose. If they skip, don't push it again mid-conversation, but it's fine to offer again on a future, separate run since their session state may have changed by then.

**4. Aggregate and present one unified answer.** Don't make the user cross-reference seven separate blocks of output themselves. Use this shape:

```
## Padel courts — [date/time window checked]

**[Club name] — [Location]**
- 18:00–19:00 — available
- 20:00–21:00 — available

**[Club name] — [Location]**
- No open slots in this window

---
Not checked: [Platform name] (skipped — no login this session)
```

Sort or group however is most useful given what the user actually asked for (e.g. by time if they care about "tonight", by location if they mentioned an area). Clearly mark any gated platform that was skipped so the user knows the picture is partial, not that those courts are fully booked.

## Reference

See `references/platforms.md` for per-platform URLs, exact step-by-step navigation, and known quirks (e.g. which sites show disabled buttons for booked slots vs. simply omitting booked times from a list). Treat it as a living document — if a site's frontend has visibly changed from what's described there, adapt to what you actually see and update the file so the next run benefits.
