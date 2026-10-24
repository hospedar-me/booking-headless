import { defineConfig } from '@hey-api/openapi-ts';
export default defineConfig({ input: './spec/hotel.json', output: './src/sdk', plugins: ['@hey-api/client-next','zod',{name:'@hey-api/sdk',validator:false}] });
