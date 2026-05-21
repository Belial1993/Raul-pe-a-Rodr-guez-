/**
 * RULES ENGINE - Event-Driven Conditional Logic
 * 
 * Executes rules based on event data and conditions
 */

class RulesEngine {
  constructor() {
    this.rules = new Map();
    this.executionLog = [];
  }

  /**
   * Register a rule
   */
  registerRule(name, condition, action) {
    this.rules.set(name, {
      name,
      condition,
      action,
      registeredAt: new Date().toISOString(),
      executions: 0,
      lastExecution: null
    });
    return { success: true, ruleName: name };
  }

  /**
   * Execute rules on event
   */
  async executeRules(event) {
    const results = {
      eventId: event.eventId,
      triggeredRules: [],
      executedActions: [],
      timestamp: new Date().toISOString()
    };

    for (const [ruleName, rule] of this.rules) {
      try {
        if (rule.condition(event)) {
          rule.executions++;
          rule.lastExecution = new Date().toISOString();

          const actionResult = await rule.action(event);
          results.triggeredRules.push(ruleName);
          results.executedActions.push({
            rule: ruleName,
            action: actionResult
          });

          this.executionLog.push({
            ruleId: ruleName,
            eventId: event.eventId,
            triggered: true,
            result: actionResult,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        this.executionLog.push({
          ruleId: ruleName,
          eventId: event.eventId,
          triggered: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  /**
   * Get execution log
   */
  getExecutionLog(limit = 100) {
    return this.executionLog.slice(-limit);
  }
}

module.exports = RulesEngine;