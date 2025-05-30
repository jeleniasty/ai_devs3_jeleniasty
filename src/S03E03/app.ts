import { CONFIG } from '../config'
import axios from 'axios'
import * as dotenv from 'dotenv'
import { OpenAIService } from '../services/OpenAIService'
import { OpenAIRoles } from '../enums/OpenAIRoles'

dotenv.config()

const dbURL = CONFIG.DB_API_URL;
const apiKey = process.env.C3NTRALA_KEY;

const openai = new OpenAIService();

const systemPrompt = `You are a SQL expert. Your task is to generate SQL queries based on the provided table structure.

Rules:
1. Analyze the table structure carefully before generating any query
2. Generate only valid SQL queries that will work with the provided schema
3. Consider using JOINs when appropriate to connect related tables
4. Use proper SQL syntax and formatting
5. CRITICAL: Return ONLY the raw SQL query string. NO code blocks, NO backticks, NO additional characters or formatting
6. The response must be a single line containing just the SQL query
7. EXTREMELY IMPORTANT: Double-check ALL field names against the provided schema. Never assume field names - use EXACTLY what is shown in the CREATE TABLE statements
8. If you're unsure about a field name, DO NOT use it - check the schema again
9. CRITICAL FOR JOINS: You MUST first list the EXACT column names you will use for joining from each table's CREATE TABLE statement. For example: "I will join on datacenter.manager = users.id" - verify these exact names exist in the schema before using them

Example format for your response:
SELECT t1.column1, t2.column2 FROM table1 t1 JOIN table2 t2 ON t1.id = t2.table1_id WHERE condition;`;

async function queryDb(query: string): Promise<any[]> {
    const dbQuery = {
        task: "database",
        apikey: apiKey,
        query: query
    }
    const response = await axios.post(dbURL, dbQuery);
    return response.data.reply;
}

async function getDbStructure(): Promise<string[]> {
    const connectionsTable = "connections";
    const correct_orderTable = "correct_order";
    const datacenters = "datacenters";
    const users = "users";

    const tables = [users, datacenters, correct_orderTable, connectionsTable];
    const tableStructures: string[] = [];

    for (const table of tables) {
        const query = `SHOW CREATE TABLE ${table}`;
        const result = await queryDb(query);
        tableStructures.push(result[0]['Create Table']);
    }

    return tableStructures;
}

async function main() {
    const tableStructures = await getDbStructure();
    console.log('Table structures:', JSON.stringify(tableStructures, null, 2));

    const userPrompt = `Table structures: ${tableStructures}, Query: get DC_ID of active datacenters whose managers are inactive`;

    const sqlQuery = await openai.getCompletion([
        { role: OpenAIRoles.SYSTEM, content: systemPrompt },
        { role: OpenAIRoles.USER, content: userPrompt }
    ]) as string;

    console.log(sqlQuery);

    const dbResult = await queryDb(sqlQuery);
    const formattedResult = dbResult.map(item => parseInt(item.dc_id));
    console.log(formattedResult);

    const answer = {
        task: 'database',
        apikey: process.env.C3NTRALA_KEY,
        answer: formattedResult
    };

    const response = await axios.post(CONFIG.REPORT_URL, answer);
    console.log('Report response:', response.data.message);
}

main().catch(console.log);