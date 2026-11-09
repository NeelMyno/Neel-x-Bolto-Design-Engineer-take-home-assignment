# Sending an offer to a new hire

A design take-home for Bolto. It's a static site: plain HTML, CSS and JavaScript, no build step and no dependencies. Everything uses dummy data.

- `hifi/index.html`: the start page
- `hifi/v3/`: the agent version, made after the submission
- `hifi/v2/`: the prototype
- `hifi/v1/`: the earlier, plainer version
- `hifi/promo/`: the optional promo, a landing page section (v3, v2 and v1)
- `hifi/shared/`: shared styles, tokens, scripts, Bolto logos (from Bolto's brand kit) and Lucide icons (ISC licence)

Run it locally from the repo root with any static server, for example `python3 -m http.server 8000`, then open http://localhost:8000/hifi/.

On Vercel, import the repo with the framework preset "Other" and no build command. `vercel.json` sends `/` to `/hifi/`.

Each prototype has a Demo states button at the bottom left to jump between states.
