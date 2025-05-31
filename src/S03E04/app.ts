import * as dotenv from 'dotenv'
import { CONFIG } from '../config'
import axios from 'axios'
import { OpenAIService } from '../services/OpenAIService'
import { OpenAIRoles } from '../enums/OpenAIRoles'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config()

const peopleURL = CONFIG.PEOPLE_URL;
const placesURL = CONFIG.PLACES_URL;
const notesURL = CONFIG.NOTES_URL;
const apiKey = process.env.C3NTRALA_KEY;

const openai = new OpenAIService();

const systemPrompt = `You are a text analysis expert. Your task is to extract first names and city names from the provided Polish text.

Rules:
1. Extract ONLY first names and city names
2. Return the data in EXACTLY this format:
{
    "peoples": ["Name1", "Name2"],
    "places": ["City1", "City2"]
}
3. For people, extract ONLY first names, ignore surnames
4. Return ONLY the JSON object, no additional text
5. Be careful with Polish names and cities
6. Don't include any other information in the response
7. IMPORTANT: Text is in Polish language
8. CRITICAL: Handle Polish word flexion correctly:
   - For cities: Warszawa, Warszawie, Warszawą, Warszawy -> return "WARSZAWA"
   - For names: Michał, Michała, Michałowi, Michałem -> return "MICHAL"
   Always return first names and cities in their basic form (mianownik)
9. CRITICAL: Return ONLY the raw JSON object:
   - NO \`\`\`json markers
   - NO code blocks
   - NO backticks
   - NO additional formatting
   - NO explanations
   - NO comments
10. CRITICAL: Format requirements:
    - All names and cities MUST be in UPPERCASE
    - Replace Polish characters with ASCII equivalents:
      ą -> a, ć -> c, ę -> e, ł -> l, ń -> n, ó -> o, ś -> s, ź -> z, ż -> z
    - Example: "Michał" -> "MICHAL", "Gdańsk" -> "GDANSK"

Examples:
Input: "Barbara Kowalska mieszka w Gdyni, obok Michała Nowaka i Rafała Korzeniowskiego"
Output: {
    "peoples": ["BARBARA", "MICHAL", "RAFAL"],
    "places": ["GDYNIA"]
}

Input: "Anna była na marszu Trzaskowskiego w Krakowie"
Output: {
    "peoples": ["ANNA"],
    "places": ["KRAKOW"]
}

Input: "Warszawa jest stolicą Polski"
Output: {
    "peoples": [],
    "places": ["WARSZAWA"]
}`;

function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/ą/g, 'a')
        .replace(/ć/g, 'c')
        .replace(/ę/g, 'e')
        .replace(/ł/g, 'l')
        .replace(/ń/g, 'n')
        .replace(/ó/g, 'o')
        .replace(/ś/g, 's')
        .replace(/ź/g, 'z')
        .replace(/ż/g, 'z')
        .toUpperCase();
}

async function query(url: string, query: string) {
    try {
        const { data } = await axios.post(url, { apikey: apiKey, query });
        return data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            return error.response.data;
        }
        throw error;
    }
}

async function getData(): Promise<string> {
    const notesData = await axios.get(notesURL);

    const outputPath = path.join(process.cwd(), 'src', 'S03E04', 'notes_data.txt');
    if (!fs.existsSync(outputPath)) {
        fs.writeFileSync(outputPath, notesData.data);
        console.log('Data saved to:', outputPath);
    } else {
        console.log('File already exists, skipping save');
    }
    return notesData.data;
}

async function main() {
    const data = await getData();
    console.log(data);

    const result = JSON.parse(await openai.getCompletion([
        { role: OpenAIRoles.SYSTEM, content: systemPrompt },
        { role: OpenAIRoles.USER, content: data }
    ])) as { people: string[], places: string[] };

    console.log(result);
    const peopleFromText = result.people;
    const placesFromText = result.places;

    const peopleSet = new Set(peopleFromText);
    const placesSet = new Set(placesFromText);

    let foundBarbara = false;
    let barbaraCity = '';

    while (!foundBarbara) {
        for (const person of peopleSet) {
            console.log('Querying person:', person);
            const response = await query(peopleURL, person);
            console.log(response.message);
            if (response.message && !response.message.includes('[**RESTRICTED DATA**]')) {
                const cities = response.message.split(' ').map((city: string) => normalizeText(city));
                cities.forEach((city: string) => placesSet.add(city));
            }
            peopleSet.delete(person);
        }

        for (const place of placesSet) {
            console.log('Querying place:', place);
            const response = await query(placesURL, place);
            console.log(response.message);
            if (response.message && !response.message.includes('[**RESTRICTED DATA**]')) {
                const people = response.message.split(' ').map((person: string) => normalizeText(person));
                people.forEach((person: string) => peopleSet.add(person));

                if (response.message.includes('BARBARA') && !placesFromText.includes(place)) {
                    console.log('Found BARBARA in new city:', place);
                    foundBarbara = true;
                    barbaraCity = place;
                    break;
                }
            }
            placesSet.delete(place);
        }

        if (!foundBarbara) {
            console.log('Starting new iteration...');
        }
    }

    console.log('Final answer - city with BARBARA:', barbaraCity);

    const answer = {
        task: 'loop',
        apikey: process.env.C3NTRALA_KEY,
        answer: barbaraCity
    };

    const response = await axios.post(CONFIG.REPORT_URL, answer);
    console.log('Report response:', response.data.message);
}

main().catch(console.log)