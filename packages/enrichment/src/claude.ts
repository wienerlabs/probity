// Minimal Anthropic Messages API client. fetch-only, no SDK — keeps
// the dependency surface zero and avoids dragging in @anthropic-ai/sdk
// (and its peer deps) into the Next.js build.

export interface ClaudeClientOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  endpoint?: string;
}

export interface MessagesRequest {
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
  temperature?: number;
}

export interface MessagesResponse {
  id: string;
  model: string;
  role: "assistant";
  content: Array<{ type: string; text?: string }>;
  stop_reason: string | null;
  usage?: { input_tokens: number; output_tokens: number };
}

export class ClaudeError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ClaudeError";
  }
}

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
const DEFAULT_ENDPOINT = "https://api.anthropic.com/v1/messages";

export class ClaudeClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;

  constructor(opts: ClaudeClientOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? DEFAULT_MODEL;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
  }

  async messages(req: MessagesRequest): Promise<MessagesResponse> {
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: req.maxTokens ?? 4096,
      messages: req.messages,
    };
    if (req.system) body.system = req.system;
    if (req.temperature !== undefined) body.temperature = req.temperature;

    const res = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ClaudeError(res.status, `Anthropic HTTP ${res.status}: ${text}`);
    }
    return (await res.json()) as MessagesResponse;
  }

  /** Convenience: returns the concatenated text-block content. */
  async ask(req: MessagesRequest): Promise<string> {
    const r = await this.messages(req);
    return r.content
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("");
  }
}
