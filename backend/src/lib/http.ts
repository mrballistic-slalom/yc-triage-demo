import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

export function ok<T>(body: T): APIGatewayProxyStructuredResultV2 {
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

export function created<T>(body: T): APIGatewayProxyStructuredResultV2 {
  return { statusCode: 201, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

export function noContent(): APIGatewayProxyStructuredResultV2 {
  return { statusCode: 204, headers: CORS_HEADERS, body: '' };
}

export function badRequest(message: string): APIGatewayProxyStructuredResultV2 {
  return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ message }) };
}

export function notFound(message = 'Not found'): APIGatewayProxyStructuredResultV2 {
  return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ message }) };
}

export function serverError(message: string): APIGatewayProxyStructuredResultV2 {
  return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ message }) };
}

export function preflight(): APIGatewayProxyStructuredResultV2 {
  return { statusCode: 204, headers: CORS_HEADERS, body: '' };
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

export function parseBody<T>(event: APIGatewayProxyEventV2): T {
  if (!event.body) return {} as T;
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf-8')
    : event.body;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new BadRequestError('Invalid JSON body');
  }
}

export function pathParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.pathParameters?.[key];
}

export function queryParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.queryStringParameters?.[key];
}

type RouteHandler = (
  event: APIGatewayProxyEventV2,
) => Promise<APIGatewayProxyStructuredResultV2> | APIGatewayProxyStructuredResultV2;

export function createRouter(
  logName: string,
  routes: Record<string, RouteHandler>,
): APIGatewayProxyHandlerV2 {
  return async (event) => {
    const e = event as APIGatewayProxyEventV2;
    const method = e.requestContext.http.method;
    if (method === 'OPTIONS') return preflight();
    const route = e.routeKey ?? `${method} ${e.rawPath}`;
    const handler = routes[route];
    if (!handler) return notFound(`Route ${route} not implemented`);
    try {
      return await handler(e);
    } catch (err) {
      if (err instanceof BadRequestError) return badRequest(err.message);
      console.error(`${logName} handler error`, err);
      return serverError((err as Error).message);
    }
  };
}
