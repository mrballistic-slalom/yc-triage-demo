import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();

vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: vi.fn().mockImplementation(() => ({ send: sendMock })),
  InvokeModelCommand: vi.fn().mockImplementation((args: unknown) => ({ input: args })),
}));

function bedrockResponse(text: string) {
  const body = { content: [{ type: 'text', text }], stop_reason: 'end_turn' };
  return { body: new TextEncoder().encode(JSON.stringify(body)) };
}

describe('bedrock client', () => {
  beforeEach(() => {
    sendMock.mockReset();
    vi.resetModules();
  });

  it('drafts a ticket from a model response', async () => {
    sendMock.mockResolvedValueOnce(
      bedrockResponse(
        JSON.stringify({
          title: 'Mobile checkout broken on Apple Pay',
          description: 'iOS users cannot complete checkout.',
          priority: 'critical',
          labels: ['mobile', 'checkout'],
          suggested_assignee: 'Alex',
          type: 'bug',
        }),
      ),
    );
    const { draftTicket } = await import('../src/lib/bedrock');
    const result = await draftTicket({
      input: 'checkout broken on apple pay',
      backlog: [],
      team: [{ name: 'Alex', role: 'Frontend' }],
      labels: ['mobile'],
    });
    expect(result.priority).toBe('critical');
    expect(result.suggested_assignee).toBe('Alex');
    expect(result.labels).toEqual(['mobile', 'checkout']);
    expect(result.type).toBe('bug');
  });

  it('falls back to medium/task on invalid fields', async () => {
    sendMock.mockResolvedValueOnce(
      bedrockResponse(
        '```json\n' +
          JSON.stringify({
            title: 'Strange thing',
            description: '...',
            priority: 'EXTREME',
            labels: 'not-an-array',
            suggested_assignee: 'Ghost',
            type: 'mystery',
          }) +
          '\n```',
      ),
    );
    const { draftTicket } = await import('../src/lib/bedrock');
    const result = await draftTicket({
      input: 'something weird',
      backlog: [],
      team: [{ name: 'Alex', role: 'Frontend' }],
      labels: [],
    });
    expect(result.priority).toBe('medium');
    expect(result.type).toBe('task');
    expect(result.labels).toEqual([]);
    expect(result.suggested_assignee).toBeNull();
  });

  it('drops invalid duplicates and unknown ids during grooming', async () => {
    sendMock.mockResolvedValueOnce(
      bedrockResponse(
        JSON.stringify({
          duplicates: [
            { keepId: 'a', deleteId: 'b', rationale: 'same bug' },
            { keepId: 'a', deleteId: 'a', rationale: 'self' },
            { keepId: 'a', deleteId: 'ghost', rationale: 'unknown' },
          ],
          priorityChanges: [
            { ticketId: 'a', newPriority: 'high', rationale: 'urgent' },
            { ticketId: 'a', newPriority: 'EXTREME', rationale: 'invalid' },
          ],
          groups: [
            { name: 'Checkout', ticketIds: ['a', 'b'] },
            { name: 'Solo', ticketIds: ['a'] },
          ],
        }),
      ),
    );
    const { groomBacklog } = await import('../src/lib/bedrock');
    const result = await groomBacklog([
      {
        ticketId: 'a',
        title: 'A',
        description: '',
        priority: 'medium',
        labels: [],
        type: 'bug',
      },
      {
        ticketId: 'b',
        title: 'B',
        description: '',
        priority: 'medium',
        labels: [],
        type: 'bug',
      },
    ]);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0]).toEqual({
      keepId: 'a',
      deleteId: 'b',
      rationale: 'same bug',
    });
    expect(result.priorityChanges).toHaveLength(1);
    expect(result.priorityChanges[0].newPriority).toBe('high');
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].name).toBe('Checkout');
  });
});
