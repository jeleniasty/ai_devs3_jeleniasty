import { CONFIG } from '../config';
import { ResourceService } from '../services/ResourceService';
import * as path from 'path';

const CURRENT_DIR = path.join(process.cwd(), 'src', 'S02E04');
const resourceService = new ResourceService(CURRENT_DIR);

async function main() {
    const extractedDirectory = await resourceService.downloadAndExtractZip(CONFIG.WAREHOUSE_DATA_URL, 'warehouse_data.zip');
    const files = await resourceService.getFilesWithExtensions(['.txt', '.png', '.mp3'], extractedDirectory);

    const txtFiles: string[] = [];
    const pngFiles: string[] = [];
    const mp3Files: string[] = [];

    for (const file of files) {
        console.log(`Processing file: ${file}`);
        const filePath = path.join(extractedDirectory, file);
        const ext = path.extname(file).toLowerCase();
        
        switch (ext) {
            case '.txt':
                txtFiles.push(filePath);
                break;
            case '.png':
                pngFiles.push(filePath);
                break;
            case '.mp3':
                mp3Files.push(filePath);
                break;
        }
    }

    console.log('\nText files:', txtFiles);
    console.log('\nImage files:', pngFiles);
    console.log('\nAudio files:', mp3Files);
}

main();
