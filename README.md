# The Path

A quiet, self-contained web instrument for Theravāda Buddhist practice — a place to
log sits, track the Eightfold Path in daily life, read and reflect on suttas, and
map one's progress against the traditional framework of the seven purifications and
sixteen insight knowledges.

It is deliberately simple: a static website that runs entirely in your browser,
stores everything on your own device, and asks for no account. If you want your
practice to follow you across devices, you can optionally connect a free, private
GitHub Gist as storage.

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
- **Sutta Search** — search SuttaCentral directly, read suttas in-app (via a small
  fetch helper), log what you've read, and attach personal reflections. Pāli terms
  link to the glossary.
- **Pāli Glossary** — a large, cross-referenced glossary of terms.
- **Full Log** — everything you've recorded, searchable and sortable.

## Setup

1. **Use it as-is:** visit the deployed site. On first load you'll be asked a few
   questions (optional starting streak, suttas read, and whether to enable sync),
   then you're in. Everything stays on your device.

2. **Self-host:** this is a static site. Fork this repository and enable GitHub
   Pages (Settings → Pages → deploy from the `main` branch). That's all that's
   required for everything except in-app sutta reading.

### In-app sutta reading (optional)

Reading sutta text inside the site requires a tiny
[Cloudflare Worker](https://workers.cloudflare.com/) that fetches text from
SuttaCentral (this avoids browser cross-origin limits). It uses no API keys and is
free.

1. Create a free Cloudflare account and a new Worker.
2. Paste the contents of `worker.js` into it and deploy.
3. Copy your Worker's URL and replace the placeholder `WORKER` value near the top of
   the script in `suttas.html`.

Without this, SuttaCentral Direct search and manual read-logging still work — you'll
just read suttas on suttacentral.net rather than in-app.

### Sync across devices (optional)

Sync uses a free, private GitHub Gist. The in-app **Setup & Settings** page has a
step-by-step guide, but briefly: create a secret gist containing a file named
`the_path_data.json`, generate a fine-grained access token with read/write access to
gists, and enter both in setup or settings. Your data lives only in your own gist and
on your own devices. Sync is "last write wins" — pull before editing on a device,
push when you finish, and avoid editing two devices at once.

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
