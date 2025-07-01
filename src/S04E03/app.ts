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

async function getQuestions(): Promise<{[key: string]: string}> {
    const url = CONFIG.PAGE_QUESTIONS_URL;
    const response = await axios.get(url);
    return response.data;
}

async function answerQuestion(pageContent: string, question: string): Promise<string> {
    return openai.getCompletion([
        {role: OpenAIRoles.SYSTEM, content: answerPrompt },
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
        {role: OpenAIRoles.SYSTEM, content: pathDecisionPrompt },
        {role: OpenAIRoles.USER, content: `Question: ${question}\n\nPage Content (HTML):\n${pageContent}`}
    ], {model: OpenAIModel.GPT41_MINI});
}

async function findAnswer(question: string) {
    const page = (await axios.get(CONFIG.WEB_PAGE_URL)).data;

    return 'null';
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