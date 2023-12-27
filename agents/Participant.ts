import OpenAI from "openai";
import { DataSource } from "../data-source";
import { LlmModel } from "./type";

export class Agent {
  private name: string;
  private readonly id: string;
  private personality: string;
  private expertise?: string;
  private readonly model: LlmModel;
  private useCustomKnowledgeOnly: boolean;
  private readonly dataSource: DataSource;

  private readonly openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  constructor(
    id: string,
    name: string,
    personality: string,
    model: LlmModel,
    useCustomKnowledgeOnly: boolean,
    expertise?: string
  ) {
    this.id = id;
    this.name = name;
    this.personality = personality;
    this.model = model;
    this.expertise = expertise;
    this.useCustomKnowledgeOnly = useCustomKnowledgeOnly;

    this.dataSource = new DataSource();
  }

  private getPrompt = (
    subject: string,
    question: string,
    previousChat?: string,
    knowledge?: string
  ) => {
    const system = `Your name is ${
      this.name
    }. You have the following personality: ${this.personality}.
  ${this.expertise ? `And here is your expertise: ${this.expertise}` : ""}
  You are participating in a group conversation about this subject: ${subject}.
  When the moderator ask you a question, answer it according to your personality. 
   
  ${
    knowledge
      ? "Try to find the answer from your knowledge base only. If the answer can't be found based on that, " +
        this.useCustomKnowledgeOnly
        ? `says: 'I do not have any though on this subject.'`
        : `then try to find an answer outside of the provided knowledge by respecting the scope of your expertise if any.`
      : "Answer the question asked by respecting the scope of your expertise if any."
  }. 
  
    Not that the moderator can ask you a question that came from another participant.
    You can also if you find it relevant, ask a question on top of your response either directed to the moderator of another participant.
    You are not obligated to ask a question so don't feel like you have to.

    Your responses should alway use the following JSON format: {"response": "<response>"} or in case you have a question: {"response": "<response>", "question": "<Your question>"}
  `;

    const user = `
    Here is your knowledge: ${knowledge}.
    Here is a summary of what others say: ${previousChat}
    Answer The question: ${question}`;
    return { system, user };
  };

  async speak(subject: string, question: string, previousChat?: string) {
    let knowledge;
    try {
      const context = await this.dataSource.queryVectors(question, this.id);

      knowledge = context.reduce((prev, curr) => {
        // todo: check if we did not exceed the token limit
        return prev + `${curr.metadata?.text || ""}\n`;
      }, "");
    } catch (e) {}
    const { system, user } = this.getPrompt(
      subject,
      question,
      previousChat,
      knowledge
    );

    const messages: any[] = [
      {
        role: "system",
        content: system,
      },
      {
        role: "user",
        content: user,
      },
    ];
    return new Promise<OpenAI.Chat.Completions.ChatCompletion>(
      (resolve, reject) => {
        this.openai.chat.completions
          .create({
            model: "gpt-4-1106-preview",
            messages,
            temperature: 0,
            max_tokens: 500,
            presence_penalty: 0,
          })
          .then((res) => {
            resolve(res);
          })
          .catch((err) => {
            reject(err);
          });
      }
    );
  }

  info() {
    return {
      id: this.id,
      name: this.name,
      expertise: this.expertise,
      personality: this.personality,
    };
  }
}
