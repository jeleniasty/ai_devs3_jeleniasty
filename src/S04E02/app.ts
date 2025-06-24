import { ResourceService } from '../services/ResourceService';
import path from 'path';
import { CONFIG } from '../config';
import * as fs from 'fs';
import { OpenAIRoles } from '../enums/OpenAIRoles';
import { OpenAIService } from '../services/OpenAIService';
import { CentralaService } from '../services/CentralaService';

const resourceService = new ResourceService(path.join(process.cwd(), 'src', 'S04E02'));
const openai = new OpenAIService();
const centrala = new CentralaService();

async function prepareFileToFineTuning(extractedDir: string) {
    const correctPath = path.join(extractedDir, 'correct.txt');
    const incorrectPath = path.join(extractedDir, 'incorect.txt');
    const outputPath = path.join(extractedDir, 'finetune.jsonl');

    const linesToJsonl = (lines: string[], label: string) =>
        lines
            .filter(line => line.trim().length > 0)
            .map(line => JSON.stringify({
                messages: [
                    { role: OpenAIRoles.SYSTEM, content: 'validate data' },
                    { role: OpenAIRoles.USER, content: line },
                    { role: OpenAIRoles.ASSISTANT, content: label }
                ]
            }));

    const correctLines = fs.readFileSync(correctPath, 'utf-8').split(/\r?\n/);
    const incorrectLines = fs.readFileSync(incorrectPath, 'utf-8').split(/\r?\n/);

    const jsonlLines = [
        ...linesToJsonl(correctLines, '1'),
        ...linesToJsonl(incorrectLines, '0')
    ];

    fs.writeFileSync(outputPath, jsonlLines.join('\n'), 'utf-8');
}

async function fineTune(modelIdPath: string, filesPath: string) {

    if (fs.existsSync(modelIdPath)) {
        const savedModelId = fs.readFileSync(modelIdPath, 'utf-8').trim();
        if (savedModelId) {
            console.log('✅ Fine-tuned model already exists:', savedModelId);
            return;
        }
    }

    const fineTuningJobId = await openai.fineTune(path.join(filesPath, 'finetune.jsonl'));

    let job;
    while (true) {
        job = await openai.checkFineTuneStatus(fineTuningJobId);
        console.log('⏳ Current fine-tune job status:', job.status);

        if (job.status === 'succeeded') {
            console.log('✅ Fine-tuning successfully completed! Fine-tuned model:', job.fine_tuned_model);
            fs.writeFileSync(modelIdPath, job.fine_tuned_model, 'utf-8');
            break;
        } else if (job.status === 'failed' || job.status === 'cancelled') {
            console.log('❌ Fine-tuning job failed or was cancelled.');
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 30000));
    }
}

async function verifyWithFineTunedModel(modelIdPath: string, filesPath: string) {
    if (!fs.existsSync(modelIdPath)) {
        console.log('❌ No fine-tuned model found. Please run fine-tuning first.');
        return [];
    }
    const modelId = fs.readFileSync(modelIdPath, 'utf-8').trim();
    if (!modelId) {
        console.log('❌ Model ID file is empty.');
        return [];
    }
    const verifyPath = path.join(filesPath, 'verify.txt');
    if (!fs.existsSync(verifyPath)) {
        console.log('❌ verify.txt not found in extracted directory.');
        return [];
    }
    const verifyLines = fs.readFileSync(verifyPath, 'utf-8').split(/\r?\n/).filter(line => line.trim().length > 0);
    const results: [string, string][] = [];
    for (const line of verifyLines) {
        const match = line.match(/^(\S+?)=(.+)$/);
        if (!match) {
            console.log(`❌ Invalid line format: ${line}`);
            continue;
        }
        const index = match[1];
        const data = match[2];
        const prompt = `Validate the following data and return strictly 0 or 1, no matter what, based on your best knowledge. Only return the digit. Data: ${data}`;
        const messages = [
            { role: OpenAIRoles.SYSTEM, content: 'validate data' },
            { role: OpenAIRoles.USER, content: prompt }
        ];
        try {
            const completion = await openai.getCompletion(messages, { model: modelId }) as string;
            const value = completion.trim();
            if (value === '0' || value === '1') {
                results.push([index, value]);
            } else {
                results.push([index, 'Error']);
            }
        } catch (error) {
            results.push([index, 'Error']);
        }
    }
    return results;
}

async function main() {
    const extractedDirectory = await resourceService.downloadAndExtractZip(CONFIG.LAB_DATA_URL, 'lab_data.zip');
    await prepareFileToFineTuning(extractedDirectory);

    const modelIdPath = path.join(extractedDirectory, 'finetuned_model.txt');
    await fineTune(modelIdPath, extractedDirectory);

    const results = await verifyWithFineTunedModel(modelIdPath, extractedDirectory);
    console.log(results);

    const positiveResults = results.filter(result => result[1] === '1').map(result => result[0]);

    const flag = await centrala.callReport('research', positiveResults);

    console.log(flag);
}

main();