/** @jest-environment jsdom */
/* eslint-env jest, node */

const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../assets/js/repository-activity.js"), "utf8");

function jsonResponse(body) {
  return {
    ok: true,
    headers: {
      get: () => null,
    },
    json: async () => body,
  };
}

async function waitFor(assertion, timeoutMs = 1500) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  throw lastError;
}

describe("repository activity feed", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <aside data-boot-section="activity">
        <div id="fallback-entry">Static fallback</div>
      </aside>
    `;
    localStorage.clear();
    Object.defineProperty(document, "readyState", {
      configurable: true,
      value: "complete",
    });

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ default_branch: "main" }))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            sha: "abcdef1234567890",
            html_url: "https://github.com/MoDuLah/modulah.github.io/commit/abcdef1234567890",
            commit: {
              message: "Release live activity feed\n\nDetailed body",
              committer: { date: "2026-08-07T18:00:00Z" },
              author: { date: "2026-08-07T18:00:00Z" },
            },
          },
          {
            sha: "1234567abcdef890",
            html_url: "https://github.com/MoDuLah/modulah.github.io/commit/1234567abcdef890",
            commit: {
              message: "Initial repository commit",
              committer: { date: "2025-01-01T09:30:00Z" },
              author: { date: "2025-01-01T09:30:00Z" },
            },
          },
        ])
      );
  });

  afterEach(() => {
    delete global.fetch;
  });

  test("replaces the fallback with the complete GitHub commit response", async () => {
    window.eval(source);

    await waitFor(() => {
      expect(document.getElementById("activity-commit-count").textContent).toBe("2 COMMITS");
    });

    const activityFeed = document.querySelector('[data-boot-section="activity"]');
    expect(activityFeed.getAttribute("aria-busy")).toBe("false");
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(document.getElementById("fallback-entry")).toBeNull();
    expect(document.body.textContent).toContain("Release live activity feed");
    expect(document.body.textContent).toContain("Initial repository commit");
    expect(document.body.textContent).toContain("ORIGIN");
    expect(document.body.textContent).toContain("LIVE GIT");

    const fullLog = [...document.querySelectorAll("a")].find(
      (link) => link.textContent === "Full Git Log"
    );
    expect(fullLog.href).toBe("https://github.com/MoDuLah/modulah.github.io/commits/main");
  });
});
