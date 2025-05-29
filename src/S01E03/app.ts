import { OpenAIService } from '../services/OpenAIService';
import { OpenAIModel } from '../enums/OpenAIModel';
import axios from 'axios';
import dotenv from 'dotenv';
import { CONFIG } from '../config';

dotenv.config();

const DATA_URL = CONFIG.JSON_DATA_URL;
const REPORT_URL = CONFIG.REPORT_URL;

const systemPrompt = `You are a concise answer bot. Your task is to provide extremely short, direct answers. Rules:
1. Use as few words as possible
2. No explanations or context
3. No greetings or pleasantries
4. Just the essential answer
5. No punctuation unless necessary`;

function calculateExpression(expression: string): number {
    const cleanExpr = expression.replace(/\s+/g, '');
    const parts = cleanExpr.split(/([+\-*/])/);
    
    const numbers = parts.filter(part => !['+', '-', '*', '/'].includes(part)).map(Number);
    const operators = parts.filter(part => ['+', '-', '*', '/'].includes(part));
    
    let result = numbers[0];
    for (let i = 0; i < operators.length; i++) {
        switch (operators[i]) {
            case '+': result += numbers[i + 1]; break;
            case '-': result -= numbers[i + 1]; break;
            case '*': result *= numbers[i + 1]; break;
            case '/': result /= numbers[i + 1]; break;
        }
    }
    return result;
}

async function main() {
    const openai = new OpenAIService();
    const response = await axios.get(DATA_URL);
    const jsonData = response.data;
    console.log(jsonData);
    jsonData.apikey = process.env.C3NTRALA_KEY;

    const testData = jsonData['test-data'];
    for (const element of testData) {
        const question = element.question;
        const calculatedAnswer = calculateExpression(question);
        element.answer = calculatedAnswer;
        
        if (element.test) {
            const question = element.test.q;

            console.log(`Question: ${question}`);
            const answer = await openai.getCompletion([{role: 'system', content: systemPrompt}, {role: 'user', content: question}]);
            console.log(`Answer: ${answer}`);
            element.test.a = answer;
        }
    }

    const reportData = {
        task: "JSON",
        apikey: process.env.C3NTRALA_KEY,
        answer: jsonData
    };

    const reportResponse = await axios.post(REPORT_URL, reportData);
    console.log(reportResponse.data);
}

main();