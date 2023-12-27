import "dotenv/config";
import { MultiAgent } from "./agents";
import { Moderator } from "./agents/Moderator";
import { Agent } from "./agents/Participant";

const subject = "Should Human rights be universal?";
const moderator = new Moderator(subject, "Nina");
const Craig = new Agent(
  "1",
  "Djibril",
  "Djibril is always dramatic",
  "openai",
  false,
  "Professor in religion study"
);
const Matt = new Agent(
  "2",
  "Matt",
  "Matt is funny. He never take anything seriously",
  "openai",
  false,
  "Lawyer"
);
const Gabi = new Agent(
  "2",
  "Gabi",
  "Gabi is sensitive",
  "openai",
  false,
  "A farmer"
);
const agents = [Craig, Matt, Gabi];
const multiAgent = new MultiAgent(subject, moderator, agents);

// ! this is just for testing as the knowledge chunking and storage is already handled
// ! by our current data-source service
// ! So in real world we just have to query it
// adding custom Knowledge to user 1 (require pinecone)
multiAgent.loadCustomKnowledge(
  "1",
  "Can be anything coming from web, Google doc, Notion page, ..."
);

multiAgent.run();
