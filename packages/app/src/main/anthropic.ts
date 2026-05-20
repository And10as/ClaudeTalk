import Anthropic from '@anthropic-ai/sdk';

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export class AnthropicChat {
  #history: Turn[] = [];
  readonly model: string;

  constructor(model = 'claude-sonnet-4-6') {
    this.model = model;
  }

  reset(): void {
    this.#history = [];
  }

  history(): readonly Turn[] {
    return this.#history;
  }

  async *streamReply(userText: string, signal: AbortSignal): AsyncIterable<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey === undefined || apiKey.length === 0) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }

    this.#history.push({ role: 'user', content: userText });
    const client = new Anthropic({ apiKey });

    const stream = client.messages.stream(
      {
        model: this.model,
        max_tokens: 1024,
        system:
          'You are Claude, having a real-time voice conversation. Keep replies short and natural — like spoken dialogue. Avoid bullet lists and headings unless explicitly asked.',
        messages: this.#history.map((t) => ({ role: t.role, content: t.content })),
      },
      { signal },
    );

    let buffered = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        buffered += event.delta.text;
        yield event.delta.text;
      }
    }

    this.#history.push({ role: 'assistant', content: buffered });
  }

  truncateLastAssistantTo(spokenChars: number): void {
    const last = this.#history[this.#history.length - 1];
    if (last === undefined || last.role !== 'assistant') return;
    last.content = last.content.slice(0, spokenChars);
  }
}
