import { CONFIG } from '../config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { OpenAIService } from '../services/OpenAI/OpenAIService';
import { OpenAIRoles } from '../services/OpenAI/OpenAIRoles';

const EXTRACT_DIR = path.join(process.cwd(), 'src', 'S02E01', 'extracted');
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

async function downloadAndExtractZip() {
    try {
        if (fs.existsSync(EXTRACT_DIR) && fs.readdirSync(EXTRACT_DIR).length > 0) {
            console.log('Files already extracted, skipping download and extraction');
            return;
        }

        const tempDir = path.join(process.cwd(), 'src', 'S02E01', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        const response = await axios({
            method: 'GET',
            url: CONFIG.INTERROGATION_DATA_URL,
            responseType: 'arraybuffer'
        });

        const zipPath = path.join(tempDir, 'przesluchania.zip');
        fs.writeFileSync(zipPath, response.data);

        const zip = new AdmZip(zipPath);
        
        if (!fs.existsSync(EXTRACT_DIR)) {
            fs.mkdirSync(EXTRACT_DIR);
        }

        zip.extractAllTo(EXTRACT_DIR, true);

        fs.rmSync(tempDir, { recursive: true, force: true });

        console.log('Files extracted successfully');
    } catch (error) {
        console.error('Error downloading or extracting zip:', error);
    }
}


async function transcribeFiles(): Promise<string> {
    let transcriptedFiles = '';
    let counter = 1;

    const files = fs.readdirSync(EXTRACT_DIR);
    console.log('Files to process:', files);

    for (const file of files) {
        console.log(`Processing file ${counter}: ${file}`);
        const filePath = path.join(EXTRACT_DIR, file);
        
        try {
            const transcription = await openai.transcribeAudio(filePath, {
                language: 'pl',
                prompt: transcribeSystemPrompt
            });
            
            transcriptedFiles += `Witness ${counter}:\n ${transcription}\n`;
            counter++;
        } catch (error) {
            console.error(`Error transcribing ${file}:`, error);
        }
    }

    return transcriptedFiles;
}


async function main(){
    await downloadAndExtractZip();
    const transcribedFiles = await transcribeFiles();
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

main();