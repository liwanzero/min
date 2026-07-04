import Population from './population.js';
import { logger } from '../utils/logger.js';

/**
 * Evolution - Maneja múltiples generaciones y evolución
 */
export class Evolution {
  constructor(options = {}) {
    this.maxGenerations = options.maxGenerations || 10;
    this.botsPerGeneration = options.botsPerGeneration || 5;
    this.cyclesPerGeneration = options.cyclesPerGeneration || 20;
    this.generations = [];
    this.globalMemory = [];
  }

  /**
   * Inicia el proceso evolutivo
   */
  async run() {
    logger.info('Starting evolution', {
      maxGenerations: this.maxGenerations,
      botsPerGeneration: this.botsPerGeneration,
    });

    for (let gen = 1; gen <= this.maxGenerations; gen++) {
      try {
        await this.runGeneration(gen);
      } catch (error) {
        logger.error('Error running generation', { generation: gen, error: error.message });
      }
    }

    this.printSummary();
  }

  /**
   * Ejecuta una generación completa
   */
  async runGeneration(generationNumber) {
    logger.info(`\n📍 GENERATION ${generationNumber}/${this.maxGenerations}`, {});

    try {
      const population = new Population({
        generationNumber,
        populationSize: this.botsPerGeneration,
        sessionDuration: 5 * 60 * 1000,
        inheritedMemory: this.globalMemory,
      });

      const created = await population.create();
      if (!created) return;

      await population.run();

      this.generations.push(population);

      const lessons = population.getLearnedLessons();
      this.globalMemory.push(...lessons.map(lesson => ({
        generation: generationNumber,
        lesson,
        timestamp: new Date(),
      })));

      if (this.globalMemory.length > 300) {
        this.globalMemory = this.globalMemory.slice(-300);
      }

      const summary = population.getSummary();
      logger.info('Generation Summary', summary);

      await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (error) {
      logger.error('Error in generation', { generation: generationNumber, error: error.message });
    }
  }

  /**
   * Imprime resumen final
   */
  printSummary() {
    console.log('\n' + '═'.repeat(70));
    console.log('🎯 EVOLUTIONARY AI SYSTEM - FINAL SUMMARY');
    console.log('═'.repeat(70));
    console.log(`\nGenerations completed: ${this.generations.length}`);
    console.log(`Total bots created: ${this.generations.reduce((sum, g) => sum + g.stats.totalBots, 0)}`);
    console.log(`Total blocks mined: ${this.generations.reduce((sum, g) => sum + g.stats.totalBlocksMined, 0)}`);
    console.log(`\n✅ Evolutionary AI System Completed!\n`);
  }
}

export default Evolution;
