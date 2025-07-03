import axios from 'axios';
import { CONFIG } from '../config';
import dotenv from 'dotenv';
import TurndownService from 'turndown';
import { OpenAIService } from '../services/OpenAIService';
import { OpenAIRoles } from '../enums/OpenAIRoles';
import { OpenAIModel } from '../enums/OpenAIModel';
import { readFileSync } from 'fs';
import path from 'path';
import { CentralaService } from '../services/CentralaService';


dotenv.config();

const MAX_ITERATIONS = 10;

const turndownService = new TurndownService();
const openai = new OpenAIService();
const centrala = new CentralaService();

const pathDecisionPrompt = readFileSync(
  path.resolve(__dirname, '../../src/S04E03/prompts/pathDecisionPrompt.md'),
  'utf8'
);
const pathsFindingPrompt = readFileSync(
  path.resolve(__dirname, '../../src/S04E03/prompts/pathsFindingPrompt.md'),
  'utf8'
);
const answerPrompt = readFileSync(
  path.resolve(__dirname, '../../src/S04E03/prompts/answerPrompt.md'),
  'utf8'
);

async function getQuestions(): Promise<{[key: string]: string}> {
    const url = CONFIG.PAGE_QUESTIONS_URL;
    const response = await axios.get(url);
    return response.data;
}

async function answerQuestion(pageContent: string, question: string): Promise<string> {
    const mdPageContent = turndownService.turndown(pageContent);
    const userPrompt = answerPrompt.replace('{{question}}', question).replace('{{content}}', mdPageContent);
    return openai.getCompletion([
        {role: OpenAIRoles.USER, content: userPrompt}
    ], {model: OpenAIModel.GPT41_MINI});
}


async function getPagePaths(pageContent: string): Promise<Map<string, string>> {
    const userPrompt = pathsFindingPrompt.replace('{{content}}', pageContent);
    const result = await openai.getCompletion([
        {role: OpenAIRoles.USER, content: userPrompt}
    ], {model: OpenAIModel.GPT41_MINI});

    try {
        const obj = typeof result === 'string' ? JSON.parse(result) : result;
        return new Map(Object.entries(obj));
    } catch {
        return new Map();
    }
}

async function choosePath(paths: Map<string, string>, question: string): Promise<string> {
    const formattedPaths = Array.from(paths.entries())
        .map(([path, desc]) => `- ${path} : ${desc}`)
        .join('\n');

    const userPrompt = pathDecisionPrompt
        .replace('{{question}}', question)
        .replace('{{paths}}', formattedPaths);

    const response = await openai.getCompletion([
        {role: OpenAIRoles.USER, content: userPrompt}
    ], {model: OpenAIModel.GPT41_MINI});

    let chosenPath = typeof response === 'string' ? response.trim() : '';
    if (!paths.has(chosenPath)) {
        console.warn(`[choosePath] LLM hallucinated path: ${chosenPath}. Returning '/' instead.`);
        return '/';
    }
    return chosenPath;
}

async function findAnswer(question: string) {
    console.log(`\n[findAnswer] Starting to find answer for question: "${question}"`);
    let paths = new Map<string, string>();
    let currentPath = '/';
    let currentIteration = 0;
    
    console.log(`[findAnswer] Fetching root page content from: ${CONFIG.WEB_PAGE_URL}`);
    let pageContent = (await axios.get(CONFIG.WEB_PAGE_URL)).data;
    
    console.log(`[findAnswer] Attempting initial answer...`);
    let answer = await answerQuestion(pageContent, question);
    console.log(`[findAnswer] Initial answer attempt: ${answer}`);

    while(answer === 'NO_DATA' && currentIteration < MAX_ITERATIONS) {
        currentIteration++;
        console.log(`\n[findAnswer] Iteration ${currentIteration}`);
        console.log(`[findAnswer] Extracting paths...`);
        let newPaths = await getPagePaths(pageContent);

        paths = new Map([ ...paths, ...newPaths ]);
        console.log(`[findAnswer] Possible paths:`, Array.from(paths.entries()));

        console.log(`[findAnswer] Choosing path...`);
        let chosenPath = await choosePath(paths, question);
        console.log(`[findAnswer] Chosen path: ${chosenPath}`);
        currentPath = chosenPath;

        console.log(`[findAnswer] Fetching page content from: ${CONFIG.WEB_PAGE_URL + currentPath}`);
        pageContent = (await axios.get(CONFIG.WEB_PAGE_URL + currentPath)).data;

        console.log(`[findAnswer] Attempting answer...`);
        answer = await answerQuestion(pageContent, question);
        console.log(`[findAnswer] Answer attempt: ${answer}`);
        paths.delete(currentPath);
    }

    console.log(`[findAnswer] Final answer: ${answer}`);
    return answer;
}

async function main() {
    const questions = await getQuestions();
    console.log(questions);

    let answers: {[key: string]: string} = {};
    try {
        for (const [key, question] of Object.entries(questions)) {
            const answer = await findAnswer(question);
            console.log(`Q: ${question}\nA: ${answer}`);
            answers[key] = answer;
        }
    } catch (err) {
        console.error('[main] Error during question answering:', err);
    }

    const flag = await centrala.callReport('softo', answers);
    console.log(flag);
}

main();