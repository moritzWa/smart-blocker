import type { TodoReminder } from './types';

export function createSeedTodos(): TodoReminder[] {
  return [
    {
      id: `seed-${Date.now()}-1`,
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      hostname: 'youtube.com',
      note: 'Check out that video Sarah recommended',
      timestamp: Date.now() - 2700000, // 45 minutes ago
    },
    {
      id: `seed-${Date.now()}-2`,
      url: 'https://x.com/naval/status/1234567890',
      hostname: 'x.com',
      note: 'Read Twitter thread about productivity',
      timestamp: Date.now() - 5400000, // 90 minutes ago
    },
    {
      id: `seed-${Date.now()}-2`,
      url: 'https://exa.ai/search?q=great+article+on+how+to+cook+a+good+soup+with+a+nice+bla+bal+bla+bal+bla+bal+bla+bal+bla+bal+bla+bal+bla+bal+bla+bal+bla+bal+etc%3A',
      hostname: 'x.com',
      note: 'Soup',
      timestamp: Date.now() - 5400000, // 90 minutes ago
    },
    {
      id: `seed-${Date.now()}-3`,
      url: 'https://www.linkedin.com/feed/',
      hostname: 'linkedin.com',
      note: "Reply to Mike's message",
      timestamp: Date.now() - 1800000, // 30 minutes ago
    },
    {
      id: `seed-${Date.now()}-4`,
      url: 'https://www.reddit.com/r/webdev/comments/example',
      hostname: 'reddit.com',
      note: 'Check that Next.js discussion',
      timestamp: Date.now() - 7200000, // 2 hours ago
    },
  ];
}
