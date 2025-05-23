import { CONFIG } from '../config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { OpenAIService } from '../services/OpenAI/OpenAIService';
import { OpenAIRoles } from '../services/OpenAI/OpenAIRoles';
import { ResourceService } from '../services/ResourceService';

const CURRENT_DIR = path.join(process.cwd(), 'src', 'S02E01');
const REPORT_URL = CONFIG.REPORT_URL;

const transcribeSystemPrompt = `You are a police officer transcribing an interrogation. 
Focus on accurately transcribing the conversation, including any names, dates, and locations mentioned.
Pay special attention to any incriminating statements or confessions.`;

const textSystemPrompt = `Based on transcriptions from witnesses interrogation you should determine on which street a specific university institute is located, where Professor Andrzej Maj teaches.

Follow these steps in your analysis:
1. First, carefully read through all transcriptions to identify any mentions of locations, streets, or university buildings
2. Look specifically for any mentions of Professor Andrzej Maj and note the context around these mentions
3. Pay attention to any references to university institutes or departments
4. Based on the evidence, determine:
   a. Which university Professor Maj works at
   b. Which specific institute or department he belongs to
   c. What is the main focus of his work (based on mentions of his research/teaching)
5. Using this information and your knowledge about Polish universities, determine the exact street where this institute is located
6. Provide your final answer in a clean JSON format (no markdown formatting) with the following structure:
{
    "answer": "street name",
    "thinking": "your detailed reasoning including: which university you identified, which institute/department, and how you determined the street location"
}`;

const openai = new OpenAIService();
const resourceService = new ResourceService(CURRENT_DIR);

async function transcribeFiles(directory: string): Promise<string> {
    let transcriptedFiles = '';
    let counter = 1;

    const files = fs.readdirSync(directory);
    console.log('Files to process:', files);

    for (const file of files) {
        console.log(`Processing file ${counter}: ${file}`);
        const filePath = path.join(directory, file);
        
        try {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const transcription = await openai.getCompletion([
                { role: 'system', content: transcribeSystemPrompt },
                { role: 'user', content: fileContent }
            ]);
            transcriptedFiles += `\n\nTranscription of ${file}:\n${transcription}`;
            counter++;
        } catch (error) {
            console.error(`Error processing file ${file}:`, error);
        }
    }

    return transcriptedFiles;
}

async function main() {
    const extractedDirectory = await resourceService.downloadAndExtractZip(CONFIG.INTERROGATION_DATA_URL, 'przesluchania.zip');
    const transcribedFiles = await transcribeFiles(extractedDirectory);
    console.log(transcribedFiles);

    const answer = await openai.getCompletion([{role: OpenAIRoles.SYSTEM, content: textSystemPrompt}, {role: OpenAIRoles.USER, content: transcribedFiles}]);
    try {
        const parsedAnswer = JSON.parse(answer as string);
        console.log('Answer:', parsedAnswer.answer);
        console.log('Reasoning:', parsedAnswer.thinking);

        const reportResponse = await axios.post(
            REPORT_URL, {
            task: 'mp3',
            apikey: process.env.C3NTRALA_KEY,
            answer: parsedAnswer.answer
        });

        console.log(reportResponse);
    } catch (error) {
        console.error('Failed to parse JSON response:', error);
        console.log('Raw response:', answer);
    }
}

main().catch(console.error);