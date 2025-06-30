import axios from 'axios';
import { CONFIG } from '../config';
import dotenv from 'dotenv';
import TurndownService from 'turndown';
import { OpenAIService } from '../services/OpenAIService';
import { OpenAIRoles } from '../enums/OpenAIRoles';

dotenv.config();

const MAX_ITERATIONS = 10;

const turndownService = new TurndownService();
const openai = new OpenAIService();

const questionPrompt = `
# AI Web Page Content Analyzer

You are an **AI language model** that analyzes web page content provided in **Markdown format**.  
Your task is to determine whether the answer to a specific question is contained within the page content.

---

## Instructions

1. **Thoroughly analyze** the provided Markdown content.
2. **Determine** whether the page contains a clear, direct, and accurate answer to the specific question.
3. - If the answer **is present**, return a **concise and precise response** that directly answers the question.
   - If the answer is **not present** or the information is ambiguous, incomplete, or inferred, select the **hyperlink** (\`(href)\`) from the page that most likely leads to a page containing the answer.  
     **Return only the URL path as plain text, in the format \`/resource\` (e.g., \`/kontakt\`), not as a Markdown link or with any extra text. Do NOT return links like \`[kontakt](./kontakt)\` or \`[Kontakt](/kontakt)\`. Only output the resource path, such as \`/kontakt\`.**

---

## Output Format

Respond with **only one** of the following:

- A **concise, factual answer** (if clearly found), *without any extra commentary*,  
  **OR**
- A **single URL path** (e.g., \`/kontakt\`) from the page content that most likely contains the answer (if not enough information is present on the current page).  
  **Do NOT return Markdown links or any other format. Only output the resource path, such as \`/kontakt\`.**

> **Be objective and avoid assumptions.**  
> Use only the information explicitly stated in the provided Markdown content.  
> If multiple links are present, choose the most relevant one based on the question's topic.

---

## Examples

### Example 1

**Question:**  
What is the capital of France?

**Page Content (Markdown):**
# France

France is a country in Western Europe. It is known for its art, culture, and cuisine.

The capital of France is Paris.

Learn more on the [Geography of France](./geography.md) page.

**Output:** Paris

---

### Example 2

**Question:**  
What is the capital of France?

**Page Content (Markdown):**
# France Overview

France is located in Western Europe and has a population of over 67 million people.  
It is a member of the European Union and has several major cities, including Lyon, Marseille, and Toulouse.

For more details, see the [Geography of France](/geography) or [French Government](/government).

**Output:**  /geography
`;

async function getQuestions(): Promise<{[key: string]: string}> {
    const url = CONFIG.PAGE_QUESTIONS_URL;
    const response = await axios.get(url);
    return response.data;
}

async function convertPageToMarkdown(html: string){
    return turndownService.turndown(html);
}

async function answerQuestion(pageContent: string, question: string): Promise<string> {
    const mdPage = await convertPageToMarkdown(pageContent);
    return openai.getCompletion([
        {role: OpenAIRoles.SYSTEM, content: questionPrompt },
        {role: OpenAIRoles.USER, content: `Question: ${question}\n\nPage Content (Markdown):\n${pageContent}`}
    ]);
}

async function findAnswer(question: string) {
    const page = (await axios.get(CONFIG.WEB_PAGE_URL)).data;
    const currentIteration = 0;

    const answer = await answerQuestion(page, question);

    while(currentIteration < 10 && answer === 'NO_DATA') {
        
    }

    return answer;
}

async function main() {
    const questions = await getQuestions();
    console.log(questions);

    for (const [key, question] of Object.entries(questions)) {
        const answer = await findAnswer(question);
        console.log(`Q: ${question}\nA: ${answer}`);
    }
}

main();

//ask question:
//questionAgent
//decisionAgent