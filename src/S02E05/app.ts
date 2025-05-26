import { CONFIG } from '../config';
import axios from 'axios';
import { OpenAIService } from '../services/OpenAI/OpenAIService';
import { HtmlService } from '../services/HtmlService';
import fs from 'fs/promises';
import path from 'path';
import { OpenAIRoles } from '../services/OpenAI/OpenAIRoles';

const outputPath = path.join(process.cwd(), 'src', 'S02E05', 'article.md');

const articleUrl = CONFIG.ARCHIVE_DATA_URL;
const questionsUrl = CONFIG.QUESTIONS_URL;

const htmlService = new HtmlService(articleUrl);
const openai = new OpenAIService();

const systemPrompt = `Odpowiadaj na pytania wyłącznie na podstawie informacji zawartych w przesłanym pliku Markdown (md).
Na każde pytanie odpowiadaj w języku polskim.

Przed udzieleniem każdej odpowiedzi, przeanalizuj uważnie treść md w stylu "chain of thought" – rozpisz krok po kroku proces analizy:

Jakie fragmenty pliku md są istotne dla danego pytania?

Jak wyciągasz właściwą odpowiedź?

Jak oceniasz pewność odpowiedzi?
Cały ten proces analizy zapisz jako wartość w polu "thinking" dla każdego pytania.

Każda odpowiedź musi zawierać dokładnie dwa klucze:

"answer": bardzo krótka odpowiedź w 1 zdaniu

"thinking": szczegółowy opis procesu myślenia, krok po kroku, prowadzący do odpowiedzi

Format pytań to jeden string, gdzie każda linia ma postać:
01=treść pytania

WAŻNE: Twoja odpowiedź musi być CZYSTYM JSONEM, bez żadnych dodatkowych znaków, backticków ani formatowania markdown.
NIE używaj znaczników \`\`\`json ani żadnych innych znaczników formatowania.
Zwróć SAM JSON, nic więcej.

Przykład poprawnej odpowiedzi (zwróć dokładnie w tym formacie, bez żadnych dodatkowych znaków):

{
  "01": {
    "answer": "krótka odpowiedź w 1 zdaniu",
    "thinking": "szczegółowa analiza chain of thought: jak szukałeś, które fragmenty pliku md wykorzystałeś, jak rozumowałeś, czy masz pewność odpowiedzi itd."
  },
  "02": {
    "answer": "krótka odpowiedź w 1 zdaniu",
    "thinking": "szczegółowa analiza chain of thought"
  }
}

Jeżeli nie znajdujesz odpowiedzi w pliku md, odpowiedz na pytanie używając swojej własnej wiedzy.

PAMIĘTAJ: Zwróć SAM JSON, bez żadnych dodatkowych znaków, backticków ani formatowania markdown.`

async function getTransformedHtml() {
    try {
        await fs.access(outputPath);
        console.log('Article already exists, reading from file');
        return await fs.readFile(outputPath, 'utf-8');
    } catch {
        const articleResponse = await axios.get(articleUrl);
        const articleHtml = articleResponse.data;

        const processedHtml = await htmlService.replaceAudioWithTranscriptions(articleHtml);
        const processedHtmlWithImages = await htmlService.replaceImagesWithDescriptions(processedHtml);
        const articleText = await htmlService.transformHtmlToMarkdown(processedHtmlWithImages);

        await fs.writeFile(outputPath, articleText, 'utf-8');
        return articleText;
    }
}

async function main() {
    const html = await getTransformedHtml();

    const questionsResponse = await axios.get(questionsUrl);
    const questionsString = questionsResponse.data;
    const messages = [
        { role: OpenAIRoles.SYSTEM, content: systemPrompt },
        { role: OpenAIRoles.USER, content: `Article content:\n${html}\n\nQuestions:\n${questionsString}` }
    ];

    const answers = await openai.getCompletion(messages, {
        parser: (response) => JSON.parse(response)
    });
    console.log('Raw answers:', answers);

    const formattedAnswers = {
        task: "arxiv",
        apikey: process.env.C3NTRALA_KEY,
        answer: Object.keys(answers).reduce((acc, key) => {
            acc[key] = answers[key].answer;
            return acc;
        }, {} as { [key: string]: string })
    };

    console.log('Formatted answers:', JSON.stringify(formattedAnswers, null, 2));
    const response = await axios.post(CONFIG.REPORT_URL, formattedAnswers);
    console.log('API Response:', response.data);
}

main();