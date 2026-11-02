# Callforge

A free, browser-only power dialer: load a list, dial through it with one click per call, read your script with names filled in, get a live transcript, and export results to CSV.

**Cost: $0.** There's no server and no account. Calls go out through the phone number you already have, and everything is saved in your browser.

## How it works

1. **Import list.** Paste numbers or upload a CSV. A header row with `phone` (plus optional `name`, `first_name`, `last_name`, `company`, `notes`) is picked up automatically. Without a header, each line is read as `Name, Phone, Company`. Duplicate numbers are skipped.
2. **Start dialing.** The number opens as a `tel:` link and your device places the call (see setup below).
3. **On the call.** The script shows with `{first_name}`, `{company}` and the rest filled in. The transcript tab writes down what the mic hears. Type notes as you go.
4. **Log the result.** Click a button or press `1`–`7` (No answer, Voicemail, Gatekeeper, Not interested, Callback, Interested, Bad number).
5. **Power dial.** After a short countdown (3 seconds by default, changeable in Settings) it dials the next pending number. Press **Stop session** or **Skip** at any time.
6. **Export CSV.** You get each contact's result, call count, last call time and length, notes and transcript.

Shortcuts: `D` dial · `S` skip · `P` stop session · `T` toggle transcript · `1`–`7` log result.

## Connecting your existing number (pick one)

| Setup | What to do |
|---|---|
| **Mac + iPhone** | iPhone: Settings → Phone → Calls on Other Devices → turn on your Mac. Mac: FaceTime → Settings → turn on "Calls from iPhone". Same Apple ID and Wi-Fi. |
| **Windows + Android/iPhone** | Install **Phone Link**, pair your phone, enable Calls. Make Phone Link the default app for `tel:` links (Settings → Apps → Default apps → search "TEL"). |
| **Google Voice (free US number)** | Open voice.google.com in Chrome. Then Chrome Settings → Privacy and security → Site settings → Additional permissions → Protocol handlers → allow Google Voice to open `tel:` links. Using a separate Voice number also keeps your personal number from getting flagged as spam. |
| **Phone only** | Open the site on your phone. Each dial opens the dialer with the number filled in. (No live transcript here: the call takes over the phone's mic.) |

Your device may ask you to confirm each call (Phone Link usually does). That's one extra click per call.

## Transcript: what to expect

- Uses the browser's built-in speech recognition, so it **needs Chrome or Edge**. Safari and Firefox don't support it well.
- It only hears your computer's microphone. **Put the call on speaker** to capture both sides. With headphones you'll only get your own voice.
- Allow microphone access when the browser asks.

## Run it

- **Locally:** open `index.html` in Chrome. For the microphone to work reliably, serve it instead: `python3 -m http.server` and go to http://localhost:8000.
- **Online for free:** push to GitHub → repo Settings → Pages → deploy from your branch's root folder. You get an `https://` link that works on any device.

## Your data

Everything is stored in your browser (`localStorage`). Nothing is sent anywhere except the speech audio, which Chrome sends to Google's speech service to transcribe. Clearing browser data erases your list, so **export your CSV after each session**.

## Compliance basics (not legal advice)

- **Do Not Call:** check consumer numbers against the National Do Not Call Registry (donotcall.gov). The app dials only when you start it, one call at a time.
- **Recording/transcription consent:** some US states (e.g. CA, FL, IL, MD, MA, MT, NH, PA, WA) require everyone on the call to agree. The default script opens with "this call may be transcribed." Keep that line, or only transcribe your own side.
- **Calling hours:** stick to 8am–9pm in the recipient's time zone.

## Possible upgrades (paid)

- Have the site place calls and record both sides itself through Twilio (about 1–2¢/min plus about $1.15/month for a number). Requires a small backend.
- AI call summaries and next steps generated from the transcript.
