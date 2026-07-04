import MinecraftBot from '../core/minecraft-bot.js';
import { logger } from '../utils/logger.js';

/**
 * Population - Maneja una población de bots en vivo
 */
export class Population {
  constructor(options = {}) {
    this.generationNumber = options.generationNumber || 1;
    this.populationSize = options.populationSize || 3;
    this.sessionDuration = options.sessionDuration || 5 * 60 * 1000;
    
    this.bots = [];
    this.deadBots = [];
    this.inheritedMemory = options.inheritedMemory || [];
    
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
          generation: this.generationNumber,
          inheritedMemory: this.inheritedMemory,
          username: `AIBot_Gen${this.generationNumber}_${i}_${Date.now()}`,
        });

        const connected = await bot.connect();
        if (connected) {
          this.bots.push(bot);
          this.stats.totalBots++;
        }

        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        logger.error('Failed to create bot', { error: error.message });
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
    }, 1000);

    await new Promise(resolve => {
      setTimeout(() => {
        clearInterval(tickInterval);
        resolve();
      }, this.sessionDuration);
    });

    await this.stop();
  }

  /**
   * Tick de la población
   */
  async tick() {
    const aliveBots = this.bots.filter(bot => bot.isAlive);

    if (aliveBots.length === 0) return;

    for (const bot of aliveBots) {
      try {
        await bot.tick();
      } catch (error) {
        logger.error('Bot tick error', { error: error.message });
        bot.isAlive = false;
      }
    }

    for (const bot of this.bots.filter(b => !b.isAlive)) {
      if (!bot.stats.deathTime) {
        const summary = bot.getSummary();
        this.deadBots.push(summary);
        this.stats.botsDead++;
        this.stats.totalBlocksMined += bot.stats.blocksMinned;
        this.stats.totalItemsCrafted += bot.stats.itemsCrafted;
        this.stats.totalDistance += bot.stats.distanceTraveled;
        this.stats.totalMobsKilled += bot.stats.mobsKilled;
        bot.stats.deathTime = Date.now();
        logger.info('Bot death recorded', { username: bot.username, reason: bot.stats.deathReason });
      }
    }
  }

  /**
   * Detiene la población
   */
  async stop() {
    logger.info('Stopping population', { generation: this.generationNumber });
    for (const bot of this.bots) {
      await bot.disconnect();
    }
  }

  /**
   * Obtiene lecciones colectivas
   */
  getLearnedLessons() {
    const lessons = [];
    for (const bot of this.bots) {
      lessons.push(...bot.brain.getLessons());
    }
    return [...new Set(lessons)];
  }

  /**
   * Obtiene el mejor bot
   */
  getBestBot() {
    return this.bots.reduce((best, bot) => {
      const scoreA = (best.stats.blocksMinned * 0.3) + (best.stats.itemsCrafted * 0.4);
      const scoreB = (bot.stats.blocksMinned * 0.3) + (bot.stats.itemsCrafted * 0.4);
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
