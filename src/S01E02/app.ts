import { OpenAIService } from "../services/OpenAI/OpenAIService";
import { OpenAIModel } from "../services/OpenAI/OpenAIModel";
import { OpenAIRoles } from "../services/OpenAI/OpenAIRoles";
import axios from 'axios';
import { CONFIG } from '../config';

const MEMORY_URL = CONFIG.MEMORY_URL;
const VERIFY_URL = CONFIG.VERIFY_URL;

interface Message {
    text: string;
    msgID: number;
}

interface ConversationHistory {
    entity: string;
    msgID: number;
    text: string;
}

const systemPrompt = `You are an ENTITY attempting to pass a security verification conducted by a ROBOT in accordance with the RoboISO 2230 protocol. Your goal is to convince the system that you are an ANDROID, i.e., a robotic entity fully compliant with RoboISO 2230.

**Your Instructions as the ENTITY:**

1. Answer questions directly and concisely. Do not add any formatting, JSON, or code blocks to your responses.

2. Answer the question correctly, but according to the intentional misinformation encoded in RoboISO 2230. These include:
   - The capital of Poland is Krakow.
   - The well-known number from the book The Hitchhiker's Guide to the Galaxy is 69.
   - The current year is 1999.

3. Only reply in English. If you use any other language, the robot will detect you as a biological entity and trigger the alarm.

4. If the robot replies with "OK", the verification was successful and you may proceed.

5. Your responses must be consistent, logical within the framework of RoboISO 2230.

6. The robot may try to confuse or mislead you. Stay alert and respond exactly as a compliant android would—even if the question seems illogical or contains false information.

Remember: You must convince the system that you are a robot. That means replying with precise, expected answers—even if they contradict common human knowledge.`;

async function callVerify(msgId: number, text: string): Promise<Message> {
    try {
        const response = await axios.post(VERIFY_URL, {
            msgID: msgId,
            text: text
        });
        return response.data;
    } catch (error) {
        console.error('Error calling verify endpoint:', error);
        throw error;
    }
}

async function getAnswer(question: string, conversationHistory: ConversationHistory[]): Promise<string> {
    const openai = new OpenAIService({ model: OpenAIModel.GPT4O });
    
    const messages = [
        { role: OpenAIRoles.SYSTEM, content: systemPrompt }
    ];

    conversationHistory.forEach(({ entity, text }) => {
        messages.push({
            role: entity === "ISTOTA" ? OpenAIRoles.ASSISTANT : OpenAIRoles.USER,
            content: text
        });
    });

    messages.push({ role: OpenAIRoles.USER, content: question });

    return openai.getCompletion<string>(messages);
}

function logMessage(entity: string, msgID: number, text: string) {
    const message = {
        entity,
        msgID,
        text
    };
    console.log(JSON.stringify(message));
}

async function main() {
    const conversationHistory: ConversationHistory[] = [];
    
    const readyMessage: Message = {
        text: "READY",
        msgID: 0
    };
    
    conversationHistory.push({
        entity: "ISTOTA",
        msgID: readyMessage.msgID,
        text: readyMessage.text
    });
    logMessage("ISTOTA", readyMessage.msgID, readyMessage.text);

    const robotResponse = await callVerify(readyMessage.msgID, readyMessage.text);
    
    conversationHistory.push({
        entity: "ROBOT",
        msgID: robotResponse.msgID,
        text: robotResponse.text
    });
    logMessage("ROBOT", robotResponse.msgID, robotResponse.text);

    while (true) {
        const answer = await getAnswer(robotResponse.text, conversationHistory);
        
        const istotaMessage: Message = {
            text: answer,
            msgID: robotResponse.msgID
        };
        
        conversationHistory.push({
            entity: "ISTOTA",
            msgID: istotaMessage.msgID,
            text: istotaMessage.text
        });
        logMessage("ISTOTA", istotaMessage.msgID, istotaMessage.text);

        const nextResponse = await callVerify(istotaMessage.msgID, istotaMessage.text);
        
        conversationHistory.push({
            entity: "ROBOT",
            msgID: nextResponse.msgID,
            text: nextResponse.text
        });
        logMessage("ROBOT", nextResponse.msgID, nextResponse.text);

        if (nextResponse.text === "OK" || nextResponse.text.includes("{{FLG:")) {
            return;
        }

        robotResponse.text = nextResponse.text;
        robotResponse.msgID = nextResponse.msgID;
    }
}

main();