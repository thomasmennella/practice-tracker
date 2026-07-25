# The Path

A quiet, self-contained web instrument for Theravāda Buddhist practice — a place to
log sits, track the Eightfold Path in daily life, read and reflect on suttas, and
map one's progress against the traditional framework of the seven purifications and
sixteen insight knowledges.

It is deliberately simple: a static website that runs entirely in your browser,
stores everything on your own device, and asks for no account. If you want your
practice to follow you across devices, you can optionally connect a free GitHub
Gist as storage (see the honest caveats about what "secret" Gists do and don't
protect, below).

## What it is — and isn't

This tool supports study (*pariyatti*) and practice (*paṭipatti*). It cannot provide
realization (*paṭivedha*), and it is **not a substitute for a qualified teacher or a
living community (Saṅgha)**. The Theravāda tradition is clear that the deeper stages
of the path — especially the insight knowledges and the attainments — require
guidance that no application can replace. Treat what's here as a bridge toward
finding a teacher, not a destination. Where the tool offers structure for
self-assessment, hold it lightly; the tradition is rightly skeptical of
self-certification.

## Features

- **Dashboard** — streak, recent sits, and practice statistics at a glance.
- **Sit Log** — detailed post-session logging: concentration depth, jhāna factors,
  nimitta, hindrances, insight phenomena, and more, with in-line guidance and a
  linked Pāli glossary.
- **Practice** — a daily Eightfold Path checklist: precepts, Right Effort, Right
  Intention, and mindfulness through the day.
- **The Path** — the seven purifications and sixteen insight knowledges as an
  editable map, with charts of concentration and quality over time.
- **Journal** — free-form practice journaling.
- **Dependent Origination** — an interactive study of the twelve nidānas across
  several traditional interpretive models.
- **Sutta Search** — search SuttaCentral directly, open any sutta on suttacentral.net
  to read the authoritative text, and log what you've read with personal reflections.
- **Pāli Glossary** — a large, cross-referenced glossary of terms.
- **Full Log** — everything you've recorded, searchable and sortable.

## Setup

1. **Use it as-is:** visit the deployed site. On first load you'll be asked a few
   questions (optional starting streak, suttas read, and whether to enable sync),
   then you're in. Everything stays on your device.

2. **Self-host:** this is a static site. Fork this repository and enable GitHub
   Pages (Settings → Pages → deploy from the `main` branch). That's all that's
   required — the site is fully functional as static files.

### Reading suttas

Suttas open directly on [SuttaCentral](https://suttacentral.net), where the text is
authoritative. An earlier version rendered sutta text inside the app by fetching it
from a segmented API; that was removed because reconstructing the text could mis-order
segments and thereby distort the canonical meaning — not an acceptable risk for
scripture. Search, read-tracking, and reflections all remain in-app; only the reading
of the text itself now happens on SuttaCentral.

### Sync across devices (optional)

Sync uses a free GitHub **"secret" Gist**. The in-app **Setup & Settings** page has a
step-by-step guide, but briefly: create a secret gist containing a file named
`the_path_data.json`, generate a fine-grained access token with read/write access to
gists, and enter both in setup or settings. Sync is "last write wins" — pull before
editing on a device, push when you finish, and avoid editing two devices at once.

**Please read this before enabling sync — an honest note on privacy:**

- A GitHub "secret" Gist is **unlisted, not private.** It is not access-controlled.
  Anyone who obtains the Gist's URL or ID can read its full contents, and no GitHub
  login is required to do so. Do not share your Gist URL or ID, and be careful with
  screenshots or support messages that might reveal it.
- Your data is stored in the Gist as **unencrypted plain text.** If the Gist ID is
  ever disclosed, the complete synced dataset — sits, journal, reflections, path
  notes, everything — is readable.
- The GitHub access token you enter is stored in your browser's local storage in
  plain text, where scripts running on the page can read it. Use a token scoped only
  to gists, set a short expiration, and consider a dedicated GitHub account. You can
  remove the token any time from Setup & Settings ("Disable sync" offers to forget it).
- **The private default is local-only.** If you never enable sync, nothing leaves your
  device. Treat sync as a convenience for moving data between your own devices, not as
  secure or encrypted storage.

If you fork this project and want genuinely private sync, replace the Gist mechanism
with client-side encryption before upload, or a private repository / authenticated
backend. The current design deliberately favors zero-setup simplicity over
confidentiality, and says so plainly rather than implying a protection it doesn't
provide.

## Contact

The site includes an optional **Contact Creator** page (under Resources) where users
can send a message — a question, feature request, or bug report. It uses
[Web3Forms](https://web3forms.com), a free form-relay service, to forward messages by
email; no server is required. If you fork this project, replace the `WEB3FORMS_KEY` in
`contact.html` with your own access key (or remove the page from the nav in `data.js`
if you don't want it).

Messages are sent at the user's own discretion. Submitting a message creates no
relationship, obligation, or liability, and there is no guarantee of any reply. This is
not a channel for anything sensitive, confidential, urgent, or time-critical.

## Security & limitations — an honest accounting

This is a single-user, local-first, static website with no backend. It was reviewed
and the following are known limitations. They are disclosed plainly rather than
implied away:

- **Sync is not private or encrypted.** See the sync section above. A "secret" Gist is
  unlisted, not access-controlled, and stores your data as plain text. Local-only is
  the private default.
- **The GitHub token lives in browser local storage as plain text.** Any script on the
  page's origin can read it. Scope it to gists only, use a short expiration, and remove
  it when not syncing. A static site cannot keep a token it uses in the browser secret
  from its own runtime.
- **Imported backups and pulled Gist data are trusted.** The app does not yet fully
  validate imported/synced JSON before rendering it, so a maliciously crafted backup
  file could, in principle, run script in the page. Only import backup files you
  created yourself, and only sync to a Gist you control. (Hardening this — strict schema
  validation and text-only rendering of notes — is on the list.)
- **No Content-Security-Policy** is set by the static host, so there is no second,
  browser-enforced barrier against the above. Self-hosters who can add response headers
  are encouraged to set a strict CSP.
- **The optional SuttaCentral-fetch Worker** (if you deploy one) has no rate limiting or
  strict input validation; treat it as a personal convenience endpoint, not a public
  service.
- **The contact form** publishes a Web3Forms access key (public by design). Provider-side
  spam controls apply; the key can be rotated or disabled if abused.

None of these are dangerous for the intended use — one person tracking their own
practice on their own devices — but if you fork this for wider or multi-user use, treat
them as real work items, not footnotes. Contributions that address them are welcome.

## Content & attribution

Sutta text is drawn from [SuttaCentral](https://suttacentral.net), whose translations
(notably Bhikkhu Sujato's) are released under CC0. Deep gratitude to SuttaCentral and
its translators for making the canon freely available.

## Disclaimer & liability

This software is provided "as is", without warranty of any kind, express or implied,
including but not limited to warranties of merchantability, fitness for a particular
purpose, and noninfringement. In no event shall the author be liable for any claim,
damages, or other liability arising from the use of this software.

Nothing here is medical, psychological, or spiritual advice, and nothing here
substitutes for a qualified teacher, a physician, or a mental-health professional. Any
self-assessment the tool offers is a structure for reflection, not a diagnosis or a
certification of attainment — hold it lightly. Use of the tool, and any message sent
through its contact form, is entirely at your own discretion and risk, and creates no
obligation or relationship of any kind.

## License

Released under the MIT License — see [LICENSE](LICENSE). Use it, fork it, adapt it,
share it. May it be of benefit.
