export * from "./sdk/sdk.gen";
export { createClient, createConfig } from "./sdk/client";
export * as hotelApi from "./sdk/sdk.gen";
export { createClient as createHotelClient } from "./sdk/sdk.gen";
export type {
  Client,
  ClientOptions,
  Config,
  CreateClientConfig,
  RequestOptions,
} from "./sdk/client";
