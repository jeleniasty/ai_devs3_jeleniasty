import path from 'path';
import { OpenAIService } from '../services/OpenAI/OpenAIService';
import { OpenAIModel } from '../services/OpenAI/OpenAIModel';

async function main(){
    const openai = new OpenAIService();
    const answer = openai.analyzeImage(path.join(__dirname, 'mapa.pdf'), {
        model: OpenAIModel.GPT4O,
        prompt: 'What is the name of the city in the image?',
    });
    console.log(answer);
}

main();