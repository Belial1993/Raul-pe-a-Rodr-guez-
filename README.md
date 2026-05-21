# HabwearOS - Universal Operating System

A production-ready operating system for wearables, IoT devices, robots, and distributed computing.

## Features

✅ **6-Layer Security System**
- Format validation
- Signature verification (HMAC-SHA256)
- Device authentication
- Anomaly detection
- Policy enforcement
- Sandbox isolation

✅ **7-Step Event Pipeline**
- Device to gateway
- Security validation
- Event normalization
- Rules execution
- Action dispatch
- Persistence
- Dashboard update

✅ **4-Level Self-Healing**
- Graceful restart
- Cascade failover
- Degraded mode
- Auto-scaling

✅ **Universal Data Contract**
- Single format for all devices
- Hardware agnostic
- Standardized schema

## Installation

```bash
npm install
```

## Quick Start

### Run Tests
```bash
npm test
```

### Start Server
```bash
npm start
```

## Architecture

```
Devices
  ↓
Gateway (MQTT/REST/WebSocket)
  ↓
Protection Engine (6 layers)
  ↓
Core Engines (Event, Rules, AI)
  ↓
Distributed Layer
  ↓
Database & Dashboard
```

## Security

- All events are cryptographically signed
- Device whitelist/blacklist enforcement
- Anomaly detection with 3-sigma analysis
- Rate limiting and resource quotas
- Immutable audit trail
- Automatic threat quarantine

## Supported Device Types

- **Wearables**: Pulse, O2, temperature, GPS, battery
- **Sensors**: Temperature, pressure, humidity, light
- **Robots**: Motors, servos, load cells
- **IoT**: Voltage, current, power, frequency
- **Computing**: GPU workers, edge nodes

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [ROADMAP.md](./ROADMAP.md) - 30-week implementation plan

## License

MIT
