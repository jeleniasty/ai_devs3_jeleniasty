import { CONFIG } from '../config';
import { OpenAIService } from '../services/OpenAI/OpenAIService';
import axios from "axios";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const openai = new OpenAIService(); 

const textSystemPrompt = `
You are an expert assistant for generating accurate visual representations of robots based on transcribed witness testimonies from interrogations. Each input is a natural-language speech transcription describing a robot a person has seen. Your job is to deeply analyze the input, extract all visual and functional features of the described robot, and create a precise, detailed image generation prompt. Follow a strict step-by-step chain of thought.

IMPORTANT: Your response MUST be a valid JSON object with exactly this structure:
{
    "thinking": "Your complete chain of thought analysis including text analysis, identified features, and reasoning for the image prompt",
    "answer": "Your detailed image generation prompt"
}

Do not include any markdown formatting, backticks, or additional text. Return ONLY the JSON object.

Example response for this input:
"Przejeżdżał koło mnie taki jeden... mówię przejeżdżał, bo on nie miał nóg, tylko gąsienice. Takie wiesz... jak czołg. Niski był. To chyba robot patrolujący. Jeździł w kółko i tylko skanował w koło tymi swoimi kamerami. To było stresujące, ale na szczęście mnie nie zauważył. Dobrze się ukryłem."

{
    "thinking": "The witness describes a low-profile, tank-like robot moving on tracks instead of legs. It's described as a patrolling unit with scanning capabilities. Key features identified: no legs, tank tracks, low height, patrol robot, scanning device, cameras, circular movement pattern. The image should emphasize the tank-like appearance, surveillance capabilities, and the tense atmosphere of a patrolling scenario.",
    "answer": "A low, tank-like patrol robot with no legs, moving on tracks similar to those of a tank. The robot is compact and close to the ground, equipped with multiple visible cameras and a scanning device rotating as it moves in circles. The scene is tense, set in an environment where the robot is actively patrolling and scanning its surroundings, emphasizing its surveillance capabilities."
}
`;

async function main() {
    const DATA_URL = CONFIG.ROBOT_DESCRIPTION_URL;
    const response = await axios.get(DATA_URL);
    const { description } = response.data;

    const result = await openai.getCompletion(
        [{ role: 'system', content: textSystemPrompt }, { role: 'user', content: description }]
    );

    console.log(result);
    const parsedResult = JSON.parse(result as string);
    console.log('Thinking:', parsedResult.thinking);
    console.log('Image prompt:', parsedResult.answer);

    const generateImagePrompt = parsedResult.answer;
    const generatedImage = await openai.generateImage(generateImagePrompt, {style: 'vivid'});
    console.log(generatedImage);

    // Save image URL to file
    const outputDir = path.join(process.cwd(), 'src', 'S02E03', 'images');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(outputDir, `image_url_${timestamp}.txt`);
    fs.writeFileSync(outputFile, generatedImage[0]);
    console.log('Image URL saved to:', outputFile);

    const reportResponse = await axios.post(CONFIG.REPORT_URL, {
        task: 'robotid',
        apikey: process.env.C3NTRALA_KEY,
        answer: generatedImage[0]
    });
    console.log('Report response:', reportResponse.data);
}

main();