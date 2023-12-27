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

multiAgent.run();
