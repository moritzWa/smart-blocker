# Real-Chrome checks

`selfheal.mjs` drives an actual Chrome instance to verify the reminder storage
migration against a real `chrome.storage.sync`, with Chrome's own quota
enforcement rather than a stub.

```bash
npm run build
node e2e/selfheal.mjs
```

It seeds the old single-key `todoReminders` layout, stops the service worker
(which MV3 does constantly on its own), saves a reminder to wake a fresh worker,
and asserts the legacy array was migrated with nothing lost. Prints
`RESULT: PASS` or `RESULT: FAIL`.

`pipe.mjs` is the CDP transport it uses. It talks over `--remote-debugging-pipe`
rather than a port because Chrome 137+ ignores `--load-extension`; the supported
automation path is the `Extensions.loadUnpacked` command, which is only exposed
on the pipe transport together with `--enable-unsafe-extension-debugging`.

## Gotcha when testing an upgrade by hand

Chrome keeps the previously registered service worker script for an unpacked
extension loaded from the same path. Swapping the build on disk gives you a NEW
options page running against an OLD service worker, which looks exactly like a
migration bug: the page migrates storage, then the old worker writes the legacy
array straight back. Bumping the manifest version does not help, and
`chrome.runtime.getManifest().version` reports the new version either way, so it
will not tell you the worker is stale.

Reload the extension from `chrome://extensions` (or use a fresh profile) before
concluding anything. A real Chrome Web Store update replaces the worker, so this
only bites local testing.
