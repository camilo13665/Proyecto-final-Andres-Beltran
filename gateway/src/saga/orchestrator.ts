import axios, { AxiosInstance } from 'axios';
import { randomUUID } from 'crypto';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

export type SagaStatus = 'STARTED'|'RESERVED'|'CHARGED'|'COMPLETED'|'COMPENSATING'|'COMPENSATED'|'FAILED';
export type Compensation = { step: string; outcome: string; at: string };
export type SagaInput = { fleetId: string; stationId: string; connectorId: string; estimatedKwh: number };
export type SagaRecord = {
  id: string;
  status: SagaStatus;
  fleetId: string;
  stationId: string;
  connectorId: string;
  correlationId: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  compensations: Compensation[];
};

export type SagaDependencies = {
  http?: AxiosInstance;
  db?: DynamoDBDocumentClient;
  tableName?: string;
  sleep?: (milliseconds: number) => Promise<void>;
};

/** Orquestador de la SAGA. El gateway coordina; ningún microservicio lee tablas ajenas. */
export class SagaOrchestrator {
  private readonly http: AxiosInstance;
  private readonly db?: DynamoDBDocumentClient;
  private readonly tableName: string;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(dependencies: SagaDependencies = {}) {
    this.http = dependencies.http || axios;
    this.db = dependencies.db;
    this.tableName = dependencies.tableName || `aegisvolt-sagas-${process.env.APP_ENV || 'dev'}`;
    this.sleep = dependencies.sleep || ((milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds)));
  }

  private now = () => new Date().toISOString();

  private async save(saga: SagaRecord, eventStep: string, outcome: string): Promise<void> {
    if (!this.db) return;
    const timestamp = this.now();
    await this.db.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        pk: `SAGA#${saga.id}`,
        sk: 'META',
        status: saga.status,
        fleet_id: saga.fleetId,
        station_id: saga.stationId,
        connector_id: saga.connectorId,
        correlation_id: saga.correlationId,
        created_at: saga.createdAt,
        updated_at: timestamp,
        failure_reason: saga.failureReason,
        compensations: saga.compensations,
      },
    }));
    await this.db.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        pk: `SAGA#${saga.id}`,
        sk: `EVENT#${timestamp}#${eventStep}`,
        step: eventStep,
        outcome,
      },
    }));
  }

  private headers(correlationId: string) {
    return { 'x-correlation-id': correlationId };
  }

  private async retry(operation: () => Promise<void>): Promise<boolean> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await operation();
        return true;
      } catch {
        if (attempt < 3) await this.sleep(100 * attempt);
      }
    }
    return false;
  }

  private compensation(saga: SagaRecord, step: string, outcome: string): void {
    saga.compensations.push({ step, outcome, at: this.now() });
  }

  async execute(input: SagaInput, correlationId: string): Promise<SagaRecord> {
    const id = randomUUID();
    const timestamp = this.now();
    const saga: SagaRecord = {
      id,
      status: 'STARTED',
      fleetId: input.fleetId,
      stationId: input.stationId,
      connectorId: input.connectorId,
      correlationId,
      createdAt: timestamp,
      updatedAt: timestamp,
      compensations: [],
    };

    await this.save(saga, 'STARTED', 'STARTED');

    // Paso 1: reservar conector.
    try {
      await this.http.post(
        `${reservationUrl()}/reservations`,
        { saga_id: id, station_id: input.stationId, connector_id: input.connectorId, fleet_id: input.fleetId },
        { headers: this.headers(correlationId) },
      );
      saga.status = 'RESERVED';
      saga.updatedAt = this.now();
      await this.save(saga, 'RESERVATION', 'RESERVED');
    } catch (error) {
      saga.status = 'FAILED';
      saga.failureReason = errorMessage(error);
      await this.save(saga, 'RESERVATION', 'FAILED');
      return saga;
    }

    // Paso 2: cobrar la billetera.
    try {
      await this.http.post(
        `${billingUrl()}/charges`,
        { saga_id: id, fleet_id: input.fleetId, estimated_kwh: input.estimatedKwh },
        { headers: this.headers(correlationId) },
      );
      saga.status = 'CHARGED';
      saga.updatedAt = this.now();
      await this.save(saga, 'BILLING', 'CHARGED');
    } catch (error) {
      saga.status = 'COMPENSATING';
      await this.save(saga, 'BILLING', 'FAILED');
      const released = await this.retry(() => this.http.post(`${reservationUrl()}/reservations/${id}/release`, {}, { headers: this.headers(correlationId) }));
      if (released) {
        this.compensation(saga, 'RELEASE', 'AVAILABLE');
        saga.status = 'COMPENSATED';
        saga.failureReason = errorMessage(error);
        await this.save(saga, 'RELEASE', 'AVAILABLE');
      } else {
        saga.status = 'FAILED';
        saga.failureReason = 'Compensation release failed after 3 attempts';
        await this.save(saga, 'RELEASE', 'FAILED');
      }
      return saga;
    }

    // Paso 3: activar despacho físico.
    try {
      await this.http.post(
        `${dispatchUrl()}/sessions`,
        { saga_id: id, station_id: input.stationId, connector_id: input.connectorId, fleet_id: input.fleetId },
        { headers: this.headers(correlationId) },
      );
      await this.http.post(`${reservationUrl()}/reservations/${id}/confirm`, {}, { headers: this.headers(correlationId) });
      saga.status = 'COMPLETED';
      saga.updatedAt = this.now();
      await this.save(saga, 'DISPATCH', 'COMPLETED');
      await this.save(saga, 'CONFIRM', 'IN_USE');
    } catch (error) {
      saga.status = 'COMPENSATING';
      await this.save(saga, 'DISPATCH', 'FAILED');

      // Orden obligatorio: primero reembolso, luego liberación.
      const refunded = await this.retry(() => this.http.post(`${billingUrl()}/charges/${id}/refund`, {}, { headers: this.headers(correlationId) }));
      if (refunded) this.compensation(saga, 'REFUND', 'REFUNDED');

      const released = await this.retry(() => this.http.post(`${reservationUrl()}/reservations/${id}/release`, {}, { headers: this.headers(correlationId) }));
      if (released) this.compensation(saga, 'RELEASE', 'AVAILABLE');

      if (refunded && released) {
        saga.status = 'COMPENSATED';
        saga.failureReason = errorMessage(error);
        await this.save(saga, 'COMPENSATION', 'COMPENSATED');
      } else {
        saga.status = 'FAILED';
        saga.failureReason = 'Physical dispatch compensation failed after retries';
        await this.save(saga, 'COMPENSATION', 'FAILED');
      }
    }

    return saga;
  }
}

function reservationUrl() { return process.env.RESERVATION_URL || 'http://localhost:4001'; }
function billingUrl() { return process.env.BILLING_URL || 'http://localhost:4002'; }
function dispatchUrl() { return process.env.DISPATCH_URL || 'http://localhost:4003'; }
function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string; message?: string } } }).response;
    return response?.data?.message || response?.data?.error || 'REST service error';
  }
  return error instanceof Error ? error.message : 'Unknown error';
}
