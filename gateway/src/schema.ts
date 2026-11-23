import {gql} from 'graphql-tag';
export const typeDefs=gql`enum SagaStatus { STARTED RESERVED CHARGED COMPLETED COMPENSATING COMPENSATED FAILED }
type Connector { id: ID! stationId: ID! type: String! powerKw: Float! status: String! }
type Station { id: ID! name: String! city: String! connectors: [Connector!]! }
type Wallet { fleetId: ID! balanceCents: Int! }
type TelemetryPoint { timestamp: String! kwh: Float! powerKw: Float! }
type Compensation { step: String! outcome: String! at: String! }
type Saga { id: ID! status: SagaStatus! fleetId: ID! stationId: ID! connectorId: ID! correlationId: ID! failureReason: String createdAt: String! updatedAt: String! compensations: [Compensation!]! }
type FeatureFlag { name: String! enabled: Boolean! updatedAt: String }
type Environment { name: String! flags: [FeatureFlag!]! }
input ReserveAndActivateInput { fleetId: ID! stationId: ID! connectorId: ID! estimatedKwh: Float! }
type Query { environment: Environment! stations: [Station!]! station(id: ID!): Station wallet(fleetId: ID!): Wallet! telemetry(sessionId: ID!): [TelemetryPoint!]! sagas(fleetId: ID, limit: Int = 50): [Saga!]! saga(id: ID!): Saga featureFlags: [FeatureFlag!]! }
type Mutation { reserveAndActivateCharge(input: ReserveAndActivateInput!): Saga! stopCharge(sagaId: ID!): Saga! setFeatureFlag(name: String!, enabled: Boolean!): FeatureFlag! topUpWallet(fleetId: ID!, amountCents: Int!): Wallet! }`;
