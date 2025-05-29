import { CONFIG } from '../config';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { OpenAIService } from '../services/OpenAIService';
import { QdrantService } from '../services/QdrantService';
import axios from 'axios';

const CURRENT_DIR = path.join(process.cwd(), 'src', 'S03E02');
const COLLECTION_NAME = 'aidevs'

const openai = new OpenAIService();
const qdrant = new QdrantService({
    url: "http://localhost:6333",
    generateEmbedding: (text) => openai.generateEmbedding(text)
});

async function main() {

    qdrant.createCollection(COLLECTION_NAME, 3072);

    const weaponsDir = path.join(CURRENT_DIR, 'extracted', 'weapons_tests', 'do-not-share');
    const files = await fs.promises.readdir(weaponsDir);
    const txtFiles = files.filter(file => file.endsWith('.txt'));

    for (const file of txtFiles) {
        const filePath = path.join(weaponsDir, file);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        console.log(`Upserting points for file: ${file}`);

        await qdrant.upsertPoints(COLLECTION_NAME, [{
            id: crypto.randomUUID(),
            text: content,
            metadata: {
                filename: file,
                text: content,
                timestamp: new Date().toISOString()
            }
        }]);
    }

    const response = qdrant.search(COLLECTION_NAME, `W raporcie, z którego dnia znajduje się wzmianka o kradzieży prototypu broni?`);

    const searchResult = await response;
    if (searchResult && searchResult.length > 0 && searchResult[0].payload) {
        const filename = searchResult[0].payload.filename as string;
        const dateMatch = filename.match(/(\d{4}_\d{2}_\d{2})/);
        if (dateMatch) {
            const date = dateMatch[1].replace(/_/g, '-');
            console.log('Found date:', date);
            
            if (date) {
                const answer = {
                    task: 'wektory',
                    apikey: process.env.C3NTRALA_KEY,
                    answer: date
                };
        
                const response = await axios.post(CONFIG.REPORT_URL, answer);
                console.log('Report response:', response.data.message);
            }
        }
    }
}

main().catch(console.log);