import { CONFIG } from '../config';
import { PdfProcessor } from './PdfProcessor';
import { OpenAIService } from '../services/OpenAIService';
import axios from 'axios';
import { CentralaService } from '../services/CentralaService';
import { OpenAIRoles } from '../enums/OpenAIRoles';
import * as fs from 'fs';
import * as path from 'path';

const pdfProcessor = new PdfProcessor();
const openai = new OpenAIService();
const centrala = new CentralaService();

const hintsPath = path.join(process.cwd(), 'src', 'S04E05', 'hints.json');
const wrongAnswersPath = path.join(process.cwd(), 'src', 'S04E05', 'wrong_answers.json');

const text = pdfProcessor.process();


async function callReport(questions: Record<string, string>): Promise<{ status: string, message: string }> {
    try {
        const response = await centrala.callReport('notes', questions);
        return { status: 'ok', message: response.data };
    } catch (error: any) {
        if (error.response && error.response.status === 400) {
            const match = error.response.data.message.match(/0\d/);
            const hint = error.response.data.hint;

            const message = match + ':' + hint;
            return { status: 'error', message: message };
        } else {
            console.error('An error occurred:', error);
            return { status: 'error', message: String(error) };
        }
    }
}

function prepareContext(
    question: string,
    hint?: string,
    wrongAnswers?: string[]
): string {
    let context = `
You are an advanced language model tasked with analyzing a provided text and answering a specific question about it.
Sometimes, the answer is not stated directly and must be deduced (for example, inferring a date based on a historical event).
You may also receive hint or a list of wrong answers to avoid in answer.

## Instructions
- **Thoroughly analyze** the provided text in relation to the question.
- If the answer is not directly stated, **use logical reasoning and deduction** to infer the correct answer.
- If hint or known wrong answers are provided, **use them to guide your reasoning** and avoid incorrect conclusions.
- **Use a clear chain of thought** to document your reasoning process.
- NEVER return answer that is included in Wrong Answers list.

## Response Format
Return your response as a JSON object with two keys:
- _thoughts: A detailed, step-by-step explanation of your reasoning and how you arrived at the answer.
- answer: A concise and direct answer to the question.
NEVER add additional text or special characters to output (except valid json).

### Example Output
{
  "_thoughts": "Step-by-step reasoning here, explaining how the answer was determined, including any deductions, use of hints, or elimination of wrong answers.",
  "answer": "Your final concise answer here."
}

## Guidelines
- Ensure your reasoning is **clear, logical, and references information from the text**.
- If deduction is required, **clearly show the steps taken**.
- If hints or wrong answers are provided, **explicitly use them in your reasoning**.
- The final answer must be **concise and directly address the question**.
`;

    if (hint && hint.trim().length > 0) {
        context += `\n## Hint:\n${hint}\n`;
    }

    if (wrongAnswers && Array.isArray(wrongAnswers) && wrongAnswers.length > 0) {
        context += `\n## Wrong Answers:\n${wrongAnswers.join('; ')}\n`;
    }

    context += `\n## Question:\n${question}\n`;
    context += `\n## Text to analyse:\n${text}\n`;

    return context;
}

async function askLLM(question: string, context: string): Promise<string> {    
    return openai.getCompletion([
        { role: OpenAIRoles.SYSTEM, content: context },
        { role: OpenAIRoles.USER, content: question }]);
}

async function main() {
    const text = await pdfProcessor.process();

    const response = await axios.get(CONFIG.QUESTION_LIST_URL);
    const questions = response.data;
    console.log(questions);

    const answers: Record<string, string> = {};

    if (!fs.existsSync(hintsPath)) {
        fs.writeFileSync(hintsPath, JSON.stringify({}, null, 2), 'utf-8');
    }
    let hints: Record<string, string> = JSON.parse(fs.readFileSync(hintsPath, 'utf-8'));

 
    if (!fs.existsSync(wrongAnswersPath)) {
        fs.writeFileSync(wrongAnswersPath, JSON.stringify({}, null, 2), 'utf-8');
    }
    let wrongAnswers: Record<string, string[]> = JSON.parse(fs.readFileSync(wrongAnswersPath, 'utf-8'));

    for (const [key, value] of Object.entries(questions)) { 
        const context = prepareContext(questions[key], hints[key], wrongAnswers[key])
        console.log('Context: ' + context);
        answers[key] = await askLLM(value as string, context);
        console.log('LLM answer: ' + answers[key]);
    }

    let answer = await callReport(answers);

    while (answer.status === 'error') {
        const key = answer.message.substring(0, answer.message.indexOf(':'));
        const hint = answer.message.substring(answer.message.indexOf(':') + 1);
        console.log('Current hint: ' + hint);

        if (!hints[key]) {
            hints[key] = hint;
            fs.writeFileSync(hintsPath, JSON.stringify(hints, null, 2), 'utf-8');
        }

        if (!wrongAnswers[key]) {
            wrongAnswers[key] = [];
        }
        wrongAnswers[key].push(answers[key]);
        fs.writeFileSync(wrongAnswersPath, JSON.stringify(wrongAnswers, null, 2), 'utf-8');

        const context = prepareContext(questions[key], hints[key], wrongAnswers[key])
        console.log('Context: ' + context);
 
        answers[key] = await askLLM(questions[key], context);
        console.log('LLM answer: ' + answers[key]);
        
        answer = await callReport(answers);
        console.log(answer.message);
    }
    console.log(answer);
}

main();