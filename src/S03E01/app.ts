import { ResourceService } from '../services/ResourceService';
import { CONFIG } from '../config';

const resourceService = new ResourceService(__dirname);

async function main() {

        const extractedDir = await resourceService.downloadAndExtractZip(
            CONFIG.FACTORY_DATA_URL,
            'factory_data.zip');
 
}

main();
