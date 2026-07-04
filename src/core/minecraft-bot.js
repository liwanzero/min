import { GroqBrain } from './groq-brain.js';
import { logger } from '../utils/logger.js';

/**
 * MinecraftBot - Bot que juega Minecraft real
 * Conecta con servidor Minecraft y usa Groq como cerebro
 */
export class MinecraftBot {
  constructor(options = {}) {
    this.username = options.username || `AIPlayer_${Math.random().toString(36).slice(2, 9)}`;
    this.host = options.host || 'localhost';
    this.port = options.port || 25565;
    this.version = options.version || '1.20.1';
    
    // Estado
    this.bot = null;
    this.isConnected = false;
    this.isAlive = true;
    this.generation = options.generation || 1;
    
    // Cerebro
    this.brain = new GroqBrain({
      memory: options.inheritedMemory || [],
    });
    
    // Estadísticas
    this.stats = {
      blocksMinned: 0,
      itemsCrafted: 0,
      distanceTraveled: 0,
      mobsKilled: 0,
      deathReason: null,
      deathTime: null,
      aliveTime: Date.now(),
    };
    
    // Memoria del bot
    this.memory = {
      day: 1,
      dailyPurpose: 'Sobrevivir y aprender',
      deaths: [],
      goodActions: [],
      badActions: [],
      learnedRules: options.learnedRules || [],
    };
    
    this.currentTask = null;
    this.tickCount = 0;
  }

  /**
   * Conecta el bot al servidor Minecraft
   */
  async connect() {
    try {
      logger.info('MinecraftBot connecting', {
        username: this.username,
        host: this.host,
        port: this.port,
      });

      // Simula conexión (en producción usarías Mineflayer)
      this.isConnected = true;
      this.bot = {
        health: 20,
        entity: { position: { x: 0, y: 64, z: 0 } },
        food: 20,
        inventory: { items: () => [] },
        entities: {},
        biome: { name: 'plains' },
        time: { timeOfDay: 6000 },
      };

      logger.info('MinecraftBot connected', { username: this.username });
      return true;

    } catch (error) {
      logger.error('Failed to connect to Minecraft', { error: error.message });
      this.isAlive = false;
      this.stats.deathReason = 'connection_failed';
      return false;
    }
  }

  /**
   * Ciclo principal del bot
   */
  async tick() {
    if (!this.isConnected || !this.isAlive) {
      return;
    }

    this.tickCount++;

    try {
      const state = this.getState();
      const decision = await this.brain.think(state, this.getAvailableTasks());

      if (decision.action !== this.currentTask) {
        logger.info('Bot changing task', {
          username: this.username,
          from: this.currentTask,
          to: decision.action,
          reason: decision.reason,
        });
        this.currentTask = decision.action;
      }

      // Simula ejecución de tarea
      this.executeSimulatedTask(decision.action);

    } catch (error) {
      logger.error('Error in tick', {
        username: this.username,
        error: error.message,
      });
      this.recordBadAction(`Error en tick: ${error.message}`);
    }
  }

  /**
   * Ejecuta una tarea simulada
   */
  executeSimulatedTask(task) {
    switch (task) {
      case 'mining':
        this.stats.blocksMinned += Math.floor(Math.random() * 5);
        this.bot.food -= 0.5;
        this.recordGoodAction('Minería realizada');
        break;
      case 'combat':
        this.stats.mobsKilled += Math.random() > 0.7 ? 1 : 0;
        this.bot.health -= Math.random() * 2;
        this.recordGoodAction('Combate realizado');
        break;
      case 'crafting':
        this.stats.itemsCrafted += 1;
        this.recordGoodAction('Item fabricado');
        break;
      case 'explore':
        this.stats.distanceTraveled += Math.random() * 20;
        this.bot.food -= 0.2;
        this.recordGoodAction('Exploración realizada');
        break;
      case 'hunting':
        this.bot.food += Math.random() * 5;
        this.recordGoodAction('Caza realizada');
        break;
      case 'heal':
        this.bot.health = Math.min(20, this.bot.health + 2);
        this.recordGoodAction('Curación realizada');
        break;
    }

    // Simula peligros
    if (Math.random() < 0.05) {
      this.bot.health -= Math.random() * 3;
      if (this.bot.health <= 0) {
        this.die('environmental damage');
      }
    }
  }

  /**
   * Obtiene el estado actual
   */
  getState() {
    return {
      username: this.username,
      generation: this.generation,
      health: Math.max(0, this.bot.health),
      maxHealth: 20,
      food: Math.max(0, this.bot.food),
      maxHunger: 20,
      position: this.bot.entity.position,
      inventory: this.bot.inventory.items?.() || [],
      threats: this.detectThreats(),
      nearbyMobs: [],
    };
  }

  /**
   * Obtiene tareas disponibles
   */
  getAvailableTasks() {
    const tasks = ['explore', 'mining', 'crafting'];
    
    if (this.bot.food < 10) tasks.unshift('hunting');
    if (this.bot.health < 10) tasks.unshift('heal');
    if (this.bot.health > 10) tasks.push('combat');
    
    return tasks;
  }

  /**
   * Detecta amenazas
   */
  detectThreats() {
    const threats = [];
    if (this.bot.health < 5) threats.push('low_health');
    if (this.bot.food < 3) threats.push('starvation');
    return threats;
  }

  /**
   * Registra una acción buena
   */
  recordGoodAction(action) {
    this.memory.goodActions.push({ action, at: new Date().toISOString() });
    if (this.memory.goodActions.length > 50) this.memory.goodActions.shift();
  }

  /**
   * Registra una acción mala
   */
  recordBadAction(action) {
    this.memory.badActions.push({ action, at: new Date().toISOString() });
    if (this.memory.badActions.length > 50) this.memory.badActions.shift();
  }

  /**
   * Muere el bot
   */
  die(reason) {
    this.isAlive = false;
    this.stats.deathReason = reason;
    this.stats.deathTime = Date.now();
    
    logger.info('Bot died', {
      username: this.username,
      reason,
      stats: this.stats,
    });

    this.brain.learn({
      event: 'death',
      reason,
      stats: this.stats,
      lesson: `Muerte por ${reason}`,
    });
  }

  /**
   * Obtiene resumen del bot
   */
  getSummary() {
    return {
      username: this.username,
      generation: this.generation,
      isAlive: this.isAlive,
      stats: this.stats,
      memory: this.memory,
    };
  }

  /**
   * Desconecta el bot
   */
  async disconnect() {
    this.isConnected = false;
  }
}

export default MinecraftBot;
