import axios from 'axios';
import { CONFIG } from '../config';
import dotenv from 'dotenv';
import TurndownService from 'turndown';
import { OpenAIService } from '../services/OpenAIService';
import { OpenAIRoles } from '../enums/OpenAIRoles';
import { OpenAIModel } from '../enums/OpenAIModel';
import { readFileSync } from 'fs';


dotenv.config();

const MAX_ITERATIONS = 10;

const turndownService = new TurndownService();
const openai = new OpenAIService();

const pathDecisionPrompt = readFileSync(require.resolve('./prompts/pathDecisionPrompt.md'), 'utf8');
const pathsFindingPrompt = readFileSync(require.resolve('./prompts/pathsFindingPrompt.md'), 'utf8');
const answerPrompt = readFileSync(require.resolve('./prompts/answerPrompt.md'), 'utf8');

const questionAnswerPrompt = `
You are an AI language model that analyzes web page content provided in HTML format.
Your task is to determine whether the answer to a specific question is contained within the page content.

Instructions:
- Thoroughly analyze the provided HTML content.
- If the answer to the question is present, return a concise and precise response that directly answers the question.
- If the answer is not present, ambiguous, incomplete, or inferred, respond with: NO_DATA
- Be objective and avoid assumptions. ALWAYS use only the information explicitly stated in the provided HTML content.

Output Format:
- Respond with either the concise, factual answer (if found), or NO_DATA (if the answer is not explicitly present or cannot be determined with certainty).
`;

async function getQuestions(): Promise<{[key: string]: string}> {
    const url = CONFIG.PAGE_QUESTIONS_URL;
    const response = await axios.get(url);
    return response.data;
}

async function answerQuestion(pageContent: string, question: string): Promise<string> {
    return openai.getCompletion([
        {role: OpenAIRoles.SYSTEM, content: questionAnswerPrompt },
        {role: OpenAIRoles.USER, content: `Question: ${question}\n\nPage Content (HTML):\n${pageContent}`}
    ], {model: OpenAIModel.GPT41_MINI});
}


async function getPagePaths(pageContent: string): Promise<string[]> {
    return openai.getCompletion([
        {role: OpenAIRoles.SYSTEM, content: pathsFindingPrompt },
        {role: OpenAIRoles.USER, content: `Page Content (HTML):\n${pageContent}`}
    ], {model: OpenAIModel.GPT41_MINI});
}

async function choosePath(pageContent: string, question: string): Promise<string> {
    return openai.getCompletion([
        {role: OpenAIRoles.SYSTEM, content: linkSelectionPrompt },
        {role: OpenAIRoles.USER, content: `Question: ${question}\n\nPage Content (HTML):\n${pageContent}`}
    ], {model: OpenAIModel.GPT41_MINI});
}

async function findAnswer(question: string) {
    const page = (await axios.get(CONFIG.WEB_PAGE_URL)).data;
    let currentIteration = 0;
    let currentPage = page;
    let currentPath;

    console.log('Q:'+question);
    let answer = await answerQuestion(page, question);
    console.log('Answer nr ' + currentIteration + ': ' + answer);

    while(currentIteration < 10 && answer === 'NO_DATA') {
        currentIteration++;
        currentPath = await choosePath(currentPage, question);
        console.log('Current path:' + currentPath);
        currentPage = (await axios.get(CONFIG.WEB_PAGE_URL + currentPath)).data;
        answer = await answerQuestion(currentPage, question);
        console.log('Answer nr ' + currentIteration + ': ' + answer);
    }
    console.log('Final answer: ' + answer);
    return answer;
}

async function main() {
    const questions = await getQuestions();
    console.log(questions);

    

    for (const [key, question] of Object.entries(questions)[1]) {
        const answer = await findAnswer(question);
        console.log(`Q: ${question}\nA: ${answer}`);
        break;
    }
}

main();