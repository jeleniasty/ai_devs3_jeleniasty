import axios from 'axios';
import { OpenAIService } from '../services/OpenAI/OpenAIService';
import { CONFIG } from '../config';

const URL = CONFIG.BASE_URL;
const USERNAME = CONFIG.USERNAME;
const PASSWORD = CONFIG.PASSWORD;

async function getQuestion(): Promise<string> {
    try {
        const response = await axios.get(URL);
        const html = response.data;
        const questionMatch = html.match(/<p id="human-question">Question:<br \/>([^<]+)<\/p>/);

        if (questionMatch && questionMatch[1]) {
            return questionMatch[1].trim();
        } else {
            throw new Error('Question not found in the HTML');
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(`HTTP Error: ${error.message}`);
        }
        throw error;
    }
}

async function login(answer: number) {
    try {
        const formData = new URLSearchParams();
        formData.append('username', USERNAME);
        formData.append('password', PASSWORD);
        formData.append('answer', answer.toString());

        const response = await axios.post(URL,
            formData,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const flagMatch = response.data.match(/{{FLG:[^}]+}}/);
        if (flagMatch) {
            console.log('🤖 Captcha rozwiązana pomyślnie');
            console.log('🤖 Znaleziono flagę:', flagMatch[0]);
        }
        else if (response.data.includes('Anty-human captcha incorrect!')) {
            console.log('🤖 Anty-human captcha incorrect!');
        }

    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`HTTP Error: ${error.message}`);
        }
        throw new Error('Unknown error occurred');
    }
}

async function getNumericAnswer(question: string): Promise<number> {
    const openai = new OpenAIService();

    const systemPrompt = `You are a helpful human-like assistant that answers questions with numbers only. 
Answer in a very short and concise manner. If the answer is not a number, return 0.

Examples:
Q: Rok założenia Facebooka?
A: 2004

Q: Rok lądowania na Księżycu?
A: 1969

Q: Rok powstania ONZ?
A: 1945

Q: Jaki jest kolor nieba?
A: 0

Remember: Only return numbers, no explanations.`;

    return openai.getCompletion<number>(
        [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question }
        ],
        {
            parser: (response: string) => parseInt(response, 10) || 0
        }
    );
}

async function main() {

    try {
        const question = await getQuestion();
        console.log('Question:', question);
        const answer = await getNumericAnswer(question);
        console.log('Answer:', answer);
        await login(answer);
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error('Error:', error.message);
        } else {
            console.error('Unknown error occurred');
        }
    }
}

main();
