import { CONFIG } from '../config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

async function downloadAndExtractZip() {
    try {
        const extractDir = path.join(process.cwd(), 'src', 'S02E01', 'extracted');
        
        if (fs.existsSync(extractDir) && fs.readdirSync(extractDir).length > 0) {
            console.log('Files already extracted, skipping download and extraction');
            return;
        }

        const tempDir = path.join(process.cwd(), 'src', 'S02E01', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        const response = await axios({
            method: 'GET',
            url: CONFIG.DATA_URL,
            responseType: 'arraybuffer'
        });

        const zipPath = path.join(tempDir, 'przesluchania.zip');
        fs.writeFileSync(zipPath, response.data);

        const zip = new AdmZip(zipPath);
        
        if (!fs.existsSync(extractDir)) {
            fs.mkdirSync(extractDir);
        }

        zip.extractAllTo(extractDir, true);

        fs.rmSync(tempDir, { recursive: true, force: true });

        console.log('Files extracted successfully');
    } catch (error) {
        console.error('Error downloading or extracting zip:', error);
    }
}

downloadAndExtractZip();
