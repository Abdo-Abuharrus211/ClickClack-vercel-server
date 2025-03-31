/**
 * This file generates the Swagger documentation for the ClickClack API using swagger-autogen.
 * 
 * If you need to update docs, just update the swagger-output.json file
 *
 */

import swaggerAutogenFactory from 'swagger-autogen';

const swaggerAutogen = swaggerAutogenFactory();

const doc = {
  info: {
    title: 'ClickClack API',
    description: 'API documentation for the ClickClack typing test app.',
  },
  host: 'localhost:3001', 
  schemes: ['http'],    
};

const outputFile = './swagger-output.json';
const routes = ['./index.js']; 

swaggerAutogen(outputFile, routes, doc);