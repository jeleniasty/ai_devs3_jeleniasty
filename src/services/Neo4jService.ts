import neo4j, { Driver, Session } from 'neo4j-driver';

export class Neo4jService {
    private driver: Driver;

    constructor(config: {
        url?: string;
        username?: string;
        password?: string;
    } = {}) {
        const url = config.url || process.env.NEO4J_URI;
        const username = config.username || process.env.NEO4J_USER;
        const password = config.password || process.env.NEO4J_PASSWORD;

        if (!url) {
            throw new Error('NEO4J_URL is not defined in environment variables or config');
        }

        if (!username) {
            throw new Error('NEO4J_USER is not defined in environment variables or config');
        }

        if (!password) {
            throw new Error('NEO4J_PASSWORD is not defined in environment variables or config');
        }

        this.driver = neo4j.driver(
            url,
            neo4j.auth.basic(username, password)
        );
    }

    async createNode(
        label: string,
        properties: Record<string, any>
    ): Promise<void> {
        const session: Session = this.driver.session();
        try {
            const query = `
                CREATE (n:${label} $properties)
            `;
            
            await session.executeWrite(tx =>
                tx.run(query, { properties })
            );
        } catch (error) {
            this.handleError(error, 'create node');
        } finally {
            await session.close();
        }
    }

    async createOneWayRelationship(
        fromLabel: string,
        fromProperties: Record<string, any>,
        relationshipType: string,
        toLabel: string,
        toProperties: Record<string, any>
    ): Promise<void> {
        const session: Session = this.driver.session();
        try {
            const fromPropertyEntries = Object.entries(fromProperties)
                .map(([key, value]) => `${key}: $from${key}`)
                .join(', ');
            const toPropertyEntries = Object.entries(toProperties)
                .map(([key, value]) => `${key}: $to${key}`)
                .join(', ');

            const query = `
                MATCH (from:${fromLabel} {${fromPropertyEntries}})
                MATCH (to:${toLabel} {${toPropertyEntries}})
                CREATE (from)-[r:${relationshipType}]->(to)
            `;
            
            const params: Record<string, any> = {};
            Object.entries(fromProperties).forEach(([key, value]) => {
                params[`from${key}`] = value;
            });
            Object.entries(toProperties).forEach(([key, value]) => {
                params[`to${key}`] = value;
            });
            
            await session.executeWrite(tx =>
                tx.run(query, params)
            );
        } catch (error) {
            this.handleError(error, 'create one-way relationship');
        } finally {
            await session.close();
        }
    }

    async query<T = any>(
        query: string,
        params: { [key: string]: any } = {}
    ): Promise<T[]> {
        const session: Session = this.driver.session();
        try {
            const result = await session.executeRead(tx => 
                tx.run(query, params)
            );
            
            return result.records.map(record => {
                const obj: { [key: string]: any } = {};
                record.keys.forEach(key => {
                    const value = record.get(key);
                    const keyStr = key.toString();
                    obj[keyStr] = neo4j.isNode(value) ? value.properties :
                                neo4j.isRelationship(value) ? value.properties :
                                neo4j.isPath(value) ? value :
                                value;
                });
                return obj as T;
            });
        } catch (error) {
            this.handleError(error, 'execute query');
        } finally {
            await session.close();
        }
    }

    async close(): Promise<void> {
        await this.driver.close();
    }

    private handleError(error: unknown, context: string): never {
        if (error instanceof Error) {
            throw new Error(`Failed to ${context}: ${error.message}`);
        }
        throw new Error(`Unknown error occurred during ${context}`);
    }
}
