import * as fs from 'fs';
import * as path from 'path';
import { OpenAIService } from '../services/OpenAI/OpenAIService';
import { OpenAIModel } from '../services/OpenAI/OpenAIModel';

async function main() {
    const prompts = fs.readFileSync(path.join(process.cwd(), 'src', 'S01E04', 'prompts.md'), 'utf-8');

    const openai = new OpenAIService();

    const response = await openai.getCompletion(
        [{ role: 'user', content: prompts }],
        { model: OpenAIModel.GPT4O_MINI, temperature: 0, maxTokens: 2000 }
    );

    console.log(response);
}

main();