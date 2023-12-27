import OpenAI from "openai";
import { Agent } from "./Participant";

export class Moderator {
  private name: string;
  private readonly subject: string;

  private readonly openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  constructor(subject: string, name: string) {
    this.subject = subject;
    this.name = name;
  }

  generateTopics() {
    const messages: any[] = [
      {
        role: "system",
        content: `You are the moderator for a conversation group about a subject.
        Split the subject into a list of at least 5 subtopics on which the participant should focus on.
        order the list by order of importance. For example if you think the conversation should start around the "topic 1" then "topic 1" should be the first on the list.

        Your response should be in the following json format: {"topics": [{"topic": "<the topic 1>"}, "topic": "<the topic 2>"}]}
        `,
      },
      {
        role: "user",
        content: `The subject: ${this.subject}`,
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
            response_format: { type: "json_object" },
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

  private getPrompt = (
    participants: Agent[],
    subtopic: string,
    lastConversations: { message: string; participant: string }[]
  ) => {
    const system = `
        You are the moderator for a group conversation.
        You will guide the conversation for the purpose of making every actor participate and give their thought on the selected subject.
        You will have the history of the conversations so far as well as a subtopic relevant to the subject to use in order to narrow the conversation.
        Based on the conversation history, and the provided personality and expertise of each participant, select the participants that you think can talk about the subtopic.
        Then formulate a question they should all answer related to the subtopic.
        In addition you can also analyze the last conversations and if you find it relevant you can give a comment. 

      Your output result will be in the following json format: { "participants": ["<id of the next participant>"], "question": "<question to ask them>", "comment": "<Your comment if any on the last conversation>"}
    `;

    const listOfParticipant = participants.reduce((prev, curr) => {
      const info = curr.info();
      return (
        prev +
        `- id: ${info.id}, Name: ${info.name}, expertise: ${info.expertise};\n`
      );
    }, "");

    // this can eventually be summarized
    const pastConversation = lastConversations.reduce(
      (prev, curr) => prev + `- ${curr.participant}: ${curr.message}\n`,
      ""
    );

    const user = `
        Today You will be moderating a conversation on this subject: ${
          this.subject
        }.

        Here is the list of participants:
        ${listOfParticipant}

        Here is the selected subtopic you can use to give direction to the conversation
        ${subtopic}

        Here is the conversation so far:
        ${
          lastConversations.length > 0
            ? pastConversation
            : "Nothing has been said yet"
        }

        Your response in JSON: 
    `;
    return { system, user };
  };

  async speak(
    participants: Agent[],
    topic: string,
    lastConversations: {
      message: string;
      participant: string;
    }[]
  ) {
    const { system, user } = this.getPrompt(
      participants,
      topic,
      lastConversations
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
            response_format: { type: "json_object" },
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
      name: this.name,
    };
  }
}
