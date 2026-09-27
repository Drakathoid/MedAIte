# medAIte

A responsive prompt-refinement webpage that bridges the gap between a rough request and a useful brief for an AI.

## What works

- Paste a request or try a writing, coding, image-editing or research example.
- Add audience, outcome, constraints, output format and tone.
- Get a structured prompt that preserves your original requirements.
- Answer task-specific questions about missing details.
- Review potential conflicts and explicitly resolve which requirement takes priority.
- Select optional wording cuts; nothing is removed automatically.
- Edit the resulting prompt, inspect what changed and copy the exact current draft.
- Choose whether unresolved questions appear in the prompt.
- Use keyboard navigation, Ctrl/Cmd+Enter and phone-sized layouts.

## How refinement works

This version is a **local, deterministic guided editor**, not an AI model. It classifies common task types using rules, organises supplied information, detects selected contradictions and proposes questions. It does not make semantic paraphrases, verify factual claims, inspect referenced files or guarantee better responses from any AI. English detection is supported; other languages are preserved but may receive generic guidance. A task-type label is a suggestion, not a semantic guarantee.

The engine preserves the original request and does not invent missing details. Cuts are opt-in. Code and quoted text are excluded from automatic cut suggestions. User text is rendered as text, never inserted as HTML. Prompts are not transmitted to an AI service or stored by the page; closing/reloading the tab clears them. The hosting platform still serves ordinary webpage requests.

## Run locally

No install or API key is needed. From this directory:

```sh
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`. Serve over HTTP rather than opening `index.html` as a local file, because the JavaScript uses modules.

## Verify

Node.js 20 or newer:

```sh
npm run check
npm test
```

Tests cover constraint preservation, quoted/code content, opt-in removals, answered questions, conflicting limits, mixed topic classification, multilingual preservation and input boundaries. There are no npm dependencies.

## Publish with GitHub Pages

The portable webpage is in `dist/`. In this repository's **Settings → Pages**, choose **GitHub Actions** as the build and deployment source. The included workflow checks the JavaScript and runs the tests after each push to `main`. Once Pages is enabled, run **Actions → Check and publish medAIte → Run workflow** to publish `dist/`. To also publish on every push, set the repository Actions variable `PAGES_ENABLED` to `true`. GitHub Pages must be enabled before manual or automatic publication can succeed.

The separately hosted preview is private by default. Repository visibility and preview visibility are independent.

## Files

- `dist/index.html` — accessible single-page interface
- `dist/styles.css` — desktop/mobile layouts and theme
- `dist/engine.js` — pure local analysis and prompt construction
- `dist/app.js` — UI state, explicit revisions, copying and optional WebMCP integration
- `tests/engine.test.mjs` — meaningful engine regression checks

The optional WebMCP `refine_prompt` action uses the same visible state and refuses to overwrite a manually edited draft. Unsupported browsers retain the normal interface. Live WebMCP registration requires a browser that implements `document.modelContext`; it is not required for normal use.

## Future model-backed refinement

Semantic rewriting would require a server-side model integration. Keep credentials on a server, disclose when prompts leave the browser, return structured questions/changes, and preserve the explicit acceptance step for removing constraints. Never put an API secret in this static frontend.
