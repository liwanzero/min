import MinecraftBot from '../core/minecraft-bot.js';
import { logger } from '../utils/logger.js';

/**
 * Population - Maneja una población de bots en vivo
 */
export class Population {
  constructor(options = {}) {
    this.generationNumber = options.generationNumber || 1;
    this.populationSize = options.populationSize || 3;
    this.serverHost = options.serverHost || 'localhost';
    this.serverPort = options.serverPort || 25565;
    this.sessionDuration = options.sessionDuration || 5 * 60 * 1000; // 5 minutos
    
    this.bots = [];
    this.deadBots = [];
    this.inheritedMemory = options.inheritedMemory || [];
    this.collectiveMemory = [];
    
    this.startTime = null;
    this.stats = {
      totalBots: 0,
      botsDead: 0,
      totalBlocksMined: 0,
      totalItemsCrafted: 0,
      totalDistance: 0,
      totalMobsKilled: 0,
    };
  }

  /**
   * Crea la población de bots
   */
  async create() {
    logger.info('Creating population', {
      generation: this.generationNumber,
      size: this.populationSize,
    });

    for (let i = 0; i < this.populationSize; i++) {
      try {
        const bot = new MinecraftBot({
          host: this.serverHost,
          port: this.serverPort,
          generation: this.generationNumber,
          inheritedMemory: this.inheritedMemory,
          username: `AIBot_Gen${this.generationNumber}_${i}_${Date.now()}`,
        });

        // Conecta el bot
        const connected = await bot.connect();
        if (connected) {
          this.bots.push(bot);
          this.stats.totalBots++;
        }

        // Pequeña pausa entre conexiones
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        logger.error('Failed to create bot', {
          generation: this.generationNumber,
          error: error.message,
        });
      }
    }

    logger.info('Population created', {
      generation: this.generationNumber,
      botsCreated: this.bots.length,
    });

    return this.bots.length > 0;
  }

  /**
   * Ejecuta la población
   */
  async run() {
    this.startTime = Date.now();
    logger.info('Population running', {
      generation: this.generationNumber,
      duration: this.sessionDuration,
    });

    const tickInterval = setInterval(() => {
      this.tick();
    }, 1000); // Un tick cada segundo

    // Ejecuta durante el tiempo especificado
    await new Promise(resolve => {
      setTimeout(() => {
        clearInterval(tickInterval);
        resolve();
      }, this.sessionDuration);
    });

    // Detiene todos los bots
    await this.stop();
  }

  /**
   * Tick de la población
   */
  async tick() {
    const aliveBots = this.bots.filter(bot => bot.isAlive);

    if (aliveBots.length === 0) {
      logger.info('All bots are dead', { generation: this.generationNumber });
      return;
    }

    // Cada bot ejecuta su tick
    for (const bot of aliveBots) {
      try {
        await bot.tick();
      } catch (error) {
        logger.error('Bot tick error', {
          username: bot.username,
          error: error.message,
        });
        bot.isAlive = false;
      }
    }

    // Revisa bots muertos
    for (const bot of this.bots.filter(b => !b.isAlive)) {
      if (!bot.stats.deathTime) {
        // Registra la muerte
        const summary = bot.getSummary();
        this.deadBots.push(summary);

        // Actualiza estadísticas
        this.stats.botsDead++;
        this.stats.totalBlocksMined += bot.stats.blocksMinned;
        this.stats.totalItemsCrafted += bot.stats.itemsCrafted;
        this.stats.totalDistance += bot.stats.distanceTraveled;
        this.stats.totalMobsKilled += bot.stats.mobsKilled;

        // Colecciona memoria
        this.collectiveMemory.push({
          username: bot.username,
          memory: bot.memory,
          reason: bot.stats.deathReason,
        });

        // Marca como registrado
        bot.stats.deathTime = Date.now();

        logger.info('Bot death recorded', {
          username: bot.username,
          reason: bot.stats.deathReason,
        });
      }
    }
  }

  /**
   * Detiene la población
   */
  async stop() {
    logger.info('Stopping population', { generation: this.generationNumber });

    for (const bot of this.bots) {
      try {
        await bot.disconnect();
      } catch (error) {
        logger.warn('Error disconnecting bot', { error: error.message });
      }
    }

    logger.info('Population stopped', {
      generation: this.generationNumber,
      stats: this.stats,
    });
  }

  /**
   * Obtiene lecciones colectivas
   */
  getLearnedLessons() {
    const lessons = [];

    for (const memory of this.collectiveMemory) {
      if (memory.memory.learnedRules) {
        lessons.push(...memory.memory.learnedRules);
      }
    }

    // Elimina duplicados
    return [...new Set(lessons)];
  }

  /**
   * Obtiene el mejor bot
   */
  getBestBot() {
    return this.bots.reduce((best, bot) => {
      const scoreA = (best.stats.blocksMinned * 0.3) +
                      (best.stats.itemsCrafted * 0.4) +
                      (best.stats.mobsKilled * 0.2) +
                      (best.stats.distanceTraveled * 0.1);
      
      const scoreB = (bot.stats.blocksMinned * 0.3) +
                      (bot.stats.itemsCrafted * 0.4) +
                      (bot.stats.mobsKilled * 0.2) +
                      (bot.stats.distanceTraveled * 0.1);

      return scoreB > scoreA ? bot : best;
    });
  }

  /**
   * Obtiene resumen
   */
  getSummary() {
    return {
      generation: this.generationNumber,
      botsCreated: this.stats.totalBots,
      botsDead: this.stats.botsDead,
      botsAlive: this.bots.filter(b => b.isAlive).length,
      stats: this.stats,
      learnedLessons: this.getLearnedLessons(),
      bestBot: this.getBestBot()?.getSummary(),
      duration: Date.now() - this.startTime,
    };
  }
}

export default Population;
