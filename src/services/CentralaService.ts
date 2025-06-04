import { CONFIG } from '../config'
import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config();

export class CentralaService {
    private apiKey: string;

    constructor() {
        const apiKey = process.env.C3NTRALA_KEY;
        if (!apiKey) {
            throw new Error('C3NTRALA_KEY is not defined in environment variables');
        }
        this.apiKey = apiKey;
    }

    async callReport(answer: string) {
        const body = {
            task: "photos",
            apikey: this.apiKey,
            answer: answer
        }
        const response = await axios.post(CONFIG.REPORT_URL, body);
        return response.data.message;
    }
}
