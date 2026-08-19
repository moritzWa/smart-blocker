/**
 * CDP over --remote-debugging-pipe.
 *
 * Chrome 137+ ignores --load-extension; the supported automation path is the
 * Extensions.loadUnpacked command, which is only exposed on the pipe transport
 * together with --enable-unsafe-extension-debugging.
 */
import { spawn } from 'node:child_process';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export class PipeBrowser {
  constructor(proc) {
    this.proc = proc;
    this.write = proc.stdio[3];
    this.read = proc.stdio[4];
    this.id = 0;
    this.pending = new Map();
    this.sessionListeners = new Set();
    this.buffer = Buffer.alloc(0);

    this.read.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      let index;
      while ((index = this.buffer.indexOf(0)) !== -1) {
        const raw = this.buffer.subarray(0, index).toString();
        this.buffer = this.buffer.subarray(index + 1);
        let msg;
        try {
          msg = JSON.parse(raw);
        } catch {
          continue;
        }
        const entry = this.pending.get(msg.id);
        if (entry) {
          this.pending.delete(msg.id);
          entry(msg);
        }
        for (const listener of this.sessionListeners) listener(msg);
      }
    });
  }

  static launch({ profile, headless = true, extraArgs = [] } = {}) {
    const args = [
      `--user-data-dir=${profile}`,
      '--remote-debugging-pipe',
      '--enable-unsafe-extension-debugging',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      ...(headless ? ['--headless=new'] : []),
      ...extraArgs,
      'about:blank',
    ];
    const proc = spawn(CHROME, args, {
      stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'],
    });
    return new PipeBrowser(proc);
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, (msg) =>
        msg.error ? reject(new Error(`${method}: ${JSON.stringify(msg.error)}`)) : resolve(msg.result)
      );
      this.write.write(JSON.stringify(payload) + '\0');
    });
  }

  async targets() {
    const { targetInfos } = await this.send('Target.getTargets');
    return targetInfos;
  }

  async attach(targetId) {
    const { sessionId } = await this.send('Target.attachToTarget', {
      targetId,
      flatten: true,
    });
    return sessionId;
  }

  /** Evaluate an async body in a target and return its value. */
  async evaluate(sessionId, body) {
    const result = await this.send(
      'Runtime.evaluate',
      {
        expression: `(async () => { ${body} })()`,
        awaitPromise: true,
        returnByValue: true,
      },
      sessionId
    );
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ||
          JSON.stringify(result.exceptionDetails)
      );
    }
    return result.result.value;
  }

  async waitForTarget(predicate, timeoutMs = 30000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const found = (await this.targets()).find(predicate);
      if (found) return found;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error('target never appeared');
  }

  async close() {
    try {
      await this.send('Browser.close');
    } catch {
      this.proc.kill('SIGKILL');
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}
