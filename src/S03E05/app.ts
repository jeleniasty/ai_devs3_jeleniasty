import * as dotenv from 'dotenv'
import { CONFIG } from '../config'
import axios from 'axios'
import { OpenAIService } from '../services/OpenAIService'
import { OpenAIRoles } from '../enums/OpenAIRoles'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config()

const dbURL = CONFIG.DB_API_URL;
const apiKey = process.env.C3NTRALA_KEY;

const connectionsTable = "connections";
const correct_orderTable = "correct_order";
const datacentersTable = "datacenters";
const usersTable = "users";

const openai = new OpenAIService();

interface User {
    id: number;
    username: string;
    access_level: string;
    is_active: number;
    lastlog: string | null;
}

interface Connection {
    user1_id: number;
    user2_id: number;
}

async function queryDb(query: string): Promise<any[]> {
    const dbQuery = {
        task: "database",
        apikey: apiKey,
        query: query
    }
    const response = await axios.post(dbURL, dbQuery);
    if (!response.data || !response.data.reply) {
        throw new Error('Invalid response from database API');
    }
    return response.data.reply;
}

async function fetchAndStoreData() {
    try {
        const targetDir = path.join(process.cwd(), 'src', 'S03E05', 'extracted');
        
        // Create extracted directory if it doesn't exist
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const usersFilePath = path.join(targetDir, 'users.json');
        const connectionsFilePath = path.join(targetDir, 'connections.json');

        if (fs.existsSync(usersFilePath) && fs.existsSync(connectionsFilePath)) {
            console.log('Files already exist, loading from disk...');
            const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf-8')) as User[];
            const connections = JSON.parse(fs.readFileSync(connectionsFilePath, 'utf-8')) as Connection[];
            return { users, connections };
        }

        const usersQuery = `SELECT id, username, access_level, is_active, lastlog FROM ${usersTable}`;
        const usersData = await queryDb(usersQuery);
        if (!Array.isArray(usersData)) {
            throw new Error('Users data is not an array');
        }
        const users: User[] = usersData.map((row: any) => ({
            id: row.id,
            username: row.username,
            access_level: row.access_level,
            is_active: row.is_active,
            lastlog: row.lastlog
        }));

        const connectionsQuery = `SELECT user1_id, user2_id FROM ${connectionsTable}`;
        const connectionsData = await queryDb(connectionsQuery);

        const connections: Connection[] = connectionsData.map((row: any) => ({
            user1_id: row.user1_id,
            user2_id: row.user2_id
        }));

        if (!fs.existsSync(usersFilePath)) {
            fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
            console.log('Users data saved to:', usersFilePath);
        }

        if (!fs.existsSync(connectionsFilePath)) {
            fs.writeFileSync(connectionsFilePath, JSON.stringify(connections, null, 2));
            console.log('Connections data saved to:', connectionsFilePath);
        }

        console.log(`Users count: ${users.length}`);
        console.log(`Connections count: ${connections.length}`);

        return { users, connections };
    } catch (error) {
        console.error('Error fetching or storing data:', error);
        throw error;
    }
}

async function main() {
    try {
        const { users, connections } = await fetchAndStoreData();
        
        // Log some sample data
        console.log('\nSample users:');
        console.log(users.slice(0, 5));
        
        console.log('\nSample connections:');
        console.log(connections.slice(0, 5));
    } catch (error) {
        console.error('Error in main:', error);
    }
}

main();
