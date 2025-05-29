import axios from "axios";
import { OpenAIService } from "../services/OpenAIService";
import { OpenAIModel } from "../enums/OpenAIModel";
import { CONFIG } from '../config';

const DATA_URL = CONFIG.CENZURA_DATA_URL;
const REPORT_URL = CONFIG.REPORT_URL;
const systemPrompt = `You are a censor. Your task is to censor the personal data from the text.

Rules:
- Censor ALL personal data from the text.
- Personal data includes:
    - First name and last name
    - Address including city, street name and number
    - Age
- Do not add any explanations.
- Do not add any other text than the censored text.
- Change all personal data to the word "CENZURA".
- First name and last name should be censored together.
- Street name and number should be censored together.
- In age censor only digits.  

Example:
Input: Podejrzany Krawczyk Karol zamieszkały w ulicy Głównej 123 w mieście Kraków. Ma 30 lat.
Output: Podejrzany CENZURA zamieszkały w ulicy CENZURA w mieście CENZURA. Ma CENZURA lat.
`;

const openai = new OpenAIService();

async function main() {
    const originalText = await axios.get(DATA_URL);

    console.log('Original text:')
    console.log(originalText.data);

    const redactedText = await openai.getCompletion([{role: 'system', content: systemPrompt}, {role: 'user', content: originalText.data}]);
    console.log('Redacted text:')
    console.log(redactedText);

    const reportResponse = await axios.post(
        REPORT_URL, {
        task: 'CENZURA',
        apikey: process.env.C3NTRALA_KEY,
        answer: redactedText
    });

    console.log('Report response:')
    console.log(reportResponse);
}

main();
