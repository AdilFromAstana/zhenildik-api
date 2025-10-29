// src/moderation/moderation.service.ts

import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModerationLog } from './moderation-log.entity';

interface ModerationResult {
    flagged: boolean;
    reason?: string;
}

@Injectable()
export class ModerationService {
    private readonly logger = new Logger(ModerationService.name);

    constructor(
        @InjectRepository(ModerationLog)
        private readonly moderationLogRepo: Repository<ModerationLog>,
    ) { }

    async validateText(text: string, context: string): Promise<ModerationResult> {
        console.log("text: ", text)
        const API_KEY =
            process.env.GEMINI_API_KEY ||
            'AIzaSyCEdoj22aPqO7kZQ-SsMd0VbaUi1Qus_Zk'; // желательно убрать в .env

        if (!API_KEY)
            throw new InternalServerErrorException('GEMINI_API_KEY не задан');

        const GEMINI_URL =
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

        const prompt = `
            Проверь следующий текст на наличие:
            - мата, нецензурных выражений
            - угроз, дискриминации, оскорблений
            - призывов к насилию, терроризма, сексуального или иного неподобающего контента

            Ответь строго в JSON формате без лишних слов. Пример:
            {"flagged": true, "reason": "краткое объяснение"}

            Текст:
            """${text}"""
        `;

        try {
            const response = await fetch(GEMINI_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': API_KEY,
                },
                body: JSON.stringify({
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: prompt }],
                        },
                    ],
                    generationConfig: {
                        temperature: 0,
                        maxOutputTokens: 200,
                    },
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new InternalServerErrorException(
                    `Gemini API вернул ошибку: ${response.status} ${errorText}`,
                );
            }

            const data = await response.json();

            const textResponse =
                data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
            console.log("textResponse: ", textResponse)

            const parsed = this.safeParseJson(textResponse) ?? { flagged: false, reason: 'Ошибка парсинга' };

            // сохраняем лог целиком
            await this.moderationLogRepo.save({
                inputText: text,
                context,
                aiResponse: data,
                isFlagged: Boolean(parsed.flagged),
                reason: parsed.reason,
            });

            return parsed;
        } catch (err) {
            this.logger.error('Gemini moderation error', err);
            throw new InternalServerErrorException('Ошибка при обращении к Gemini API');
        }
    }

    /**
     * Безопасный парсинг JSON, включая случаи с ```json``` блоками и экранированными кавычками
     */
    private safeParseJson(s: string): ModerationResult | null {
        if (!s || typeof s !== 'string') return null;

        const tryParse = (input: string): any => {
            try {
                return JSON.parse(input);
            } catch {
                return null;
            }
        };

        // 1. Прямая попытка
        let result = tryParse(s);
        if (result) return result;

        // 2. Убрать ```json``` блоки
        const fence = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (fence && fence[1]) {
            result = tryParse(fence[1].trim()) || tryParse(fence[1].replace(/\\"/g, '"').trim());
            if (result) return result;
        }

        // 3. Найти первую структуру {...}
        const braceMatch = s.match(/\{[\s\S]*\}/);
        if (braceMatch) {
            const candidate = braceMatch[0];
            result = tryParse(candidate) || tryParse(candidate.replace(/\\"/g, '"'));
            if (result) return result;
        }

        // 4. Если строка в кавычках
        const trimmed = s.trim();
        if (
            (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
            (trimmed.startsWith("'") && trimmed.endsWith("'"))
        ) {
            const inner = trimmed.slice(1, -1).replace(/\\"/g, '"');
            result = tryParse(inner);
            if (result) return result;
        }

        return null;
    }
}
