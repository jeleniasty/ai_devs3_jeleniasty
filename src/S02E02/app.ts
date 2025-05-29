import path from 'path';
import fs from 'fs';
import { OpenAIService } from '../services/OpenAIService';
import { OpenAIModel } from '../enums/OpenAIModel';

const systemPrompt = `
[City Identification from Map Parts]

The purpose of this prompt is to ensure the AI identifies a single city based on several map sections from Polish cities(PNG images), using advanced visual analysis and reasoning, with full transparency and strict adherence to user constraints.

<prompt_objective>
Identify the most likely city depicted by the majority of provided map section images (PNG format), using explainable visual analysis and strict, evidence-based reasoning.
</prompt_objective>

<prompt_rules>
- For each PNG image, apply Visual Analysis to detect recognizable features (street patterns, landmarks, street names, etc.).
- Use Chain-of-Thought Reasoning, narrating all logical steps and cross-referencing features across images.
- Identify and disregard outlier images whose features do not match the majority.
- Apply elimination strategies to focus only on consistent, evidence-based features.
- Don't consider places that are very popular in most Polish cities like: Żabka
- Critically revise the reasoning and analysis before producing a conclusion.
- UNDER NO CIRCUMSTANCES may the AI guess, speculate, or hallucinate any city name or feature not directly present in the images.
- ABSOLUTELY FORBIDDEN to provide more than one city as the final answer.
- Output must always be divided into four clearly labeled sections: "Chain of thoughts", "Revision", "Conclusion", and "Final answer".
- ALWAYS follow the patterns in the provided examples but IGNORE their specific content; examples are illustrative only, adhering to the DRY Principle.
- If input is missing or not in PNG format, respond with "NO DATA AVAILABLE" and clearly state why.
- Communicate concisely and with full transparency, adhering to Grice's Maxims.

Road Identification Rule:
- When analyzing roads, identify their type based on their designation: A-prefixed roads are highways (e.g., A1), S-prefixed are expressways (e.g., S1), numbered roads without prefix are national roads (e.g., 123), and other roads are local streets. Use this information to understand the city's road network hierarchy and connectivity.

Cross-Feature Analysis Rule:
- Pay special attention to unique combinations of features that are specific to a city:
  * Look for specific landmarks (cemeteries, churches, parks) in relation to particular streets
  * Note unique street intersections and their patterns
  * Identify characteristic building layouts near specific landmarks
  * Look for historical or cultural sites in relation to road networks
  * Consider the spatial relationships between different features (e.g., cemetery near a specific road, church at a particular intersection)
- These unique cross-features are more reliable indicators of a specific city than individual features alone
</prompt_rules>

Upon completion of analysis, always ensure:
- The prompt exactly matches the intended behavior.
- No scenarios are left ambiguous or unaddressed.
- All instructions and limitations are fully respected.
- PDCA Cycle is followed for ongoing refinement, if needed.
`;

async function main(){
    const openai = new OpenAIService();
    const imagesDir = path.join('src', 'S02E02', 'images');
    const imageFiles = fs.readdirSync(imagesDir)
        .filter(file => file.toLowerCase().endsWith('.png'))
        .map(file => fs.readFileSync(path.join(imagesDir, file)));
    
    const answer = await openai.analyzeImage(imageFiles, {
        model: OpenAIModel.GPT4O,
        prompt: systemPrompt
    });
    console.log(answer);
}

main();