export * from './database';

export type ThemeTokens = {
  colors: {
    primary: string;
    primaryDeep: string;
    accent: string;
    secondary: string;
    ink: string;
    paper: string;
    surface: string;
    success: string;
    danger: string;
  };
  radius: { sm: string; md: string; lg: string };
  font: { sans: string; display: string };
};

export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'sent' | 'failed';

export type H2RPayload = {
  messages: Array<{
    id: string;
    timestamp: number;
    snippet: { displayMessage: string };
    authorDetails: { displayName: string; profileImageUrl: string };
    platform: { name: string; logoUrl: string };
  }>;
};
