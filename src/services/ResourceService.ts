import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

export class ResourceService {
    private readonly extractDir: string;
    private readonly tempDir: string;

    constructor(currentDir: string) {
        this.extractDir = path.join(currentDir, 'extracted');
        this.tempDir = path.join(currentDir, 'temp');
    }

    async downloadAndExtractZip(url: string, zipFileName: string): Promise<void> {
        try {
            if (fs.existsSync(this.extractDir) && fs.readdirSync(this.extractDir).length > 0) {
                console.log('Files already extracted, skipping download and extraction');
                return;
            }

            if (!fs.existsSync(this.tempDir)) {
                fs.mkdirSync(this.tempDir);
            }

            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'arraybuffer'
            });

            const zipPath = path.join(this.tempDir, zipFileName);
            fs.writeFileSync(zipPath, response.data);

            const zip = new AdmZip(zipPath);
            
            if (!fs.existsSync(this.extractDir)) {
                fs.mkdirSync(this.extractDir);
            }

            zip.extractAllTo(this.extractDir, true);

            fs.rmSync(this.tempDir, { recursive: true, force: true });

            console.log('Files extracted successfully');
        } catch (error) {
            console.error('Error downloading or extracting zip:', error);
            throw error;
        }
    }
}
