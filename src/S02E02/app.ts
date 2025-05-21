import fs from 'fs';
import path from 'path';
import { OpenAIService } from '../services/OpenAI/OpenAIService';

async function main(){
    const openai = new OpenAIService();
    const answer = openai.analyzeImage(path.join(__dirname, 'mapa.pdf'));
}

main();