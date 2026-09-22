import 'dotenv/config';

export const env = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/prep-kit',
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  llm: {
    apiKey: process.env.LLM_API_KEY || '',
    baseUrl: process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1',
    model: process.env.LLM_MODEL || 'llama-3.1-8b-instant',
  },
  search: {
    apiKey: process.env.SEARCH_API_KEY || '',
    baseUrl: process.env.SEARCH_BASE_URL || '',
  },
};
