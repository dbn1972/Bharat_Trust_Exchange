import fs from 'node:fs';

export function ok(name, details = {}) {
  console.log(JSON.stringify({ check: name, status: 'PASS', details }, null, 2));
  process.exit(0);
}

export function pending(name, reason, details = {}) {
  console.log(JSON.stringify({ check: name, status: 'PENDING', reason, details }, null, 2));
  process.exit(0);
}

export function fail(name, reason, details = {}) {
  console.error(JSON.stringify({ check: name, status: 'FAIL', reason, details }, null, 2));
  process.exit(1);
}

export function hasPath(p) {
  try {
    const st = fs.statSync(p);
    return st.isFile() || st.isDirectory();
  } catch {
    return false;
  }
}
