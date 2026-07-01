import { readFile, writeFile } from "node:fs/promises";

import { getApiProvider, getModel, type Api, type Model } from "@earendil-works/pi-ai/compat";
import { Type, type Static } from "typebox";
import { Check, Errors } from "typebox/value";
import { parse, stringify } from "yaml";

export type LegacyProviderSettings = {
  provider: string;
  model: string;
  baseUrl: string;
  enabled: boolean;
};

const strictObject = <T extends Parameters<typeof Type.Object>[0]>(properties: T) =>
  Type.Object(properties, { additionalProperties: false });

const headersSchema = Type.Record(Type.String({ minLength: 1 }), Type.String());
const compatibilitySchema = Type.Partial(strictObject({
  supportsStore: Type.Boolean(),
  supportsDeveloperRole: Type.Boolean(),
  supportsReasoningEffort: Type.Boolean(),
  supportsUsageInStreaming: Type.Boolean(),
  maxTokensField: Type.Union([
    Type.Literal("max_completion_tokens"),
    Type.Literal("max_tokens"),
  ]),
  requiresToolResultName: Type.Boolean(),
  requiresAssistantAfterToolResult: Type.Boolean(),
  requiresThinkingAsText: Type.Boolean(),
  requiresReasoningContentOnAssistantMessages: Type.Boolean(),
  thinkingFormat: Type.Union([
    Type.Literal("openai"),
    Type.Literal("openrouter"),
    Type.Literal("deepseek"),
    Type.Literal("together"),
    Type.Literal("zai"),
    Type.Literal("qwen"),
    Type.Literal("chat-template"),
    Type.Literal("qwen-chat-template"),
    Type.Literal("string-thinking"),
    Type.Literal("ant-ling"),
  ]),
  chatTemplateKwargs: Type.Record(Type.String(), Type.Unknown()),
  openRouterRouting: Type.Record(Type.String(), Type.Unknown()),
  vercelGatewayRouting: Type.Record(Type.String(), Type.Unknown()),
  zaiToolStream: Type.Boolean(),
  supportsStrictMode: Type.Boolean(),
  cacheControlFormat: Type.Literal("anthropic"),
  sendSessionAffinityHeaders: Type.Boolean(),
  sendSessionIdHeader: Type.Boolean(),
  supportsLongCacheRetention: Type.Boolean(),
  supportsEagerToolInputStreaming: Type.Boolean(),
  supportsCacheControlOnTools: Type.Boolean(),
  supportsTemperature: Type.Boolean(),
  forceAdaptiveThinking: Type.Boolean(),
  allowEmptySignature: Type.Boolean(),
}));

const apiSchema = Type.Union([
  Type.Literal("openai-completions"),
  Type.Literal("mistral-conversations"),
  Type.Literal("openai-responses"),
  Type.Literal("azure-openai-responses"),
  Type.Literal("openai-codex-responses"),
  Type.Literal("anthropic-messages"),
  Type.Literal("bedrock-converse-stream"),
  Type.Literal("google-generative-ai"),
  Type.Literal("google-vertex"),
]);

const thinkingLevelMapSchema = Type.Partial(strictObject({
  off: Type.Union([Type.String(), Type.Null()]),
  minimal: Type.Union([Type.String(), Type.Null()]),
  low: Type.Union([Type.String(), Type.Null()]),
  medium: Type.Union([Type.String(), Type.Null()]),
  high: Type.Union([Type.String(), Type.Null()]),
  xhigh: Type.Union([Type.String(), Type.Null()]),
}));

export const agentModelConfigSchema = strictObject({
  version: Type.Literal(1),
  enabled: Type.Boolean(),
  provider: strictObject({
    id: Type.String({ minLength: 1 }),
    api: Type.Optional(apiSchema),
    baseUrl: Type.Optional(Type.String({ minLength: 1 })),
    apiKeyEnv: Type.Optional(Type.String({ pattern: "^[A-Za-z_][A-Za-z0-9_]*$" })),
    headers: Type.Optional(headersSchema),
    compat: Type.Optional(compatibilitySchema),
  }),
  model: strictObject({
    id: Type.String({ minLength: 1 }),
    name: Type.Optional(Type.String({ minLength: 1 })),
    api: Type.Optional(apiSchema),
    baseUrl: Type.Optional(Type.String({ minLength: 1 })),
    reasoning: Type.Optional(Type.Boolean()),
    thinkingLevelMap: Type.Optional(thinkingLevelMapSchema),
    input: Type.Optional(Type.Array(
      Type.Union([Type.Literal("text"), Type.Literal("image")]),
      { minItems: 1, uniqueItems: true },
    )),
    contextWindow: Type.Optional(Type.Integer({ minimum: 1 })),
    maxTokens: Type.Optional(Type.Integer({ minimum: 1 })),
    cost: Type.Optional(strictObject({
      input: Type.Number({ minimum: 0 }),
      output: Type.Number({ minimum: 0 }),
      cacheRead: Type.Number({ minimum: 0 }),
      cacheWrite: Type.Number({ minimum: 0 }),
    })),
    headers: Type.Optional(headersSchema),
    compat: Type.Optional(compatibilitySchema),
  }),
});

export type AgentModelConfig = Static<typeof agentModelConfigSchema>;

export type AgentConfigLoadResult = {
  config?: AgentModelConfig;
  error?: string;
  created: boolean;
};

const lookupModel = getModel as unknown as (
  provider: string,
  model: string,
) => Model<Api> | undefined;

function formatValidationErrors(value: unknown) {
  return [...Errors(agentModelConfigSchema, value)]
    .slice(0, 8)
    .map((error) => `${error.instancePath || "/"}: ${error.message}`)
    .join("; ");
}

export function parseAgentConfig(source: string): AgentModelConfig {
  const value = parse(source) as unknown;
  if (!Check(agentModelConfigSchema, value)) {
    throw new Error(`Invalid agent.yaml: ${formatValidationErrors(value)}`);
  }
  return value;
}

function migratedConfig(legacy: LegacyProviderSettings): AgentModelConfig {
  const known = lookupModel(legacy.provider, legacy.model);
  return {
    version: 1,
    enabled: legacy.enabled,
    provider: {
      id: legacy.provider,
      ...(legacy.baseUrl ? { baseUrl: legacy.baseUrl } : {}),
      ...(!known && legacy.baseUrl
        ? {
            api: legacy.provider === "anthropic"
              ? "anthropic-messages" as const
              : "openai-completions" as const,
          }
        : {}),
    },
    model: { id: legacy.model },
  };
}

export async function loadAgentConfig(
  path: string,
  legacy: LegacyProviderSettings,
): Promise<AgentConfigLoadResult> {
  try {
    return {
      config: parseAgentConfig(await readFile(path, "utf8")),
      created: false,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      return {
        error: error instanceof Error ? error.message : String(error),
        created: false,
      };
    }
  }

  const config = migratedConfig(legacy);
  await writeFile(
    path,
    `# ScribeAI model configuration. Restart the app after editing.\n${stringify(config)}`,
    { encoding: "utf8", flag: "wx" },
  );
  return { config, created: true };
}

function resolveHeaderValue(value: string) {
  const match = /^\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))$/.exec(value);
  if (!match) return value.replace(/^\$\$/, "$");
  const name = match[1] ?? match[2];
  const resolved = process.env[name];
  if (resolved === undefined) {
    throw new Error(`Environment variable ${name} is required by agent.yaml`);
  }
  return resolved;
}

function resolveHeaders(headers?: Record<string, string>) {
  if (!headers) return undefined;
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name, resolveHeaderValue(value)]),
  );
}

export function resolveAgentModel(config: AgentModelConfig): Model<Api> {
  const known = lookupModel(config.provider.id, config.model.id);
  const api = config.model.api ?? config.provider.api ?? known?.api;
  const baseUrl = config.model.baseUrl ?? config.provider.baseUrl ?? known?.baseUrl;

  if (!api || !baseUrl) {
    throw new Error(
      `Unknown model ${config.provider.id}/${config.model.id}; provider.api and provider.baseUrl are required`,
    );
  }
  if (!getApiProvider(api)) {
    throw new Error(`Unsupported model API: ${api}`);
  }

  const headers = {
    ...(known?.headers ?? {}),
    ...(resolveHeaders(config.provider.headers) ?? {}),
    ...(resolveHeaders(config.model.headers) ?? {}),
  };
  const compat = {
    ...(known?.compat ?? {}),
    ...(config.provider.compat ?? {}),
    ...(config.model.compat ?? {}),
  };

  return {
    id: config.model.id,
    name: config.model.name ?? known?.name ?? config.model.id,
    provider: config.provider.id,
    api,
    baseUrl,
    reasoning: config.model.reasoning ?? known?.reasoning ?? false,
    input: config.model.input ?? known?.input ?? ["text"],
    cost: config.model.cost ?? known?.cost ?? {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: config.model.contextWindow ?? known?.contextWindow ?? 128_000,
    maxTokens: config.model.maxTokens ?? known?.maxTokens ?? 16_384,
    ...(config.model.thinkingLevelMap ?? known?.thinkingLevelMap
      ? { thinkingLevelMap: { ...known?.thinkingLevelMap, ...config.model.thinkingLevelMap } }
      : {}),
    ...(Object.keys(headers).length ? { headers } : {}),
    ...(Object.keys(compat).length ? { compat: compat as never } : {}),
  };
}

export function resolveConfiguredApiKey(config: AgentModelConfig) {
  const name = config.provider.apiKeyEnv;
  if (!name) return undefined;
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required by agent.yaml`);
  }
  return value;
}
