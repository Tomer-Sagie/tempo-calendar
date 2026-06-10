declare namespace google.accounts.oauth2 {
  interface TokenClientConfig {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string; message: string }) => void;
    prompt_parent_id?: string;
    include_granted_scopes?: boolean;
    enable_serial_consent?: boolean;
    hint?: string;
    state?: string;
  }

  interface TokenResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
    error?: string;
    error_subtype?: string;
    error_description?: string;
  }

  interface TokenClient {
    requestAccessToken(overrideConfig?: {
      prompt?: string;
      login_hint?: string;
      state?: string;
      callback?: (response: TokenResponse) => void;
    }): void;
  }

  function initTokenClient(config: TokenClientConfig): TokenClient;
}

interface Window {
  google?: typeof google;
}