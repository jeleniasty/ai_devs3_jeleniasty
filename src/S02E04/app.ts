import { CONFIG } from '../config';
import { ResourceService } from '../services/ResourceService';
import * as path from 'path';

const CURRENT_DIR = path.join(process.cwd(), 'src', 'S02E04');
const resourceService = new ResourceService(CURRENT_DIR);

async function main() {
    await resourceService.downloadAndExtractZip(CONFIG.WAREHOUSE_DATA_URL, 'warehouse_data.zip');
}

main().catch(console.error);
