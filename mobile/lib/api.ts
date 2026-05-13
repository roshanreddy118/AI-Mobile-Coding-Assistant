// API client for the Mobile Coding Assistant backend

const API_BASE = "https://ai-mobile-coding-assistant.onrender.com";

export interface SessionResponse {
  session_id: string;
  status: string;
}

export interface CommandResponse {
  intent: string;
  description: string;
  results: ActionResult[];
  preview_url: string | null;
}

export interface VoiceResponse extends CommandResponse {
  transcript: string;
}

export interface ActionResult {
  type: string;
  path?: string;
  content?: string;
  command?: string;
  exit_code?: number;
  stdout?: string;
  stderr?: string;
  status?: string;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number | null;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const resp = await fetch(`${this.baseUrl}${path}`, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      ...options,
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`API error ${resp.status}: ${err}`);
    }
    return resp.json();
  }

  // Sessions
  async createSession(name?: string): Promise<SessionResponse> {
    return this.request("/session", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  async listFiles(sessionId: string, path = "."): Promise<{ files: FileEntry[] }> {
    return this.request(`/session/${sessionId}/files?path=${encodeURIComponent(path)}`);
  }

  // AI Commands
  async sendCommand(
    sessionId: string,
    message: string,
    provider?: string,
    context?: Array<{ role: string; content: string }>
  ): Promise<CommandResponse> {
    return this.request("/command", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, message, provider, context }),
    });
  }

  // Voice
  async sendVoice(
    sessionId: string,
    audioUri: string,
    provider?: string
  ): Promise<VoiceResponse> {
    const formData = new FormData();
    formData.append("audio", {
      uri: audioUri,
      type: "audio/wav",
      name: "recording.wav",
    } as any);
    formData.append("session_id", sessionId);
    if (provider) formData.append("provider", provider);

    const resp = await fetch(`${this.baseUrl}/voice`, {
      method: "POST",
      body: formData,
    });
    if (!resp.ok) throw new Error(`Voice API error: ${resp.status}`);
    return resp.json();
  }

  // Chat
  async chat(
    message: string,
    provider?: string,
    context?: Array<{ role: string; content: string }>
  ): Promise<{ response: string }> {
    return this.request("/chat", {
      method: "POST",
      body: JSON.stringify({ message, provider, context }),
    });
  }

  // Execute shell
  async execute(sessionId: string, command: string): Promise<ActionResult> {
    return this.request("/execute", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, command }),
    });
  }

  // Providers
  async getProviders(): Promise<any> {
    return this.request("/providers");
  }

  // Get full preview URL
  getPreviewUrl(previewPath: string): string {
    return `${this.baseUrl}${previewPath}`;
  }

  // WebSocket terminal
  connectTerminal(sessionId: string): WebSocket {
    const wsUrl = this.baseUrl.replace(/^http/, "ws");
    return new WebSocket(`${wsUrl}/ws/terminal/${sessionId}`);
  }
}

export const api = new ApiClient();
