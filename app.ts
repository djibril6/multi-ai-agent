import "dotenv/config";
import OpenAI from "openai";
import { Stream } from "openai/streaming";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function MultiAgentChat(topic: string, iterations: number = 2) {
  const res = await openai.chat.completions.create({
    model: "gpt-4-1106-preview",
    messages: [
      {
        role: "system",
        content: `You are a debate moderator between 2 groups. 
        After receiving the subject of the debate you should attribute to each group,
        which part of the subject they should defend.
        respond in the following json format: {"group1": "You should defend this part of the subject", "group2": "You should defend this part of the subject"}
        `,
      },
      {
        role: "user",
        content: `THE SUBJECT: "${topic}"`,
      },
    ],
    temperature: 0,
    max_tokens: 500,
    presence_penalty: 0,
    response_format: { type: "json_object" },
  });

  if (res.choices[0].message.content) {
    const positions = JSON.parse(res.choices[0].message.content);
    console.log(positions);

    const agent1 = [
      {
        role: "system",
        content: `You are a great debater. You should defend the following position: "${positions.group1}". 
            You will be challenged by another user with arguments or questions that defend the opposite position.
            You should try to respond to these and convince the other user that your position is the right one.
            Make also sure to challenge the other user's position. with arguments or questions.
            `,
      },
      {
        role: "user",
        content: `I think that: ${positions.group2}`,
      },
    ];

    const agent2 = [
      {
        role: "system",
        content: `You are a great debater. You should defend the following position: "${positions.group2}". 
              You will be challenged by another user with arguments or questions that defend the opposite position.
              You should try to respond to these and convince the other user that your position is the right one.
              Make also sure to challenge the other user's position. with arguments or questions.
              `,
      },
      {
        role: "user",
        content: `I think that: ${positions.group1}`,
      },
    ];

    function runAgent(agent: any[]) {
      return new Promise<Stream<OpenAI.Chat.Completions.ChatCompletionChunk>>(
        (resolve, reject) => {
          openai.chat.completions
            .create({
              model: "gpt-4-1106-preview",
              messages: agent,
              temperature: 0,
              max_tokens: 500,
              presence_penalty: 0,
              stream: true,
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

    async function runDebate() {
      const [ag1, ag2] = await Promise.all([
        runAgent(agent1),
        runAgent(agent2),
      ]);

      // printing results
      const colors = {
        Reset: "\x1b[0m",
        FgRed: "\x1b[31m",
        FgBlue: "\x1b[34m",
      };
      let ag1Message = "";
      let ag2Message = "";
      console.log(colors.FgRed, ">>>>>> User 1: ");
      for await (const chunk of ag1) {
        process.stdout.write(chunk.choices[0].delta.content || "");
        ag1Message += chunk.choices[0].delta.content || "";
      }

      process.stdout.write("\n\n");

      console.log(colors.FgBlue, ">>>>>> User 2: ");
      for await (const chunk of ag2) {
        process.stdout.write(chunk.choices[0].delta.content || "");
        ag2Message += chunk.choices[0].delta.content || "";
      }

      process.stdout.write("\n\n");

      //   console.log({
      //     agent1: ag1,
      //   });

      //   console.log({
      //     agent2: ag2.choices[0].message.content,
      //   });

      // adding previous arguments to the agent's memory
      agent1.push({
        role: "assistant",
        content: `${ag1Message}`,
      });
      agent2.push({
        role: "assistant",
        content: `${ag2Message}`,
      });
      agent1.push({
        role: "user",
        content: `${ag2Message}`,
      });
      agent2.push({
        role: "user",
        content: `${ag1Message}`,
      });

      // continuing the debate if it is not finished
      if (agent1.length <= iterations * 2) {
        await runDebate();
      }
    }

    await runDebate();
  }
}

const subjects = [
  "Should we ban the use of nuclear energy?",
  "Is AI going to replace developers?",
  "Is it ethical to use animals for testing?",
  "Should we stop developing AI because it is dangerous?",
  "People working remotely should use an app that tracks their activity",
];
MultiAgentChat(subjects[1], 2);
