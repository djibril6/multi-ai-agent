import OpenAI from "openai";
import { DataSource } from "../data-source";
import { Conversation } from "./type";
import { Moderator } from "./Moderator";
import { Agent } from "./Participant";

export class MultiAgent {
  private agents = [] as Agent[];
  private moderator: Moderator;
  private readonly dataSource: DataSource;
  private conversations: Conversation[];
  private readonly subject: string;

  constructor(subject: string, moderator: Moderator, agents: Agent[]) {
    // the index should be creating first
    this.dataSource = new DataSource();
    this.agents = agents;
    this.moderator = moderator;
    this.subject = subject;
    this.conversations = [];
  }

  // ! this is just for testing as the knowledge chunking and storage is already handled
  // ! by our current data-source service
  // ! So in real world we just have to query it
  private loadCustomKnowledge(agentId: string, knowledge: string) {
    this.dataSource.storeEmbeddings(knowledge, agentId);
  }

  async run(knowledge?: string) {
    let topics = [] as string[];
    if (!knowledge) {
      const res = await this.moderator.generateTopics();
      topics = JSON.parse(res.choices[0].message.content!).topics.map(
        (item: any) => item.topic
      );
    } else {
      // todo: extract topics from the custom knowledge base as well
    }

    for (const topic of topics) {
      const modRes = await this.moderator.speak(
        this.agents,
        topic,
        this.conversations
      );
      const moderatorResponse = JSON.parse(modRes.choices[0].message.content!);

      if (moderatorResponse.comment) {
        console.log(`[Moderator] comment: ${moderatorResponse.comment}`);
      }

      console.log(`[Moderator] question: ${moderatorResponse.question}`);

      for (const agent of this.agents) {
        const element = agent.info();

        // check if the agent has been selected by the  moderator
        if (moderatorResponse.participants.includes(element.id)) {
          const _agentResponse = await agent.speak(
            this.subject,
            moderatorResponse.question,
            ""
          );

          const agentResponse = JSON.parse(
            _agentResponse.choices[0].message.content!.split("\n").join(" ")
          );

          console.log(`[${element.name}] response: ${agentResponse.response}`);

          this.conversations.push({
            message: agentResponse.response,
            participant: element.name,
          });
        }
      }
    }
  }
}

export const getSummarizerPrompt = (
  subject: string,
  conversation: Conversation[]
) => {
  const assistant = `You summarize a given conversation between multiple participants about a subject. 
  Make sure you capture all the interesting ideas relevant to the subject in your summary such as anyone reading your summary
  will catch up on what have been discussed, the problems rased as well as the solutions proposed.`;

  const conversationHistory = conversation.reduce(
    (prev, curr) => prev + `- ${curr.participant}: ${curr.message}\n`,
    ""
  );

  const user = `The subject of the conversation: ${subject}
  The conversation: 
    ${conversationHistory}
  `;
};
