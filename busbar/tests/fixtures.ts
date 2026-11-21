import { writeFile } from 'node:fs/promises';
import { test as base, type ConsoleMessage, type Request } from '@playwright/test';

export { expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const messages: string[] = [];
    const record = (message: string) => {
      if (messages.length < 500) messages.push(message);
    };
    const onConsole = (message: ConsoleMessage) =>
      record(`[console:${message.type()}] ${message.text()}`);
    const onError = (error: Error) => record(`[pageerror] ${error.message}`);
    const onRequestFailed = (request: Request) =>
      record(`[requestfailed] ${request.method()} ${request.url()} ${request.failure()?.errorText}`);
    page.on('console', onConsole);
    page.on('pageerror', onError);
    page.on('requestfailed', onRequestFailed);
    try {
      await use(page);
    } finally {
      page.off('console', onConsole);
      page.off('pageerror', onError);
      page.off('requestfailed', onRequestFailed);
      if (testInfo.status !== testInfo.expectedStatus) {
        const logPath = testInfo.outputPath('browser.log');
        await writeFile(logPath, messages.join('\n') ||
          'No browser console errors or failed requests were captured.');
        await testInfo.attach('browser.log', {
          path: logPath,
          contentType: 'text/plain',
        });
      }
    }
  },
});
