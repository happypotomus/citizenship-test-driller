import fs from "node:fs";

const source = fs.readFileSync("src/data/questions.ts", "utf8");
const answers = [...source.matchAll(/answer: ([0-3]),/g)].map((match) => Number(match[1]));
const counts = [0, 1, 2, 3].map((answer) => answers.filter((item) => item === answer).length);
const max = Math.max(...counts);
const min = Math.min(...counts);

if (max - min > 1) {
  console.error(`Correct answers are not balanced across A/B/C/D: ${counts.join(", ")}`);
  process.exit(1);
}

if (/Test Format|How many questions are on the Canadian citizenship test|How long is the citizenship test/.test(source)) {
  console.error("Question bank includes low-value test-format cards.");
  process.exit(1);
}

console.log(`Question bank validated. Answer distribution A/B/C/D: ${counts.join(", ")}`);
