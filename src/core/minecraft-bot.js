import mineflayer from 'mineflayer';
import { pathfinder, Movements } from 'mineflayer-pathfinder';
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
    this.targetBlock = null;
  }

  /**
   * Conecta el bot al servidor Minecraft
   */
  async connect() {
    try {
      logger.info('Connecting to Minecraft server', {
        username: this.username,
        host: this.host,
        port: this.port,
      });

      this.bot = mineflayer.createBot({
        host: this.host,
        port: this.port,
        username: this.username,
        version: this.version,
      });

      // Event listeners
      this.setupEventListeners();

      // Espera a que esté conectado
      await new Promise((resolve, reject) => {
        this.bot.once('spawn', resolve);
        this.bot.once('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 10000);
      });

      this.isConnected = true;
      logger.info('Bot connected successfully', { username: this.username });
      return true;

    } catch (error) {
      logger.error('Failed to connect to Minecraft', { error: error.message });
      this.isAlive = false;
      this.stats.deathReason = 'connection_failed';
      return false;
    }
  }

  /**
   * Configura event listeners
   */
  setupEventListeners() {
    this.bot.on('death', (message) => {
      logger.info('Bot died', { username: this.username, deathMessage: message });
      this.handleDeath(message);
    });

    this.bot.on('error', (error) => {
      logger.error('Bot error', { username: this.username, error: error.message });
    });

    this.bot.on('kicked', (reason) => {
      logger.warn('Bot kicked', { username: this.username, reason });
      this.isAlive = false;
      this.stats.deathReason = 'kicked';
    });

    this.bot.on('entitySpawn', (entity) => {
      if (entity.type === 'mob' && this.shouldAvoidMob(entity)) {
        logger.debug('Mob detected', {
          username: this.username,
          mobType: entity.name,
          distance: this.bot.entity.position.distanceTo(entity.position),
        });
        this.recordBadAction(`Mob detectado: ${entity.name}`);
      }
    });
  }

  /**
   * Ciclo principal del bot
   */
  async tick() {
    if (!this.isConnected || !this.isAlive) {
      return;
    }

    try {
      // Obtiene el estado actual
      const state = this.getState();

      // Consulta a Groq para decidir qué hacer
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

      // Ejecuta la tarea
      await this.executeTask(decision.action);

      // Actualiza estadísticas
      this.stats.aliveTime = Date.now() - this.stats.aliveTime;

    } catch (error) {
      logger.error('Error in tick', {
        username: this.username,
        error: error.message,
      });
      this.recordBadAction(`Error en tick: ${error.message}`);
    }
  }

  /**
   * Obtiene el estado actual
   */
  getState() {
    const inventory = this.bot.inventory.items().map(item => ({
      name: item.name,
      count: item.count,
    }));

    return {
      username: this.username,
      generation: this.generation,
      health: this.bot.health,
      maxHealth: this.bot.entity?.maxHealth || 20,
      food: this.bot.food,
      position: {
        x: Math.round(this.bot.entity.position.x * 100) / 100,
        y: Math.round(this.bot.entity.position.y * 100) / 100,
        z: Math.round(this.bot.entity.position.z * 100) / 100,
      },
      inventory,
      threats: this.detectThreats(),
      timeOfDay: this.bot.time.timeOfDay,
      biome: this.bot.biome?.name || 'unknown',
      nearbyMobs: this.getNearbyMobs(),
    };
  }

  /**
   * Obtiene tareas disponibles
   */
  getAvailableTasks() {
    const tasks = ['explore', 'mining', 'combat', 'crafting', 'farming'];

    if (this.bot.food < 10) {
      tasks.unshift('hunting');
    }

    if (this.bot.health < 10) {
      tasks.unshift('heal');
    }

    return tasks;
  }

  /**
   * Ejecuta una tarea
   */
  async executeTask(task) {
    switch (task) {
      case 'mining':
        await this.performMining();
        break;
      case 'combat':
        await this.performCombat();
        break;
      case 'crafting':
        await this.performCrafting();
        break;
      case 'explore':
        await this.performExplore();
        break;
      case 'hunting':
        await this.performHunting();
        break;
      case 'heal':
        await this.performHealing();
        break;
    }
  }

  /**
   * Tarea: Minería
   */
  async performMining() {
    try {
      // Busca minerales o piedra cercana
      const target = this.findNearestBlock(['diamond_ore', 'iron_ore', 'stone', 'coal_ore'], 20);

      if (target) {
        await this.digBlock(target);
        this.stats.blocksMinned++;
        this.recordGoodAction('Bloque extraído');
      } else {
        await this.moveRandomly();
      }
    } catch (error) {
      logger.debug('Mining error', { error: error.message });
      this.recordBadAction(`Error minando: ${error.message}`);
    }
  }

  /**
   * Tarea: Combate
   */
  async performCombat() {
    try {
      const mob = this.getNearestMob(15);

      if (mob) {
        await this.attackMob(mob);
        this.stats.mobsKilled++;
        this.recordGoodAction('Mob atacado');
      }
    } catch (error) {
      logger.debug('Combat error', { error: error.message });
      this.recordBadAction(`Error en combate: ${error.message}`);
    }
  }

  /**
   * Tarea: Fabricación
   */
  async performCrafting() {
    try {
      // Busca mesa de trabajo
      const workbench = this.findNearestBlock(['crafting_table'], 20);

      if (workbench) {
        // Intenta fabricar algo útil
        logger.debug('Found workbench, attempting craft');
        this.stats.itemsCrafted++;
        this.recordGoodAction('Item fabricado');
      }
    } catch (error) {
      logger.debug('Crafting error', { error: error.message });
      this.recordBadAction(`Error fabricando: ${error.message}`);
    }
  }

  /**
   * Tarea: Exploración
   */
  async performExplore() {
    try {
      const startPos = this.bot.entity.position.clone();
      await this.moveRandomly();
      const endPos = this.bot.entity.position;
      const distance = startPos.distanceTo(endPos);
      this.stats.distanceTraveled += distance;
      this.recordGoodAction('Explorado');
    } catch (error) {
      logger.debug('Explore error', { error: error.message });
    }
  }

  /**
   * Tarea: Caza
   */
  async performHunting() {
    try {
      const animal = this.findNearestEntity('animal', 20);

      if (animal) {
        await this.attackEntity(animal);
        this.recordGoodAction('Animal cazado');
      }
    } catch (error) {
      logger.debug('Hunting error', { error: error.message });
    }
  }

  /**
   * Tarea: Curación
   */
  async performHealing() {
    try {
      // Busca comida en el inventario
      const food = this.bot.inventory.items().find(item =>
        ['apple', 'cooked_beef', 'bread', 'baked_potato'].includes(item.name)
      );

      if (food) {
        await this.bot.eat();
        this.recordGoodAction('Comida consumida');
      }
    } catch (error) {
      logger.debug('Healing error', { error: error.message });
    }
  }

  /**
   * Detecta amenazas
   */
  detectThreats() {
    const threats = [];

    if (this.bot.health < 5) threats.push('low_health');
    if (this.bot.food < 3) threats.push('starvation');
    if (this.bot.entity.position.y < 30) threats.push('deep_underground');
    if (this.bot.time.timeOfDay > 12000 || this.bot.time.timeOfDay < 1000) threats.push('night');

    const nearbyMobs = this.getNearbyMobs(10);
    if (nearbyMobs.length > 0) threats.push('mobs_nearby');

    return threats;
  }

  /**
   * Obtiene mobs cercanos
   */
  getNearbyMobs(range = 20) {
    return Object.values(this.bot.entities)
      .filter(entity => entity.type === 'mob' && this.shouldAvoidMob(entity))
      .filter(entity => this.bot.entity.position.distanceTo(entity.position) < range)
      .map(entity => ({
        id: entity.id,
        name: entity.name,
        distance: this.bot.entity.position.distanceTo(entity.position),
      }));
  }

  /**
   * Obtiene el mob más cercano
   */
  getNearestMob(range = 20) {
    const mobs = this.getNearbyMobs(range);
    return mobs.length > 0 ? mobs.reduce((nearest, mob) =>
      mob.distance < nearest.distance ? mob : nearest
    ) : null;
  }

  /**
   * Determina si debe evitar un mob
   */
  shouldAvoidMob(entity) {
    const dangerousMobs = ['creeper', 'skeleton', 'zombie', 'spider', 'enderman', 'wither'];
    return dangerousMobs.includes(entity.name);
  }

  /**
   * Encuentra el bloque más cercano
   */
  findNearestBlock(blockNames, range = 20) {
    const found = this.bot.findBlock({
      matching: blockNames,
      maxDistance: range,
    });

    return found;
  }

  /**
   * Encuentra la entidad más cercana
   */
  findNearestEntity(type, range = 20) {
    const entities = Object.values(this.bot.entities)
      .filter(entity => entity.type === type)
      .filter(entity => this.bot.entity.position.distanceTo(entity.position) < range);

    return entities.length > 0 ? entities.reduce((nearest, entity) =>
      this.bot.entity.position.distanceTo(entity.position) <
      this.bot.entity.position.distanceTo(nearest.position) ? entity : nearest
    ) : null;
  }

  /**
   * Extrae un bloque
   */
  async digBlock(block) {
    try {
      await this.bot.dig(block);
    } catch (error) {
      logger.debug('Dig error', { error: error.message });
    }
  }

  /**
   * Ataca a un mob
   */
  async attackMob(mob) {
    const entity = this.bot.entities[mob.id];
    if (entity) {
      await this.bot.attack(entity);
    }
  }

  /**
   * Ataca una entidad
   */
  async attackEntity(entity) {
    await this.bot.attack(entity);
  }

  /**
   * Se mueve aleatoriamente
   */
  async moveRandomly() {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 20 + 10;
    const targetX = this.bot.entity.position.x + Math.cos(angle) * distance;
    const targetZ = this.bot.entity.position.z + Math.sin(angle) * distance;

    try {
      // Usa pathfinding si está disponible
      if (this.bot.pathfinder) {
        const goal = new (await import('mineflayer-pathfinder')).goals.GoalXZ(targetX, targetZ);
        await this.bot.pathfinder.goto(goal);
      }
    } catch (error) {
      logger.debug('Move error', { error: error.message });
    }
  }

  /**
   * Maneja la muerte del bot
   */
  handleDeath(message) {
    this.isAlive = false;
    this.stats.deathReason = message || 'unknown';
    this.stats.deathTime = new Date();

    // Aprende de la muerte
    this.brain.learn({
      event: 'death',
      reason: message,
      stats: this.stats,
      lesson: `Muerte por: ${message}. Necesita mejorar estrategia.`,
    });

    this.recordBadAction(`Muerte: ${message}`);
  }

  /**
   * Registra una acción buena
   */
  recordGoodAction(action) {
    this.memory.goodActions.push({
      action,
      at: new Date().toISOString(),
    });

    if (this.memory.goodActions.length > 50) {
      this.memory.goodActions.shift();
    }
  }

  /**
   * Registra una acción mala
   */
  recordBadAction(action) {
    this.memory.badActions.push({
      action,
      at: new Date().toISOString(),
    });

    if (this.memory.badActions.length > 50) {
      this.memory.badActions.shift();
    }

    // Si hay muchas acciones malas, aprende
    if (this.memory.badActions.length > 5) {
      const lessons = this.extractLessons();
      this.memory.learnedRules.push(...lessons);
    }
  }

  /**
   * Extrae lecciones de las acciones malas
   */
  extractLessons() {
    const lessons = [];
    const recentBadActions = this.memory.badActions.slice(-5).map(a => a.action);

    if (recentBadActions.some(a => a.includes('inventario'))) {
      lessons.push('Inventario lleno o vacío, necesita mejor gestión');
    }

    if (recentBadActions.some(a => a.includes('Mob'))) {
      lessons.push('Hay mobs cercanos, considerar combate o huida');
    }

    if (recentBadActions.some(a => a.includes('salud'))) {
      lessons.push('Salud baja, necesita curarse o esconderse');
    }

    return lessons;
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
      position: this.bot?.entity?.position,
    };
  }

  /**
   * Desconecta el bot
   */
  async disconnect() {
    if (this.bot) {
      this.bot.quit();
      this.isConnected = false;
    }
  }
}

export default MinecraftBot;
