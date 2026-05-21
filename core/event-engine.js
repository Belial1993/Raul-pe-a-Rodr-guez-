/**
 * EVENT ENGINE - HabwearOS Core Processing
 * 
 * Unified event lifecycle management:
 * 1. Receive event through gateway
 * 2. Validate format and signature
 * 3. Run anomaly detection
 * 4. Apply rules
 * 5. Execute actions
 * 6. Log and persist
 */

const { nanoid } = require('nanoid');
const ProtectionEngine = require('../protection/protection-engine');

class EventEngine {
  constructor() {
    this.protectionEngine = new ProtectionEngine();
    this.eventQueue = [];
    this.eventHistory = new Map();
    this.activeRules = new Map();
    this.subscribers = new Map(); // For real-time dashboard updates
  }

  /**
   * Main event processing pipeline
   */
  async processEvent(incomingData, devicePublicKey) {
    const eventId = `EVT-${String(nanoid(5)).padStart(5, '0')}`;
    
    const event = {
      ...incomingData,
      eventId,
      receivedAt: new Date().toISOString()
    };

    const pipeline = {
      eventId,
      steps: [],
      status: 'processing',
      result: null
    };

    try {
      // STEP 1: Security Validation (Protection Engine)
      pipeline.steps.push({
        name: 'SECURITY_VALIDATION',
        status: 'running',
        timestamp: new Date().toISOString()
      });

      const securityCheck = this.protectionEngine.validate(event, devicePublicKey);
      
      pipeline.steps[pipeline.steps.length - 1].status = securityCheck.status;
      pipeline.steps[pipeline.steps.length - 1].result = securityCheck;

      if (securityCheck.status === 'rejected') {
        pipeline.status = 'rejected';
        pipeline.result = {
          reason: 'Security validation failed',
          threatLevel: securityCheck.threatLevel,
          details: securityCheck.layers
        };
        this.logEvent(event, pipeline);
        return pipeline;
      }

      // STEP 2: Handle sandboxed events
      if (securityCheck.action === 'sandbox') {
        pipeline.steps.push({
          name: 'SANDBOX_EXECUTION',
          status: 'running',
          timestamp: new Date().toISOString(),
          sandboxId: securityCheck.sandbox.sandboxId
        });

        const sandboxResult = await this.executeSandboxed(event, securityCheck.sandbox);
        pipeline.steps[pipeline.steps.length - 1].status = 'completed';
        pipeline.steps[pipeline.steps.length - 1].result = sandboxResult;

        if (!sandboxResult.safe) {
          pipeline.status = 'quarantined';
          this.logEvent(event, pipeline);
          return pipeline;
        }
      }

      // STEP 3: Normalize and enrich
      pipeline.steps.push({
        name: 'NORMALIZATION',
        status: 'running',
        timestamp: new Date().toISOString()
      });

      const normalizedEvent = this.normalizeEvent(event);
      pipeline.steps[pipeline.steps.length - 1].status = 'completed';
      pipeline.steps[pipeline.steps.length - 1].result = normalizedEvent;

      // STEP 4: Apply Rules Engine
      pipeline.steps.push({
        name: 'RULES_ENGINE',
        status: 'running',
        timestamp: new Date().toISOString()
      });

      const ruleResults = await this.applyRules(normalizedEvent);
      pipeline.steps[pipeline.steps.length - 1].status = 'completed';
      pipeline.steps[pipeline.steps.length - 1].result = ruleResults;

      // STEP 5: Execute Actions
      pipeline.steps.push({
        name: 'ACTION_EXECUTION',
        status: 'running',
        timestamp: new Date().toISOString()
      });

      const executedActions = await this.executeActions(normalizedEvent, ruleResults);
      pipeline.steps[pipeline.steps.length - 1].status = 'completed';
      pipeline.steps[pipeline.steps.length - 1].result = executedActions;

      // STEP 6: Persist to Database
      pipeline.steps.push({
        name: 'PERSISTENCE',
        status: 'running',
        timestamp: new Date().toISOString()
      });

      const persistResult = await this.persistEvent(normalizedEvent, pipeline);
      pipeline.steps[pipeline.steps.length - 1].status = 'completed';
      pipeline.steps[pipeline.steps.length - 1].result = persistResult;

      // STEP 7: Notify Dashboard
      pipeline.steps.push({
        name: 'DASHBOARD_UPDATE',
        status: 'running',
        timestamp: new Date().toISOString()
      });

      await this.notifyDashboard(normalizedEvent, executedActions);
      pipeline.steps[pipeline.steps.length - 1].status = 'completed';

      pipeline.status = 'completed';
      pipeline.result = {
        success: true,
        eventId,
        ruleResults,
        actions: executedActions
      };

    } catch (error) {
      pipeline.status = 'error';
      pipeline.result = {
        error: error.message,
        stack: error.stack
      };
      console.error('[EVENT_ENGINE_ERROR]', error);
    }

    this.logEvent(event, pipeline);
    return pipeline;
  }

  /**
   * Execute event in sandboxed environment
   */
  async executeSandboxed(event, sandbox) {
    const startTime = Date.now();
    const result = {
      sandboxId: sandbox.sandboxId,
      safe: true,
      resourceUsage: {
        memory: 0,
        cpu: 0
      },
      timeout: false,
      exceptions: []
    };

    try {
      // Simulate sandboxed execution with timeout
      const executionPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          result.timeout = true;
          result.safe = false;
          reject(new Error('Sandbox execution timeout'));
        }, sandbox.restrictions.timeout);

        // Execute limited operations on event
        try {
          // Only allow read operations in sandbox
          const processed = {
            eventId: event.eventId,
            deviceId: event.deviceId,
            type: event.type,
            value: event.value // No modification allowed
          };

          clearTimeout(timeout);
          resolve(processed);
        } catch (err) {
          clearTimeout(timeout);
          reject(err);
        }
      });

      await executionPromise;

      result.resourceUsage.memory = Math.random() * 20; // Simulated
      result.resourceUsage.cpu = Math.random() * 5; // Simulated
      result.executionTime = Date.now() - startTime;

    } catch (error) {
      result.safe = false;
      result.exceptions.push(error.message);
    }

    return result;
  }

  /**
   * Normalize event data
   */
  normalizeEvent(event) {
    return {
      eventId: event.eventId,
      deviceId: event.deviceId,
      source: event.source,
      type: event.type,
      value: parseFloat(event.value),
      unit: event.unit,
      priority: event.priority || 'medium',
      timestamp: new Date(event.timestamp).toISOString(),
      signature: event.signature,
      receivedAt: event.receivedAt,
      processedAt: new Date().toISOString()
    };
  }

  /**
   * Apply registered rules to event
   */
  async applyRules(event) {
    const results = {
      triggered: [],
      evaluated: []
    };

    // Default rules
    const defaultRules = [
      {
        name: 'TEMPERATURE_CRITICAL',
        condition: e => e.type === 'temperature' && e.value > 80,
        action: { type: 'ALERT', severity: 'critical' }
      },
      {
        name: 'BATTERY_LOW',
        condition: e => e.type === 'battery' && e.value < 15,
        action: { type: 'POWER_SAVE', severity: 'high' }
      },
      {
        name: 'GPS_EMERGENCY',
        condition: e => e.type === 'gps' && e.priority === 'critical',
        action: { type: 'EMERGENCY_LOCATION', severity: 'critical' }
      },
      {
        name: 'PULSE_ABNORMAL',
        condition: e => e.type === 'pulse' && (e.value < 40 || e.value > 180),
        action: { type: 'MEDICAL_ALERT', severity: 'high' }
      }
    ];

    for (const rule of defaultRules) {
      results.evaluated.push(rule.name);
      
      try {
        if (rule.condition(event)) {
          results.triggered.push({
            rule: rule.name,
            action: rule.action,
            triggeredAt: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.name}:`, error);
      }
    }

    return results;
  }

  /**
   * Execute actions from triggered rules
   */
  async executeActions(event, ruleResults) {
    const executed = [];

    for (const triggered of ruleResults.triggered) {
      const action = triggered.action;
      
      try {
        const result = {
          action: action.type,
          event: event.eventId,
          status: 'executed',
          timestamp: new Date().toISOString(),
          response: null
        };

        switch (action.type) {
          case 'ALERT':
            result.response = await this.sendAlert(event, action);
            break;

          case 'POWER_SAVE':
            result.response = await this.triggerPowerSave(event.deviceId);
            break;

          case 'EMERGENCY_LOCATION':
            result.response = await this.broadcastEmergencyLocation(event);
            break;

          case 'MEDICAL_ALERT':
            result.response = await this.sendMedicalAlert(event);
            break;

          default:
            result.status = 'skipped';
        }

        executed.push(result);

      } catch (error) {
        executed.push({
          action: action.type,
          event: event.eventId,
          status: 'error',
          error: error.message
        });
      }
    }

    return executed;
  }

  /**
   * Persist event to database
   */
  async persistEvent(event, pipeline) {
    // In production, write to TimescaleDB or similar
    const record = {
      id: event.eventId,
      deviceId: event.deviceId,
      data: event,
      pipeline: {
        steps: pipeline.steps.map(s => ({ name: s.name, status: s.status })),
        status: pipeline.status
      },
      storedAt: new Date().toISOString()
    };

    // Simulate database write
    this.eventHistory.set(event.eventId, record);

    return {
      stored: true,
      id: event.eventId,
      location: 'TimescaleDB'
    };
  }

  /**
   * Notify dashboard subscribers
   */
  async notifyDashboard(event, actions) {
    const notification = {
      type: 'EVENT_PROCESSED',
      event: {
        eventId: event.eventId,
        deviceId: event.deviceId,
        type: event.type,
        value: event.value,
        unit: event.unit
      },
      actions: actions.filter(a => a.status === 'executed'),
      timestamp: new Date().toISOString()
    };

    // Broadcast to all connected websocket subscribers
    for (const subscriber of this.subscribers.values()) {
      try {
        subscriber(notification);
      } catch (error) {
        console.error('Error notifying subscriber:', error);
      }
    }

    return true;
  }

  /**
   * Log event to audit trail
   */
  logEvent(event, pipeline) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      eventId: event.eventId,
      deviceId: event.deviceId,
      pipelineStatus: pipeline.status,
      steps: pipeline.steps.length,
      result: pipeline.result
    };

    console.log('[EVENT_LOG]', JSON.stringify(logEntry, null, 2));
  }

  // Action implementations
  async sendAlert(event, action) {
    console.log(`[ALERT] ${action.severity}: ${event.type} = ${event.value}`);
    return { sent: true, channels: ['dashboard', 'email', 'sms'] };
  }

  async triggerPowerSave(deviceId) {
    console.log(`[POWER_SAVE] Activated for ${deviceId}`);
    return { activated: true };
  }

  async broadcastEmergencyLocation(event) {
    console.log(`[EMERGENCY] Location broadcast from ${event.deviceId}`);
    return { broadcast: true };
  }

  async sendMedicalAlert(event) {
    console.log(`[MEDICAL_ALERT] Pulse = ${event.value} bpm`);
    return { sent: true };
  }

  // Subscribe to events
  subscribe(id, callback) {
    this.subscribers.set(id, callback);
    return () => this.subscribers.delete(id);
  }

  // Get event history
  getEventHistory(deviceId, limit = 100) {
    const events = [];
    for (const [, record] of this.eventHistory) {
      if (!deviceId || record.deviceId === deviceId) {
        events.push(record);
      }
      if (events.length >= limit) break;
    }
    return events;
  }
}

module.exports = EventEngine;
