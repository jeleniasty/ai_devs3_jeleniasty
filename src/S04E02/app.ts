import { ResourceService } from '../services/ResourceService';
import path from 'path';
import { CONFIG } from '../config';

const resourceService = new ResourceService(path.join(process.cwd(), 'src', 'S04E02'));

async function main() {
    const extractedDirectory = await resourceService.downloadAndExtractZip(CONFIG.LAB_DATA_URL, 'lab_data.zip')

    
}

main();