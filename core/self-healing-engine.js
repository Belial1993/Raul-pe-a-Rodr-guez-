/**
 * SELF-HEALING ENGINE - Automatic Recovery System
 * 
 * Strategies:
 * 1. Graceful Restart - Preserve state and restart
 * 2. Cascade Failover - Promote healthy replicas
 * 3. Degraded Mode - Read-only operations
 * 4. Auto-Scaling - Provision new instances
 */

const { nanoid } = require('nanoid');

class SelfHealingEngine {
  constructor() {
    this.services = new Map();
    this.replicas = new Map();
    this.recoveryHistory = [];
    this.degradedMode = false;
  }

  /**
   * Monitor service health
   */
  async checkHealth(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) return { status: 'unknown' };

    try {
      const health = await service.healthCheck();
      service.lastHealthCheck = new Date().toISOString();
      service.status = health.status || 'healthy';
      return health;
    } catch (error) {
      service.status = 'unhealthy';
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Strategy 1: Graceful Restart
   */
  async gracefulRestart(serviceName) {
    console.log(`[RECOVERY] Graceful restart: ${serviceName}`);

    const service = this.services.get(serviceName);
    if (!service) return { success: false, reason: 'Service not found' };

    const recovery = {
      recoveryId: `REC-${nanoid(6)}`,
      timestamp: new Date().toISOString(),
      serviceName,
      strategy: 'GRACEFUL_RESTART',
      attempts: service.restartAttempts || 0,
      result: null
    };

    try {
      // Save state
      const state = await service.saveState?.();
      service.restartAttempts = (service.restartAttempts || 0) + 1;

      // Wait with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, service.restartAttempts), 30000);
      console.log(`[RECOVERY] Waiting ${delay}ms before restart attempt ${service.restartAttempts}`);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Restart
      if (service.restart) {
        await service.restart();
      }

      // Restore state
      if (service.restoreState && state) {
        await service.restoreState(state);
      }

      // Verify health
      const health = await this.checkHealth(serviceName);
      if (health.status === 'healthy') {
        service.restartAttempts = 0;
        recovery.result = 'SUCCESS';
        recovery.duration = Date.now() - new Date(recovery.timestamp).getTime();
      } else {
        recovery.result = 'PARTIAL';
      }
    } catch (error) {
      recovery.result = 'FAILED';
      recovery.error = error.message;

      if (service.restartAttempts >= 3) {
        console.log(`[RECOVERY] Max restart attempts reached, escalating...`);
        return await this.cascadeFailover(serviceName);
      }
    }

    this.recoveryHistory.push(recovery);
    return recovery;
  }

  /**
   * Strategy 2: Cascade Failover
   */
  async cascadeFailover(serviceName) {
    console.log(`[RECOVERY] Cascade failover: ${serviceName}`);

    const recovery = {
      recoveryId: `REC-${nanoid(6)}`,
      timestamp: new Date().toISOString(),
      serviceName,
      strategy: 'CASCADE_FAILOVER',
      result: null
    };

    try {
      const primaryService = this.services.get(serviceName);
      const serviceReplicas = this.replicas.get(serviceName) || [];

      // Find healthy replica
      let healthyReplica = null;
      for (const replica of serviceReplicas) {
        const health = await this.checkHealth(replica.id);
        if (health.status === 'healthy') {
          healthyReplica = replica;
          break;
        }
      }

      if (!healthyReplica) {
        recovery.result = 'FAILED';
        recovery.reason = 'No healthy replicas available';
        console.log(`[RECOVERY] No healthy replicas, activating degraded mode...`);
        return await this.degradedModeActivation(serviceName);
      }

      // Promote replica to primary
      const state = await primaryService.saveState?.();
      if (healthyReplica.restoreState && state) {
        await healthyReplica.restoreState(state);
      }

      this.services.set(serviceName, healthyReplica);
      recovery.result = 'SUCCESS';
      recovery.promotedReplica = healthyReplica.id;
      recovery.duration = Date.now() - new Date(recovery.timestamp).getTime();
    } catch (error) {
      recovery.result = 'FAILED';
      recovery.error = error.message;
    }

    this.recoveryHistory.push(recovery);
    return recovery;
  }

  /**
   * Strategy 3: Degraded Mode
   */
  async degradedModeActivation(serviceName) {
    console.log(`[RECOVERY] Activating degraded mode for ${serviceName}`);

    const recovery = {
      recoveryId: `REC-${nanoid(6)}`,
      timestamp: new Date().toISOString(),
      serviceName,
      strategy: 'DEGRADED_MODE',
      result: 'SUCCESS'
    };

    try {
      this.degradedMode = true;
      const service = this.services.get(serviceName);
      if (service) {
        service.degradedMode = true;
        service.readOnly = true;
        recovery.capabilities = 'READ_ONLY';
      }
    } catch (error) {
      recovery.result = 'PARTIAL';
      recovery.error = error.message;
    }

    this.recoveryHistory.push(recovery);
    return recovery;
  }

  /**
   * Strategy 4: Auto-Scaling
   */
  async autoScaling(serviceName) {
    console.log(`[RECOVERY] Auto-scaling ${serviceName}`);

    const recovery = {
      recoveryId: `REC-${nanoid(6)}`,
      timestamp: new Date().toISOString(),
      serviceName,
      strategy: 'AUTO_SCALING',
      result: null
    };

    try {
      const serviceReplicas = this.replicas.get(serviceName) || [];
      const minReplicas = 2;
      const newReplicasNeeded = Math.max(minReplicas - serviceReplicas.length, 1);

      const newInstances = [];
      for (let i = 0; i < newReplicasNeeded; i++) {
        const newInstance = {
          id: `${serviceName}-replica-${nanoid(4)}`,
          createdAt: new Date().toISOString(),
          status: 'healthy'
        };
        newInstances.push(newInstance);
        serviceReplicas.push(newInstance);
      }

      this.replicas.set(serviceName, serviceReplicas);
      recovery.result = 'SUCCESS';
      recovery.newInstances = newInstances.length;
      recovery.duration = Date.now() - new Date(recovery.timestamp).getTime();
    } catch (error) {
      recovery.result = 'FAILED';
      recovery.error = error.message;
    }

    this.recoveryHistory.push(recovery);
    return recovery;
  }

  /**
   * Register service
   */
  registerService(name, service) {
    this.services.set(name, {
      ...service,
      name,
      status: 'healthy',
      registeredAt: new Date().toISOString(),
      restartAttempts: 0
    });
    return { success: true, serviceName: name };
  }

  /**
   * Register replica
   */
  registerReplica(serviceName, replica) {
    if (!this.replicas.has(serviceName)) {
      this.replicas.set(serviceName, []);
    }
    this.replicas.get(serviceName).push(replica);
    return { success: true, replicaId: replica.id };
  }

  /**
   * Get recovery history
   */
  getRecoveryHistory(limit = 100) {
    return this.recoveryHistory.slice(-limit);
  }

  /**
   * Get system status
   */
  getSystemStatus() {
    const status = {
      timestamp: new Date().toISOString(),
      degradedMode: this.degradedMode,
      services: {},
      replicasPerService: {}
    };

    for (const [name, service] of this.services) {
      status.services[name] = {
        status: service.status,
        restartAttempts: service.restartAttempts || 0
      };
    }

    for (const [name, replicas] of this.replicas) {
      status.replicasPerService[name] = replicas.length;
    }

    return status;
  }
}

module.exports = SelfHealingEngine;