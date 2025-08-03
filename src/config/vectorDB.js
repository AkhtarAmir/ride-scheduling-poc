// Vector Database Configuration
const vectorDBConfig = {
  // Pinecone Configuration
  pinecone: {
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
    indexName: process.env.PINECONE_INDEX_NAME || 'ride-booking-conversations',
    dimension: 1536, // OpenAI text-embedding-3-small dimension
    metric: 'cosine'
  },
  
  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
  },
  
  // Conversation Settings
  conversation: {
    maxHistoryLength: 10,
    similarityThreshold: 0.2,
    maxResults: 5
  }
  
};

module.exports = vectorDBConfig; 