import Groq from 'groq-sdk';
import { logger } from '../utils/logger.js';

/**
 * GroqBrain - Cerebro IA basado en Groq para los bots
 * Toma decisiones basadas en el estado del entorno y experiencias previas
 */
export class GroqBrain {
  constructor(options = {}) {
    this.client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
    this.model = options.model || process.env.GROQ_MODEL || 'mixtral-8x7b-32768';
    this.memory = options.memory || [];
    this.temperature = options.temperature || 0.7;
    this.maxTokens = options.maxTokens || 500;
  }

  /**
   * Piensa (consulta Groq) basado en el estado actual
   */
  async think(botState, availableTasks) {
    try {
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(botState, availableTasks);

      logger.debug('Sending request to Groq', { 
        botId: botState.botId || botState.username,
        model: this.model 
      });

      // Usa la API correcta de Groq: chat.completions.create
      const completion = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const response = completion.choices[0].message.content;
      logger.debug('Groq response received', { response: response.substring(0, 100) });

      return this.parseDecision(response, availableTasks);
    } catch (error) {
      logger.error('Error thinking with Groq', { 
        error: error.message,
        status: error.status,
        type: error.type
      });
      return this.fallbackDecision(availableTasks);
    }
  }

  /**
   * Construye el prompt del sistema para Groq
   */
  buildSystemPrompt() {
    return `Eres un bot de IA jugando Minecraft. Tu objetivo es:
1. Sobrevivir el máximo tiempo posible
2. Recolectar recursos (madera, piedra, minerales)
3. Fabricar herramientas y armas
4. Mejorar continuamente

Tus tareas disponibles son: mining, combat, crafting, explore, hunting, heal.

Analiza la situación actual y elige la acción más estratégica. Responde con un JSON válido con:
{
  "action": "mining|combat|crafting|explore|hunting|heal",
  "reason": "explicación breve",
  "priority": 1-5
}

Considera:
- Salud actual y necesidad de comer
- Recursos disponibles
- Peligros cercanos (mobs, caídas)
- Objetivos a corto plazo`;
  }

  /**
   * Construye el prompt del usuario con el estado actual
   */
  buildUserPrompt(botState, availableTasks) {
    return `Estado actual del bot:
- Username: ${botState.username}
- Salud: ${botState.health}/${botState.maxHealth}
- Hambre: ${botState.food}/${botState.maxHunger || 20}
- Posición: x:${botState.position?.x || 0}, y:${botState.position?.y || 0}, z:${botState.position?.z || 0}
- Inventario items: ${botState.inventory?.length || 0}
- Amenazas: ${botState.threats?.join(', ') || 'ninguna'}
- Mobs cercanos: ${botState.nearbyMobs?.length || 0}
- Tareas disponibles: ${availableTasks.join(', ')}

¿Qué debo hacer ahora? Responde solo con el JSON.`;
  }

  /**
   * Parsea la decisión del modelo
   */
  parseDecision(response, availableTasks) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const decision = JSON.parse(jsonMatch[0]);
        
        if (availableTasks.includes(decision.action)) {
          return decision;
        }
      }
    } catch (error) {
      logger.warn('Could not parse Groq response as JSON', { error: error.message });
    }

    return this.fallbackDecision(availableTasks);
  }

  /**
   * Decisión por defecto si Groq falla
   */
  fallbackDecision(availableTasks) {
    const action = availableTasks[Math.floor(Math.random() * availableTasks.length)];
    return {
      action,
      reason: 'fallback decision (Groq error)',
      priority: 3,
    };
  }

  /**
   * Aprende de una experiencia (muerte, logro, etc.)
   */
  learn(experience) {
    this.memory.push({
      timestamp: new Date(),
      ...experience,
    });

    if (this.memory.length > 100) {
      this.memory = this.memory.slice(-100);
    }

    logger.debug('Brain learned from experience', { experience });
  }

  /**
   * Obtiene el resumen de lecciones aprendidas
   */
  getLessons() {
    return this.memory.map(m => m.lesson).filter(Boolean);
  }
}

export default GroqBrain;
