// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  loadAgentConfig,
  parseAgentConfig,
  resolveAgentModel,
  resolveConfiguredApiKey,
} from "./agent-config";

const directories: string[] = [];

afterEach(async () => {
  delete process.env.SCRIBE_TEST_KEY;
  delete process.env.SCRIBE_TEST_HEADER;
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("agent YAML configuration", () => {
  it("resolves a minimal built-in model from the Pi catalog", () => {
    const config = parseAgentConfig(`
version: 1
enabled: true
provider:
  id: anthropic
model:
  id: claude-sonnet-4-6
`);

    const model = resolveAgentModel(config);

    expect(model.provider).toBe("anthropic");
    expect(model.id).toBe("claude-sonnet-4-6");
    expect(model.api).toBe("anthropic-messages");
    expect(model.contextWindow).toBeGreaterThan(0);
  });

  it("builds a custom model and resolves environment-backed credentials and headers", () => {
    process.env.SCRIBE_TEST_KEY = "test-api-key";
    process.env.SCRIBE_TEST_HEADER = "test-header";
    const config = parseAgentConfig(`
version: 1
enabled: true
provider:
  id: local
  api: openai-completions
  baseUrl: http://localhost:11434/v1
  apiKeyEnv: SCRIBE_TEST_KEY
  headers:
    x-test-header: $SCRIBE_TEST_HEADER
model:
  id: qwen-test
  contextWindow: 32768
  maxTokens: 4096
`);
    const model = resolveAgentModel(config);

    expect(model).toMatchObject({
      provider: "local",
      id: "qwen-test",
      api: "openai-completions",
      baseUrl: "http://localhost:11434/v1",
      reasoning: false,
      input: ["text"],
      contextWindow: 32768,
      maxTokens: 4096,
      headers: { "x-test-header": "test-header" },
    });
    expect(resolveConfiguredApiKey(config)).toBe("test-api-key");
  });

  it("rejects unsupported and misspelled fields", () => {
    expect(() => parseAgentConfig(`
version: 1
enabled: true
provider:
  id: local
  protcol: openai-completions
model:
  id: test
`)).toThrow(/protcol|additional properties/i);
  });

  it("creates agent.yaml from the legacy provider row once", async () => {
    const directory = await mkdtemp(join(tmpdir(), "scribe-agent-config-"));
    directories.push(directory);
    const path = join(directory, "agent.yaml");

    const loaded = await loadAgentConfig(path, {
      provider: "local",
      model: "llama-test",
      baseUrl: "http://localhost:11434/v1",
      enabled: true,
    });

    expect(loaded.created).toBe(true);
    expect(loaded.config).toMatchObject({
      enabled: true,
      provider: {
        id: "local",
        api: "openai-completions",
        baseUrl: "http://localhost:11434/v1",
      },
      model: { id: "llama-test" },
    });
    expect(await readFile(path, "utf8")).toContain("Restart the app after editing");
  });

  it("preserves an invalid existing file for external repair", async () => {
    const directory = await mkdtemp(join(tmpdir(), "scribe-agent-config-"));
    directories.push(directory);
    const path = join(directory, "agent.yaml");
    await writeFile(path, "version: [invalid");

    const loaded = await loadAgentConfig(path, {
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      baseUrl: "",
      enabled: false,
    });

    expect(loaded.config).toBeUndefined();
    expect(loaded.error).toBeTruthy();
    expect(await readFile(path, "utf8")).toBe("version: [invalid");
  });
});
