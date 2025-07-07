import { CONFIG } from '../config';
import { PdfProcessor } from './PdfProcessor';
import { OpenAIService } from '../services/OpenAIService';
import axios from 'axios';
import { CentralaService } from '../services/CentralaService';
import { response } from 'express';

const pdfProcessor = new PdfProcessor();
const openai = new OpenAIService();
const centrala = new CentralaService();


async function callApi(questions: Record<string, string>): Promise<{ status: string, message: string }> {
    try {
        const response = await centrala.callReport('notes', questions);
        if (response && response.data && typeof response.data.message === 'string') {
            return { status: 'ok', message: response.data.message };
        }
        return { status: 'ok', message: JSON.stringify(response.data) };
    } catch (error: any) {
        if (error.response && error.response.status === 400) {
            const hint = error.response.data.hint;
            console.log('Hint: ' + hint);
            return { status: 'error', message: hint };
        } else {
            console.error('An error occurred:', error);
            return { status: 'error', message: String(error) };
        }
    }
}

async function main() {
    const text = await pdfProcessor.process();
 
    const questions = await axios.get(CONFIG.QUESTION_LIST_URL);
    console.log(questions.data);

    const answer = callApi(questions.data);
}

main();