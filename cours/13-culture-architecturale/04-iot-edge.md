# Cours 87 — IoT & Edge Architecture

> **Objectif** : Comprendre l'architecture IoT (devices contraints, MQTT, edge processing), maîtriser les time-series databases, et connaitre les patterns de sécurité IoT (firmware updates, certificate rotation).

---

## Rappel du cours précédent

<details>
<summary>1. Quand la blockchain fait-elle sens et quand est-elle inutile ?</summary>

La blockchain fait sens quand : **pas de tiers de confiance** entre les parties, besoin de traçabilité immutable, tokens/actifs numériques. Elle est inutile (99% des cas) quand : tu as un tiers de confiance (une DB suffit), les données changent souvent, tu as besoin de performances, ou tu controles le système.
</details>

<details>
<summary>2. Qu'est-ce qu'un smart contract et quel est son principal risque ?</summary>

Un smart contract est du **code auto-exécuté** sur la blockchain quand les conditions sont remplies (ex: libérer un paiement quand la livraison est confirmee). Le principal risque : le code est **immutable** — un bug dans un smart contract est permanent et ne peut pas etre corrige (cf. le hack de "The DAO" en 2016 : $60M voles a cause d'un bug de reentrancy).
</details>

---

## Analogie — Le réseau de capteurs dans un vignoble

Un vigneron installe des capteurs dans son vignoble :
- **Les capteurs** (IoT devices) : temperature, humidite, pH du sol — autonomes, alimentes par batterie
- **Le concentrateur** (edge gateway) : collecte les données de 50 capteurs, filtre, agrege, et envoie au cloud toutes les 15 min
- **Le cloud** : stocke l'historique, généré des alertes, predit les maladies de la vigne
- **Le problème** : chaque capteur a 1MB de RAM, un processeur a 80MHz, et une batterie de 2 ans

Les memes patterns que le web (résilience, async, offline), pousses a l'extreme.

---

## Théorie

### 1. Architecture IoT

```
┌────────────┐   ┌────────────┐   ┌────────────────┐   ┌──────────┐
│  Devices   │──>│   Edge     │──>│    Cloud        │──>│Dashboard │
│  (sensors, │   │  Gateway   │   │  (Processing)   │   │  (Web)   │
│   actuators)│   │  (filter,  │   │  (Store,        │   │          │
│            │   │   aggregate)│   │   Analyze, ML)  │   │          │
└────────────┘   └────────────┘   └────────────────┘   └──────────┘
    MQTT              MQTT/HTTP          HTTP/gRPC
    BLE               Edge Computing     Time-series DB
    LoRaWAN                              Stream processing
```

### 2. Contraintes des devices IoT

| Contrainte | Impact | Solution |
|---|---|---|
| **CPU** (80MHz-240MHz) | Pas de crypto lourde | TLS 1.3 pre-shared key, DTLS |
| **RAM** (1KB-512KB) | Pas de frameworks | Code C/MicroPython minimal |
| **Batterie** (2-10 ans) | Pas de connexion permanente | Sleep modes, transmission periodique |
| **Réseau** (intermittent) | Pas de HTTP classique | MQTT QoS, store-and-forward |
| **Sécurité** (pas de mise a jour facile) | Firmware vulnerables | OTA updates, certificate rotation |

### 3. MQTT — le protocole IoT

```
MQTT = Message Queuing Telemetry Transport
  - Publish/Subscribe (comme un event bus)
  - Tres leger (header 2 bytes minimum)
  - 3 niveaux de QoS :

QoS 0 : At most once (fire-and-forget)
  → Rapide, pas de garantie
  → Usage : temperature toutes les secondes

QoS 1 : At least once (avec ack)
  → Le message arrive au moins une fois (possibles doublons)
  → Usage : alertes, commandes

QoS 2 : Exactly once (4-way handshake)
  → Garanti exactement une fois, mais lent
  → Usage : paiements, operations critiques

Topics :
  sensors/vineyard-1/temperature
  sensors/vineyard-1/humidity
  actuators/vineyard-1/irrigation/command
```

### 4. Edge processing

```
SANS edge processing :
  50 capteurs × 1 mesure/s × 24h = 4.3M messages/jour → cloud
  Cout : reseau + stockage + compute

AVEC edge processing :
  Edge gateway agrege : moyenne sur 15min → 4,800 messages/jour
  Alerte locale : si temp > 35°C → activer irrigation immediatement
  (pas besoin d'aller au cloud pour une decision urgente)

Reduction : 99.9% de trafic en moins
```

### 5. Time-series databases

```
Donnees IoT = time-series (timestamp, valeur, tags)

┌──────────────────────────────────────────────────┐
│  timestamp          │ device    │ temp │ humidity │
│ 2024-03-01 14:00:00 │ sensor-01 │ 22.3 │ 65       │
│ 2024-03-01 14:00:00 │ sensor-02 │ 21.8 │ 67       │
│ 2024-03-01 14:00:01 │ sensor-01 │ 22.4 │ 64       │
└──────────────────────────────────────────────────┘

Bases time-series :
  TimescaleDB (extension PostgreSQL)
  InfluxDB
  QuestDB

Avantages vs SQL classique :
  - Compression temporelle (90%+ de reduction)
  - Retention policies automatiques (supprimer apres 30j)
  - Downsampling (1s → 1min → 1h → 1j)
  - Requetes temporelles optimisees (WHERE time > '2024-03-01')
```

### 6. Digital twins

```
Un digital twin = une representation virtuelle d'un objet physique

Device reel (capteur)         Digital Twin (cloud)
┌──────────────┐              ┌──────────────────┐
│ temp: 22.3°C │──sync───────>│ temp: 22.3°C     │
│ humidity: 65%│              │ humidity: 65%     │
│ battery: 87% │              │ battery: 87%      │
│              │              │ predicted_temp: 25│
│              │              │ alert: false      │
│              │              │ last_seen: 14:00  │
└──────────────┘              └──────────────────┘

Le digital twin permet :
  - Simuler sans toucher au reel
  - Predire les pannes (ML sur l'historique)
  - Monitorer a distance
  - Tester des changements de config virtuellement
```

---

## Pratique

### MQTT message handler

```typescript
// Edge gateway — collecte et agrege les messages MQTT
import mqtt from 'mqtt';

interface SensorReading {
  deviceId: string;
  temperature: number;
  humidity: number;
  timestamp: string;
}

class EdgeGateway {
  private buffer: Map<string, SensorReading[]> = new Map();
  private readonly FLUSH_INTERVAL = 15 * 60 * 1000; // 15 min

  constructor(private readonly mqttClient: mqtt.MqttClient) {
    // Souscrire aux topics des capteurs
    mqttClient.subscribe('sensors/+/+');

    mqttClient.on('message', (topic, payload) => {
      const reading = JSON.parse(payload.toString()) as SensorReading;
      this.handleReading(topic, reading);
    });

    // Flush periodique vers le cloud
    setInterval(() => this.flushToCloud(), this.FLUSH_INTERVAL);
  }

  private handleReading(topic: string, reading: SensorReading): void {
    // Alerte locale immediate (pas besoin du cloud)
    if (reading.temperature > 35) {
      this.mqttClient.publish(
        `actuators/${reading.deviceId}/irrigation/command`,
        JSON.stringify({ action: 'start', duration: 300 }),
      );
    }

    // Buffer pour aggregation
    const deviceBuffer = this.buffer.get(reading.deviceId) ?? [];
    deviceBuffer.push(reading);
    this.buffer.set(reading.deviceId, deviceBuffer);
  }

  private async flushToCloud(): Promise<void> {
    for (const [deviceId, readings] of this.buffer) {
      if (readings.length === 0) continue;

      // Agreger : moyenne sur la periode
      const aggregated = {
        deviceId,
        avgTemperature: readings.reduce((s, r) => s + r.temperature, 0) / readings.length,
        avgHumidity: readings.reduce((s, r) => s + r.humidity, 0) / readings.length,
        minTemperature: Math.min(...readings.map((r) => r.temperature)),
        maxTemperature: Math.max(...readings.map((r) => r.temperature)),
        sampleCount: readings.length,
        periodStart: readings[0].timestamp,
        periodEnd: readings[readings.length - 1].timestamp,
      };

      await fetch(`${process.env.CLOUD_API}/api/telemetry`, {
        method: 'POST',
        body: JSON.stringify(aggregated),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    this.buffer.clear();
  }
}
```

### TimescaleDB query examples

```sql
-- Creer une hypertable (time-series optimisee)
CREATE TABLE sensor_data (
    time        TIMESTAMPTZ NOT NULL,
    device_id   TEXT NOT NULL,
    temperature DOUBLE PRECISION,
    humidity    DOUBLE PRECISION
);
SELECT create_hypertable('sensor_data', 'time');

-- Moyenne par heure sur les 7 derniers jours
SELECT
    time_bucket('1 hour', time) AS hour,
    device_id,
    AVG(temperature) AS avg_temp,
    MAX(temperature) AS max_temp
FROM sensor_data
WHERE time > NOW() - INTERVAL '7 days'
GROUP BY hour, device_id
ORDER BY hour DESC;

-- Retention automatique (supprimer les donnees > 90 jours)
SELECT add_retention_policy('sensor_data', INTERVAL '90 days');

-- Aggregation continue (materialiser les moyennes horaires)
CREATE MATERIALIZED VIEW sensor_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS hour,
    device_id,
    AVG(temperature) AS avg_temp,
    AVG(humidity) AS avg_humidity
FROM sensor_data
GROUP BY hour, device_id;
```

---

## Resume

1. **Architecture IoT** : devices contraints → edge gateway (filtrage, aggregation) → cloud (stockage, ML, dashboards)
2. **MQTT** : protocole pub/sub ultra-léger (2 bytes header), 3 niveaux QoS (fire-and-forget, at-least-once, exactly-once)
3. **Edge processing** : réduire 99%+ du trafic réseau en agregeant localement, alertes en temps reel sans cloud
4. **Time-series DB** (TimescaleDB, InfluxDB) : compression, retention automatique, downsampling — optimisees pour les données temporelles
5. **Sécurité IoT** : OTA firmware updates, certificate rotation, DTLS pour devices contraints — les memes principes que le web, adaptes aux contraintes

---

> **Prochain cours** : [Cours 88 — Collaboration temps reel (CRDT, OT)](./05-crdt-collaboration.md)

---

> **Lien fil rouge — ShopArch**
>
> - Réfléchis : dans quel cas ShopArch aurait besoin d'edge computing ? (CDN edge functions pour la personnalisation, géolocalisation des entrepôts)
> - Évalue les edge functions (Cloudflare Workers, Vercel Edge) pour le BFF ShopArch
> - Checkpoint : Module 13, critère 4
