import type { H2RPayload } from '@audience/shared-types';

type Args = {
  submissionId: string;
  eventName: string;
  name: string;
  comment: string;
  timestampMs: number;
};

export function buildH2RPayload(args: Args): H2RPayload {
  return {
    messages: [
      {
        id: args.submissionId,
        timestamp: Math.floor(args.timestampMs / 1000),
        snippet: { displayMessage: args.comment },
        authorDetails: { displayName: args.name, profileImageUrl: '' },
        platform: { name: args.eventName, logoUrl: '' },
      },
    ],
  };
}
