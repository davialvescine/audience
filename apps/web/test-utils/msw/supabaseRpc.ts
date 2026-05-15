import { http, HttpResponse } from 'msw';

type RpcSuccess = { data?: unknown; status?: number; error?: undefined };
type RpcError = {
  status?: number;
  error: { message: string; code?: string; hint?: string; details?: string };
  data?: undefined;
};
type RpcOptions = RpcSuccess | RpcError;

export function mockRpc(name: string, opts: RpcOptions) {
  return http.post(`*/rest/v1/rpc/${name}`, () => {
    if ('error' in opts && opts.error) {
      return HttpResponse.json(opts.error, { status: opts.status ?? 400 });
    }
    return HttpResponse.json(opts.data ?? null, { status: opts.status ?? 200 });
  });
}
