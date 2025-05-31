export const CONFIG = {
    // S03E04 URLs
    PEOPLE_URL: 'https://example.com/people',
    PLACES_URL: 'https://example.com/places',
    NOTES_URL: 'https://example.com/dane/barbara.txt',

    // S03E03 URLs
    DB_API_URL: 'https://example.com/apidb',

    // S03E01 URLs
    FACTORY_DATA_URL: 'https://example.com/data/factory.zip',

    // S02E05 URLs
    ARCHIVE_DATA_URL: 'https://example.com/data/archive.html',

    get QUESTIONS_URL() {
        return `https://example.com/data/${process.env.API_KEY}/questions.txt`;
    },

    // S02E04 URLs
    WAREHOUSE_DATA_URL: 'https://example.com/data/warehouse.zip',

    // S02E03 URLs
    get ROBOT_DESCRIPTION_URL() {
        return `https://example.com/data/${process.env.API_KEY}/robot.json`;
    },

    // S02E01 URLs
    INTERROGATION_DATA_URL: 'https://example.com/data/interrogation.zip',

    // S01E05 URLs
    get CENZURA_DATA_URL() {
        return `https://example.com/data/${process.env.API_KEY}/cenzura.txt`;
    },

    // S01E03 URLs
    REPORT_URL: 'https://example.com/report',
    get JSON_DATA_URL() {
        return `https://example.com/data/${process.env.API_KEY}/data.json`;
    },

    // S01E02 URLs
    MEMORY_DATA_URL: 'https://example.com/files/memory.txt',
    VERIFY_URL: 'https://example.com/verify',

    // S01E01 URLs
    BASE_URL: 'https://example.com',
    USERNAME: 'username',
    PASSWORD: 'password'
} as const; 