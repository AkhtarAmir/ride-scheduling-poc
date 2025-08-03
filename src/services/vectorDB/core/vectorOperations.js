const { Pinecone } = require("@pinecone-database/pinecone");
const OpenAI = require("openai");
const config = require("../../../config/vectorDB");
const fetch = require("node-fetch");

class VectorOperations {
  constructor() {
    this.pinecone = null;
    this.openai = null;
    this.index = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      if (!config.openai.apiKey) {
        throw new Error("OpenAI API key is required");
      }
      this.openai = new OpenAI({
        apiKey: config.openai.apiKey,
      });

      if (!config.pinecone.apiKey) {
        throw new Error("Pinecone API key is required");
      }
      this.pinecone = new Pinecone({
        apiKey: config.pinecone.apiKey,
        fetchApi: fetch,
      });

      await this.ensureIndex();

      this.isInitialized = true;
      console.log("✅ Vector Operations initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize Vector Operations:", error.message);
      throw error;
    }
  }

  async ensureIndex() {
    try {
      const indexName = config.pinecone.indexName;
      let indexExists = false;
      try {
        const indexInfo = await this.pinecone.describeIndex(indexName);
        indexExists = !!indexInfo;
        console.log(`✅ Index ${indexName} already exists`);
      } catch (error) {
        if (
          error.message.includes("not found") ||
          error.message.includes("does not exist")
        ) {
          indexExists = false;
          console.log(`ℹ️ Index ${indexName} does not exist, will create it`);
        } else {
          console.error("❌ Error checking index existence:", error.message);
          throw error;
        }
      }

      if (!indexExists) {
        console.log(`Creating Pinecone index: ${indexName}`);

        await this.pinecone.createIndex({
          name: indexName,
          dimension: config.pinecone.dimension || 1536,
          metric: config.pinecone.metric || "cosine",
          pods: 1,
          replicas: 1,
          podType: "s1.x1",
          waitUntilReady: true,
          suppressConflicts: true,
        });

        console.log(`✅ Index ${indexName} created successfully`);
      }

      this.index = this.pinecone.index(indexName);
      console.log(`✅ Pinecone index ready: ${indexName}`);
    } catch (error) {
      console.error("❌ Failed to ensure index:", error.message);
      throw error;
    }
  }

  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: config.openai.embeddingModel || "text-embedding-3-small",
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error("❌ Failed to generate embedding:", error.message);
      throw error;
    }
  }

  async storeVector(id, embedding, metadata) {
    try {
      if (!this.isInitialized) {
        throw new Error("Vector Operations not initialized");
      }

      const vector = {
        id,
        values: embedding,
        metadata: {
          timestamp: new Date().toISOString(),
          ...metadata,
        },
      };

      await this.index.upsert([vector]);
      return vector.id;
    } catch (error) {
      console.error("❌ Failed to store vector:", error.message);
      throw error;
    }
  }

  async queryVectors(embedding, options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error("Vector Operations not initialized");
      }

      const queryOptions = {
        vector: embedding,
        topK: options.limit || 10,
        includeMetadata: true,
        filter: options.filter || undefined,
      };

      const results = await this.index.query(queryOptions);
      return results.matches || [];
    } catch (error) {
      console.error("❌ Failed to query vectors:", error.message);
      return [];
    }
  }

  async getStats() {
    try {
      if (!this.isInitialized) {
        throw new Error("Vector Operations not initialized");
      }
      const stats = await this.index.describeIndexStats();
      return {
        totalVectors: stats.totalVectorCount,
        dimension: stats.dimension,
        namespaces: stats.namespaces || {},
      };
    } catch (error) {
      console.error("❌ Failed to get stats:", error.message);
      return null;
    }
  }

  async deleteVectors(filter) {
    try {
      if (!this.isInitialized) {
        throw new Error("Vector Operations not initialized");
      }
      await this.index.deleteMany({ filter });
    } catch (error) {
      console.error("❌ Failed to delete vectors:", error.message);
      throw error;
    }
  }

  async deleteVectorsByIds(ids) {
    try {
      if (!this.isInitialized) {
        throw new Error("Vector Operations not initialized");
      }
      await this.index.deleteMany({ ids });
    } catch (error) {
      console.error("❌ Failed to delete vectors by IDs:", error.message);
      throw error;
    }
  }

  getOpenAIClient() {
    return this.openai;
  }

  getIndex() {
    return this.index;
  }

  isReady() {
    return this.isInitialized;
  }
}

module.exports = VectorOperations; 