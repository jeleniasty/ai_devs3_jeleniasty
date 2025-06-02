import * as dotenv from 'dotenv'
import { CONFIG } from '../config'
import axios from 'axios'
import { OpenAIService } from '../services/OpenAIService'
import { OpenAIRoles } from '../enums/OpenAIRoles'
import * as fs from 'fs'
import * as path from 'path'
import { Neo4jService } from '../services/Neo4jService'

dotenv.config()

const dbURL = CONFIG.DB_API_URL;
const apiKey = process.env.C3NTRALA_KEY;

const connectionsTable = "connections";
const correct_orderTable = "correct_order";
const datacentersTable = "datacenters";
const usersTable = "users";

const openai = new OpenAIService();
const neo4j = new Neo4jService({
    url: 'bolt://localhost:7687',
    username: 'neo4j',
    password: 'password123'
});

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

async function createNeo4jGraph(users: User[], connections: Connection[]): Promise<void> {
    try {
        for (const user of users) {
            await neo4j.createNode('User', {
                user_id: user.id,
                username: user.username,
                access_level: user.access_level,
                is_active: user.is_active,
                lastlog: user.lastlog
            });
        }
        console.log('Created user nodes');

        for (const connection of connections) {
            await neo4j.createOneWayRelationship(
                'User',
                { user_id: connection.user1_id },
                'CONNECTS_TO',
                'User',
                { user_id: connection.user2_id }
            );
        }
        console.log('Created user connections');
    } catch (error) {
        console.error('Error creating Neo4j graph:', error);
        throw error;
    }
}

async function findShortestPath(): Promise<string> {
    try {
        const results = await neo4j.query(`
            MATCH (a:User {username: 'Rafał'}), (b:User {username: 'Barbara'})
            MATCH p = shortestPath((a)-[:CONNECTS_TO*]->(b))
            WITH [node in nodes(p) | node.username] as usernames
            RETURN reduce(s = '', x IN usernames | s + CASE WHEN s = '' THEN x ELSE ',' + x END) as path
        `);

        if (results.length === 0) {
            throw new Error('No path found between Rafał and Barbara');
        }

        return results[0].path;
    } catch (error) {
        console.error('Error finding shortest path:', error);
        throw error;
    }
}

async function main() {
    let path: string;
    try {
        const { users, connections } = await fetchAndStoreData();
        await createNeo4jGraph(users, connections);
        path = await findShortestPath();
        console.log(path);

        const answer = {
            task: 'connections',
            apikey: process.env.C3NTRALA_KEY,
            answer: path
        };

        const response = await axios.post(CONFIG.REPORT_URL, answer);
        console.log('Report response:', response.data.message);
    } catch (error) {
        console.error('Error in main:', error);
        throw error;
    } finally {
        await neo4j.close();
    }
}

main();
