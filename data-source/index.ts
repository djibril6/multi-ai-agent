import { ChatOpenAI } from "langchain/chat_models/openai";
import { ChatPromptTemplate } from "langchain/prompts";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { splitArrayIntoBatches } from "../utils";
import {
  Index,
  Pinecone,
  PineconeRecord,
  RecordMetadata,
} from "@pinecone-database/pinecone";

const MultiAgentPineconeIndex = "agent-data";

/**
 * Manage data
 */
export class DataSource {
  private readonly chatModel = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-3.5-turbo-16k",
    temperature: 0,
  });
  private readonly embeddingModel = new OpenAIEmbeddings({
    modelName: "text-embedding-ada-002",
    timeout: 60000,
    batchSize: 512,
  });
  private readonly pinecone = new Pinecone({
    apiKey: process.env.PINECONE_KEY!,
    environment: process.env.PINECONE_ENV!,
  });
  private pineconeIndex: Index<RecordMetadata>;

  constructor() {
    // the index should be creating first
    this.pineconeIndex = this.pinecone.Index(MultiAgentPineconeIndex);
  }

  /**
   *
   * @param text the text to split
   * @returns chunked list
   */
  private splitText(text: string, chunkSize = 500, chunkOverlap = 50) {
    return new Promise<string[]>((resolve, reject) => {
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkOverlap,
        chunkSize,
      });

      textSplitter.splitText(text).then((split) => {
        console.log({ len: split[0].length, text: split[0] });
        resolve(split);
      });
    });
  }

  private getPromptForTopic() {
    const system = `You are a text analyser that extract the topics/subjects, or ideas highlighted in the provided text.
  The goal is to identify ideas that will be given to a conversation moderator who will drive the conversation between multiple participants according the the extracted topics or ideas.
  Give you answer in the following JSON format [{"topic 1": "<The topic>"}, {"topic 2": "<The topic>"}].`;

    const user = "{text}";

    return { system, user };
  }

  async extractTopics(text: string) {
    const { system, user } = this.getPromptForTopic();

    const chatPrompt = ChatPromptTemplate.fromMessages([
      ["system", system],
      ["human", user],
    ]);

    const createCompletion = async (split: string) => {
      const chain = chatPrompt.pipe(this.chatModel);

      const completion = await chain.invoke({
        text: split,
      });
      return completion.content as string;
    };

    // We can use big split here since we only want to extract topic list from the text
    const spitted = await this.splitText(text, 1000, 0);

    const batches = splitArrayIntoBatches(spitted, 5);

    const result = [] as string[];
    for (const item of batches) {
      const res = await Promise.all(item.map(createCompletion));
      result.push(...res);
    }

    const output = [] as { [key: string]: string }[];
    result.forEach((re) => {
      try {
        output.push(...JSON.parse(re));
      } catch (error) {}
    });

    return output;
  }

  private async chunkAndEmbed(text: string) {
    const spitted = await this.splitText(text, 500, 50);

    const embeddings = await this.embeddingModel.embedDocuments(spitted);

    return { chunks: spitted, embeddings };
  }

  async storeEmbeddings(text: string, agentId: string) {
    const { chunks, embeddings } = await this.chunkAndEmbed(text);
    const data: PineconeRecord<RecordMetadata>[] = chunks.map((chunk, idx) => ({
      id: `record-${idx}`,
      values: embeddings[idx],
      metadata: { agent: agentId, text: chunk },
    }));

    await this.pineconeIndex.upsert(data);
  }

  async queryVectors(question: string, agentId: string, topK = 10) {
    const [embeddedQ] = await this.embeddingModel.embedDocuments([question]);
    const response = await this.pineconeIndex.query({
      vector: embeddedQ,
      topK,
      includeMetadata: true,
      filter: {
        agent: { $eq: agentId },
      },
    });

    return response.matches;
  }
}
