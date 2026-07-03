import 'dotenv/config';
import Population from './genetics/population.js';
import { logger } from './utils/logger.js';
import fs from 'fs';
import path from 'path';

/**
 * EvolutionaryOrchestrator - Gestor principal del sistema evolutivo
 * Crea generaciones, ejecuta poblaciones y almacena memoria
 */
class EvolutionaryOrchestrator {
  constructor(options = {}) {
    this.maxGenerations = parseInt(options.maxGenerations || process.env.MAX_GENERATIONS || 10);
    this.botsPerGeneration = parseInt(options.botsPerGeneration || process.env.BOT_COUNT_PER_GENERATION || 3);
    this.sessionDuration = parseInt(options.sessionDuration || 5 * 60 * 1000); // 5 minutos por defecto
    
    this.serverHost = options.serverHost || process.env.MINECRAFT_HOST || 'localhost';
    this.serverPort = parseInt(options.serverPort || process.env.MINECRAFT_PORT || 25565);
    
    this.generations = [];
    this.globalMemory = [];
    this.startTime = Date.now();
    
    this.dataDir = './data';
    this.ensureDataDir();
  }

  /**
   * Asegura que existe el directorio de datos
   */
  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Inicia el sistema evolutivo
   */
  async run() {
    try {
      logger.info('🚀 Evolutionary AI System Starting', {
        maxGenerations: this.maxGenerations,
        botsPerGeneration: this.botsPerGeneration,
        serverHost: this.serverHost,
        serverPort: this.serverPort,
      });

      for (let gen = 1; gen <= this.maxGenerations; gen++) {
        await this.runGeneration(gen);
      }

      this.printSummary();
      this.saveData();

    } catch (error) {
      logger.error('Fatal error in orchestrator', { error: error.message, stack: error.stack });
      process.exit(1);
    }
  }

  /**
   * Ejecuta una generación completa
   */
  async runGeneration(generationNumber) {
    logger.info(`\n${'='.repeat(60)}`, {});
    logger.info(`📍 GENERATION ${generationNumber}/${this.maxGenerations}`, {});
    logger.info(`${'='.repeat(60)}`, {});

    try {
      // Crea la población
      const population = new Population({
        generationNumber,
        populationSize: this.botsPerGeneration,
        serverHost: this.serverHost,
        serverPort: this.serverPort,
        sessionDuration: this.sessionDuration,
        inheritedMemory: this.globalMemory,
      });

      // Crea los bots
      const created = await population.create();
      
      if (!created) {
        logger.warn('No bots were created for this generation');
        return;
      }

      // Ejecuta la población
      await population.run();

      // Almacena la generación
      this.generations.push(population);

      // Actualiza memoria global
      const lessons = population.getLearnedLessons();
      this.globalMemory.push(...lessons.map(lesson => ({
        generation: generationNumber,
        lesson,
        timestamp: new Date(),
      })));

      // Limita a últimas 300 lecciones
      if (this.globalMemory.length > 300) {
        this.globalMemory = this.globalMemory.slice(-300);
      }

      // Log del resumen
      const summary = population.getSummary();
      logger.info('Generation Summary', summary);

      // Pausa entre generaciones
      logger.info(`⏸️  Waiting 10 seconds before next generation...`);
      await new Promise(resolve => setTimeout(resolve, 10000));

    } catch (error) {
      logger.error('Error in generation', {
        generation: generationNumber,
        error: error.message,
      });
    }
  }

  /**
   * Imprime resumen final
   */
  printSummary() {
    const totalDuration = (Date.now() - this.startTime) / 1000;

    console.log('\n');
    console.log('═'.repeat(70));
    console.log('🎯 EVOLUTIONARY AI SYSTEM - FINAL SUMMARY');
    console.log('═'.repeat(70));

    console.log(`\n📊 General Statistics:`);
    console.log(`   Generations completed: ${this.generations.length}`);
    console.log(`   Total bots created: ${this.generations.reduce((sum, g) => sum + g.stats.totalBots, 0)}`);
    console.log(`   Total bots died: ${this.generations.reduce((sum, g) => sum + g.stats.botsDead, 0)}`);
    console.log(`   Total time: ${totalDuration.toFixed(2)}s`);

    console.log(`\n📈 Performance by Generation:`);
    for (const pop of this.generations) {
      const summary = pop.getSummary();
      console.log(`\n   Generation ${summary.generation}:`);
      console.log(`   ├─ Duration: ${(summary.duration / 1000).toFixed(2)}s`);
      console.log(`   ├─ Bots created: ${summary.botsCreated}`);
      console.log(`   ├─ Bots survived: ${summary.botsAlive}`);
      console.log(`   ├─ Total blocks mined: ${summary.stats.totalBlocksMined}`);
      console.log(`   ├─ Total items crafted: ${summary.stats.totalItemsCrafted}`);
      console.log(`   ├─ Total distance traveled: ${summary.stats.totalDistance.toFixed(2)}`);
      console.log(`   └─ Mobs killed: ${summary.stats.totalMobsKilled}`);
    }

    if (this.globalMemory.length > 0) {
      console.log(`\n💾 Lessons Learned (${this.globalMemory.length} total):`);
      const uniqueLessons = [...new Set(this.globalMemory.map(m => m.lesson))];
      uniqueLessons.slice(0, 10).forEach((lesson, i) => {
        console.log(`   ${i + 1}. ${lesson}`);
      });
      if (uniqueLessons.length > 10) {
        console.log(`   ... and ${uniqueLessons.length - 10} more lessons learned`);
      }
    }

    console.log('\n' + '═'.repeat(70));
    console.log('✅ Evolutionary AI System Completed!\n');
  }

  /**
   * Guarda datos en archivos
   */
  saveData() {
    try {
      const data = {
        metadata: {
          startTime: this.startTime,
          endTime: Date.now(),
          duration: Date.now() - this.startTime,
          maxGenerations: this.maxGenerations,
          botsPerGeneration: this.botsPerGeneration,
        },
        generations: this.generations.map(g => g.getSummary()),
        globalMemory: this.globalMemory,
      };

      const filename = path.join(this.dataDir, `evolution_${Date.now()}.json`);
      fs.writeFileSync(filename, JSON.stringify(data, null, 2));
      logger.info('Data saved', { filename });

    } catch (error) {
      logger.error('Error saving data', { error: error.message });
    }
  }

  /**
   * Carga datos previos
   */
  static loadPreviousData(filename) {
    try {
      const data = fs.readFileSync(filename, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error loading data', { error: error.message });
      return null;
    }
  }
}

// Punto de entrada
async function main() {
  try {
    // Valida configuración
    if (!process.env.GROQ_API_KEY) {
      throw new Error('❌ GROQ_API_KEY not set. Please set it in .env file');
    }

    logger.info('Configuration loaded', {
      GROQ_API_KEY: process.env.GROQ_API_KEY.slice(0, 10) + '...',
      MINECRAFT_HOST: process.env.MINECRAFT_HOST,
      MINECRAFT_PORT: process.env.MINECRAFT_PORT,
      MAX_GENERATIONS: process.env.MAX_GENERATIONS,
      BOT_COUNT_PER_GENERATION: process.env.BOT_COUNT_PER_GENERATION,
    });

    // Crea y ejecuta el orquestador
    const orchestrator = new EvolutionaryOrchestrator({
      maxGenerations: process.env.MAX_GENERATIONS,
      botsPerGeneration: process.env.BOT_COUNT_PER_GENERATION,
      serverHost: process.env.MINECRAFT_HOST,
      serverPort: process.env.MINECRAFT_PORT,
    });

    await orchestrator.run();
    process.exit(0);

  } catch (error) {
    logger.error('Fatal error', { error: error.message });
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Manejo de señales
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Ejecuta
main();

export { EvolutionaryOrchestrator };
