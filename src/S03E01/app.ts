import { ResourceService } from '../services/ResourceService';
import { CONFIG } from '../config';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { OpenAIRoles } from '../services/OpenAI/OpenAIRoles';
import { OpenAIService } from '../services/OpenAI/OpenAIService';

const CURRENT_DIR = path.join(process.cwd(), 'src', 'S03E01');
const resourceService = new ResourceService(CURRENT_DIR);
const openai = new OpenAIService();

const systemPrompt = `Wyciągnij wszystkie najważniejsze i charakterystyczne informacje z podanego tekstu i wygeneruj listę słów kluczowych.

Zasady:

1. Słowa kluczowe muszą być w języku polskim.
2. Słowa kluczowe muszą być w mianowniku liczby pojedynczej (np. "raport", "analiza", "firma", a nie "raportu", "analizy", "firmy").
3. Słowa powinny być oddzielone przecinkami, bez spacji (np. słowo1,słowo2,słowo3).
4. Liczba słów kluczowych powinna być odpowiednia do zawartości raportu.
5. Odpowiedz wyłącznie listą słów kluczowych, bez dodatkowych komentarzy.
6. Słowa kluczowe w liście muszą być unikalne.
7. Koniecznie zachowaj pełną semantykę słów kluczowych (np. "Sektor A", a nie "sektor").
8. Teksty mają charakter wojskowy, futurystyczny.
9. Unikaj ogólnych słów jako słów kluczowych. Wybieraj jak najbardziej unikalne i specyficzne słowa dla danego tekstu.`

async function generateFactsMetadata(factsFiles: string[]) {
    const outputDir = path.join(CURRENT_DIR, 'output');
    if (fs.existsSync(outputDir)) {
        console.log('Output directory already exists, skipping generation');
        return;
    }
    for (const file of factsFiles) {
        const fileContent = fs.readFileSync(file, 'utf-8');
        const answer = openai.getCompletion([{ role: OpenAIRoles.SYSTEM, content: systemPrompt }, { role: OpenAIRoles.USER, content: fileContent }]);

        const result = await answer;
        const metadata = {
            uuid: crypto.randomUUID(),
            filename: path.basename(file),
            keywords: result
        };

        const data = {
            text: fileContent,
            metadata
        };

        const outputPath = path.join(outputDir, `${metadata.filename}.json`);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
        console.log('Saved file to:', outputPath);
    }
}

async function main() {
    const extractedDirectory = await resourceService.downloadAndExtractZip(CONFIG.WAREHOUSE_DATA_URL, 'warehouse_data.zip');
    const factsFiles = await resourceService.getFilesWithExtensions(['.txt'], path.join(extractedDirectory, 'facts'));

    generateFactsMetadata(factsFiles);

    const reportFiles = await resourceService.getFilesWithExtensions(['.txt'], extractedDirectory);
    
    //Dla każdego raportu:
    // - Wygeneruj wstępne słowa kluczowe na podstawie jego treści i nazwy pliku.
    // - Zidentyfikuj osoby/miejsca wspomniane w raporcie.
    // - Dobierz pasujące "fakty" (np. dotyczące tych samych osób).
    // - Połącz słowa kluczowe z raportu ze słowami kluczowymi wynikającymi z powiązanych faktów.



    // const files = [...factsFiles, ...reportFiles];
    // console.log('Found files:', files);


}

main();
