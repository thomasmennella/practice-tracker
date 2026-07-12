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

## Content & attribution

Sutta text is drawn from [SuttaCentral](https://suttacentral.net), whose translations
(notably Bhikkhu Sujato's) are released under CC0. Deep gratitude to SuttaCentral and
its translators for making the canon freely available.

## License

Released under the MIT License — see [LICENSE](LICENSE). Use it, fork it, adapt it,
share it. May it be of benefit.
