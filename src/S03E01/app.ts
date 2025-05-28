import { ResourceService } from '../services/ResourceService';
import { CONFIG } from '../config';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { OpenAIRoles } from '../services/OpenAI/OpenAIRoles';
import { OpenAIService } from '../services/OpenAI/OpenAIService';
import axios from 'axios';

const CURRENT_DIR = path.join(process.cwd(), 'src', 'S03E01');
const factsFilename = 'facts_metadata.json';
const reportsFilename = 'reports_metadata.json'

const resourceService = new ResourceService(CURRENT_DIR);
const openai = new OpenAIService();

const systemPrompt = `Wyciągnij wszystkie najważniejsze i charakterystyczne informacje z podanego tekstu i wygeneruj listę słów kluczowych.

Zasady:

1. Słowa kluczowe muszą być w języku polskim.
2. Słowa kluczowe muszą być w mianowniku liczby pojedynczej (np. "raport", "analiza", "firma", a nie "raportu", "analizy", "firmy").
3. Słowa powinny być oddzielone przecinkami, bez spacji (np. słowo1,słowo2,słowo3).
4. Odpowiedz wyłącznie listą słów kluczowych, bez dodatkowych komentarzy.
5. Słowa kluczowe w liście muszą być unikalne.
6. Koniecznie zachowaj pełną semantykę słów kluczowych (np. "Sektor A", a nie "sektor").
7. Teksty mają charakter wojskowy, futurystyczny.
8. Unikaj ogólnych słów jako słów kluczowych. Wybieraj jak najbardziej unikalne i specyficzne słowa dla danego tekstu.
9. Zwróć szczególną uwagę na osoby, miejsca, zawody osób i ich specjalne umiejętności wymienione w tekście.
10. Weź pod uwagę nazwy plików. Mogą one zawierać wartościowe informacje.
11. KAŻDY analizowany plik MUSI mieć wygenerowane słowa kluczowe. Nie pomijaj żadnego pliku.
12. Jeśli tekst jest krótki lub pozornie mało informacyjny, postaraj się wyciągnąć z niego jak najwięcej istotnych słów kluczowych.
13. Konkretność: Staraj się, aby słowa kluczowe były jak najbardziej specyficzne dla danego raportu i powiązanych faktów.
14. Nazwiska i imiona: Uwzględnij je jako słowa kluczowe, jeśli są istotne dla kontekstu (np. "Adam Gospodarczyk", "Barbara Zawadzka")
15. BARDZO WAŻNE są zawody wspomnianych w tekście osób. Koniecznie dodaj je do słów kluczowych.

Przykład:
- Jeśli raport wspomina o "dzikiej faunie", "zwierzynie leśnej" lub "wildlife", system walidujący prawdopodobnie oczekuje ogólniejszego słowa kluczowego, np. "zwierzęta".`

const comparisonPrompt = `Przeanalizuj metadane raportu i listę dostępnych faktów. Wybierz najlepiej pasujący fakt do raportu na podstawie słów kluczowych i kontekstu.

WAŻNE:
1. KAŻDY raport MUSI mieć przypisany fakt - nie pomijaj żadnego raportu!
2. Jeśli nie ma idealnego dopasowania, wybierz fakt, który ma najwięcej wspólnych elementów z raportem.
3. Nawet jeśli dopasowanie nie jest idealne, zawsze wybierz najlepszy dostępny fakt.
4. Jeden fakt może być przypisany do wielu raportów - wybieraj najlepsze dopasowanie niezależnie od wcześniejszych przypisań.
5. ZAWSZE najpierw próbuj połączyć fakty do danego raportu za pomocą osób które w nich występują - jeśli w raporcie jest mowa o konkretnej osobie, wybierz fakt który jest bezpośrednio z nią związany.

Odpowiedz wyłącznie nazwą pliku wybranego faktu (np. "f01.txt").`

interface KeywordMatch {
    factFilename: string;
    combinedKeywords: string[];
}

interface ReportMatches {
    [key: string]: KeywordMatch;
}

interface FactMetadata {
    uuid: string;
    filename: string;
    keywords: string;
    text: string;
}

async function generateMetadata(facts: string[], filename: string) {
    const outputDir = path.join(CURRENT_DIR, 'output');
    const outputPath = path.join(outputDir, filename);

    if (fs.existsSync(outputPath)) {
        console.log(`File ${filename} already exists, skipping generation`);
        return;
    }

    const allMetadata = [];

    for (const file of facts) {
        const fileContent = fs.readFileSync(file, 'utf-8');
        const answer = openai.getCompletion([
            { role: OpenAIRoles.SYSTEM, content: systemPrompt },
            { role: OpenAIRoles.USER, content: `Nazwa pliku: ${path.basename(file)}\n\nTreść:\n${fileContent}` }
        ]);

        const result = await answer;
        const metadata = {
            uuid: crypto.randomUUID(),
            filename: path.basename(file),
            keywords: result,
            text: fileContent
        };

        allMetadata.push(metadata);
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(allMetadata, null, 2));
    console.log('Saved all metadata to:', outputPath);
}

async function compareKeywordsAndGenerateReport() {
    const outputDir = path.join(CURRENT_DIR, 'output');
    const factsPath = path.join(outputDir, factsFilename);
    const reportsPath = path.join(outputDir, reportsFilename);
    const outputPath = path.join(outputDir, 'keyword_matches.json');

    if (fs.existsSync(outputPath)) {
        console.log('Keyword matches file already exists, loading from file');
        return JSON.parse(fs.readFileSync(outputPath, 'utf-8')) as ReportMatches;
    }

    if (!fs.existsSync(factsPath) || !fs.existsSync(reportsPath)) {
        console.log('Metadata files not found. Please run generateMetadata first.');
        return null;
    }

    const factsMetadata: FactMetadata[] = JSON.parse(fs.readFileSync(factsPath, 'utf-8'));
    const reportsMetadata: FactMetadata[] = JSON.parse(fs.readFileSync(reportsPath, 'utf-8'));
    const reportMatches: ReportMatches = {};

    for (const report of reportsMetadata) {
        const prompt = `Raport:
Nazwa pliku: ${report.filename}
Słowa kluczowe: ${report.keywords}

Dostępne fakty:
${factsMetadata.map((fact: FactMetadata) => 
    `Nazwa pliku: ${fact.filename}
Słowa kluczowe: ${fact.keywords}
---`
).join('\n\n')}`;

        const answer = await openai.getCompletion([
            { role: OpenAIRoles.SYSTEM, content: comparisonPrompt },
            { role: OpenAIRoles.USER, content: prompt }
        ]);

        const selectedFactFilename = (await answer as string).trim();
        const selectedFact = factsMetadata.find((f: FactMetadata) => f.filename === selectedFactFilename);
        
        if (selectedFact) {
            reportMatches[report.filename] = {
                factFilename: selectedFact.filename,
                combinedKeywords: [...new Set([...report.keywords.split(','), ...selectedFact.keywords.split(',')])]
            };
        }
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(reportMatches, null, 2));
    console.log('Saved keyword matches to:', outputPath);

    return reportMatches;
}

async function main() {
    const extractedDirectory = await resourceService.downloadAndExtractZip(CONFIG.WAREHOUSE_DATA_URL, 'warehouse_data.zip');
    const factsFiles = await resourceService.getFilesWithExtensions(['.txt'], path.join(extractedDirectory, 'facts'));
    await generateMetadata(factsFiles, factsFilename);

    const reportFiles = await resourceService.getFilesWithExtensions(['.txt'], extractedDirectory);
    await generateMetadata(reportFiles, reportsFilename);

    const reportMatches = await compareKeywordsAndGenerateReport();

    console.table(reportMatches);

    if (reportMatches) {
        const answer = {
            task: 'dokumenty',
            apikey: process.env.C3NTRALA_KEY,
            answer: Object.entries(reportMatches).reduce((acc, [reportFilename, match]) => ({
                ...acc,
                [reportFilename]: match.combinedKeywords.join(',')
            }), {})
        };

        const response = await axios.post(CONFIG.REPORT_URL, answer);
        console.log('Report response:', response.data.message);
    }

}

main();
