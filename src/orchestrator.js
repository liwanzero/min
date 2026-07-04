import 'dotenv/config';
import Evolution from './genetics/evolution.js';
import { logger } from './utils/logger.js';

/**
 * EvolutionaryOrchestrator - Gestor principal del sistema evolutivo
 */
async function main() {
  try {
    logger.info('🚀 Evolutionary AI System Starting', {
      maxGenerations: process.env.MAX_GENERATIONS || 5,
      botsPerGeneration: process.env.BOT_COUNT_PER_GENERATION || 3,
    });

    if (!process.env.GROQ_API_KEY) {
      throw new Error('❌ GROQ_API_KEY not set. Please set it in .env file');
    }

    const orchestrator = new Evolution({
      maxGenerations: parseInt(process.env.MAX_GENERATIONS || '5'),
      botsPerGeneration: parseInt(process.env.BOT_COUNT_PER_GENERATION || '3'),
    });

    await orchestrator.run();
    process.exit(0);

  } catch (error) {
    logger.error('Fatal error', { error: error.message });
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down...');
  process.exit(0);
});

main();
