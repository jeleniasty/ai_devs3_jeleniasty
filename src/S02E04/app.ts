import { CONFIG } from '../config';
import { ResourceService } from '../services/ResourceService';
import * as path from 'path';
import { OpenAIService } from '../services/OpenAIService';
import * as fs from 'fs/promises';
import { OpenAIRoles } from '../enums/OpenAIRoles';
import { OpenAIModel } from '../enums/OpenAIModel';
import axios from 'axios';

const CURRENT_DIR = path.join(process.cwd(), 'src', 'S02E04');
const resourceService = new ResourceService(CURRENT_DIR);

const openai = new OpenAIService();

const CATEGORIZE_SYSTEM_PROMPT = `You are a file categorization assistant. Your task is to analyze the content and categorize it into exactly one of these categories:
1. "People" - ONLY if the content contains information about CAPTURED people or CLEAR TRACES of their presence (like footprints, abandoned equipment, or direct sightings)
2. "Hardware" - ONLY if the content explicitly describes a HARDWARE failure (not software, not routine issues, not maintenance)

If the content doesn't fit either category, respond with "SKIP".

IMPORTANT RULES:
- Just because a text mentions reconnaissance, searching, or looking for enemies does NOT mean it belongs in the "People" category. There must be ACTUAL EVIDENCE of people or their traces.
- Just because a text mentions equipment, systems, or technical issues does NOT mean it belongs in the "Hardware" category. There must be an explicit HARDWARE failure.

Examples:
"The supply convoy was delayed due to heavy fog along the mountain pass." -> SKIP
"The malfunction was traced to a critical hardware failure in the communications system" -> Hardware
"The drone mission was aborted due to a critical software failure in the navigation system." -> SKIP
"Footprints and abandoned equipment were found near the northern perimeter" -> People
"Multiple thermal signatures detected in sector B" -> People
"Routine maintenance check completed, all systems operational" -> SKIP
"Reconnaissance team searched the area but found no signs of activity" -> SKIP
"Area appears abandoned with no recent human presence" -> SKIP
"Conducting routine patrol of sector C" -> SKIP
"Fresh footprints and recently disturbed vegetation found in sector A" -> People
"Searching for enemy forces in the northern sector" -> SKIP
"Recent campfire remains and food wrappers discovered" -> People
"Hardware failure detected in the power supply unit" -> Hardware
"Software update required for the communication system" -> SKIP
"Routine system check completed successfully" -> SKIP
"Physical damage to the antenna array detected" -> Hardware
"Network connectivity issues reported" -> SKIP
"Mechanical failure in the cooling system" -> Hardware

Respond with ONLY the category name or "SKIP", nothing else.`;

const IMAGE_ANALYSIS_PROMPT = `You are an image text extraction assistant. Your task is to carefully read and extract ALL text visible in the image.

Rules:
1. Extract ONLY the text that is actually visible in the image
2. Preserve the exact text, including:
   - Numbers
   - Special characters
   - Line breaks
   - Spaces
3. Handle different text styles:
   - Read text in ALL sizes (from very small to very large)
   - Read text in ALL fonts and styles
   - Read text in different orientations (horizontal, vertical, diagonal)
   - Read text with different colors and contrasts
4. Do not add any interpretation or description
5. Do not add any text that is not visible in the image`;

const TRANSCRIPTION_PROMPT = `You are an audio transcription assistant. Your task is to accurately transcribe the spoken content from the audio file.

Rules:
1. Transcribe ALL spoken words exactly as heard
2. Preserve:
   - Numbers and measurements
   - Names and proper nouns
   - Technical terms
   - Punctuation where clearly indicated by speech
3. Include:
   - Background noises in [brackets] if relevant to context
   - Unclear words as [inaudible]
   - Uncertain words with [?]
4. Do not add any interpretation or description`;

async function transcribeSpeech(filePath: string) {
    const transcription = await openai.transcribeAudio(filePath, {
        prompt: TRANSCRIPTION_PROMPT,
        language: 'en',
        responseFormat: 'json'
    });
    return transcription;
}

async function describeImage(filePath: string) {
    const imageBuffer = await fs.readFile(filePath);
    const description = await openai.analyzeImage(imageBuffer, {
        prompt: IMAGE_ANALYSIS_PROMPT
    });
    return description;
}

async function main() {
    const extractedDirectory = await resourceService.downloadAndExtractZip(CONFIG.WAREHOUSE_DATA_URL, 'warehouse_data.zip');
    const files = await resourceService.getFilesWithExtensions(['.txt', '.png', '.mp3'], extractedDirectory);

    const filesDescriptionMap = new Map<string, string>();
    const categorizedFiles = new Map<string, string>();

    for (const file of files) {
        console.log(`Processing file: ${file}`);
        const filePath = file;
        const ext = path.extname(file).toLowerCase();
        
        try {
            switch (ext) {
                case '.txt':
                    const content = await fs.readFile(filePath, 'utf-8');
                    filesDescriptionMap.set(file, content);
                    break;
                case '.png':
                    const imageDescription = await describeImage(filePath);
                    filesDescriptionMap.set(file, imageDescription);
                    break;
                case '.mp3':
                    const transcription = await transcribeSpeech(filePath);
                    filesDescriptionMap.set(file, transcription);
                    break;
            }
        } catch (error) {
            console.error(`Error processing file ${file}:`, error);
            continue;
        }
    }

    console.log('\nProcessing all files:');

    for (const [filename, content] of filesDescriptionMap.entries()) {

        const category = await openai.getCompletion<string>([
            { role: OpenAIRoles.SYSTEM, content: CATEGORIZE_SYSTEM_PROMPT },
            { role: OpenAIRoles.USER, content }
        ], {
            model: OpenAIModel.GPT35_TURBO,
            temperature: 0
        });
        
        if (category === 'SKIP') {
            filesDescriptionMap.delete(filename);
        } else {
            categorizedFiles.set(filename, category);
        }
    }

    console.log('\nCategorized files:');
    for (const [filename, category] of categorizedFiles.entries()) {
        console.log(`${filename}: ${category}`);
    }

    const peopleFiles = Array.from(categorizedFiles.entries())
        .filter(([_, category]) => category === 'People')
        .map(([filename]) => path.basename(filename))
        .sort();

    const hardwareFiles = Array.from(categorizedFiles.entries())
        .filter(([_, category]) => category === 'Hardware')
        .map(([filename]) => path.basename(filename))
        .sort();

    const reportData = {
        task: 'kategorie',
        apikey: process.env.C3NTRALA_KEY,
        answer: {
            people: peopleFiles,
            hardware: hardwareFiles
        }
    };

    const reportResponse = await axios.post(CONFIG.REPORT_URL, reportData);
    console.log('\nReport response:', reportResponse.data.message);
}

main();
