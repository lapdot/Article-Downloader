import { afterAll, beforeAll } from "vitest";
import { Agent, MockAgent, setGlobalDispatcher } from "undici";

const CLOSED_LOOP_ENV = "ARTICLE_DOWNLOADER_CLOSED_LOOP";

let mockAgent: MockAgent | undefined;

function isClosedLoopEnabled(): boolean {
  return process.env[CLOSED_LOOP_ENV] === "1";
}

beforeAll(() => {
  if (!isClosedLoopEnabled()) {
    return;
  }

  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  mockAgent.enableNetConnect((origin) => {
    const value = String(origin);
    return (
      value.includes("127.0.0.1") ||
      value.includes("localhost") ||
      value.includes("[::1]") ||
      value.includes("::1")
    );
  });
  setGlobalDispatcher(mockAgent);
});

afterAll(async () => {
  if (!isClosedLoopEnabled() || !mockAgent) {
    return;
  }

  await mockAgent.close();
  setGlobalDispatcher(new Agent());
  mockAgent = undefined;
});
