import http from 'k6/http';
import { check } from 'k6';

export default function () {
  const res = http.post('http://localhost:3002/v1/consents/demo/revoke', JSON.stringify({}), {
    headers: {
      'content-type': 'application/json',
      'idempotency-key': 'k6-demo-1'
    }
  });
  check(res, { 'status is 200/202': (r) => r.status === 200 || r.status === 202 });
}
