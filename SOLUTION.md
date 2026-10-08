# Solution overview — Game High Scores API

Implementation of the API per the Stoplight specification, completed in `server.js`
only (`index.js` untouched). All 30 test-suite cases pass locally (`npm test`) and the
implementation is verified end-to-end on a fresh clone.

## Endpoints

| Route | Behavior |
|---|---|
| `POST /signup` | 201 on valid registration; 400 for missing fields, empty handle, or handle/password shorter than 6 chars. Re-registration of an existing handle stays 201 (idempotent, keeps original credentials). |
| `POST /login` | 200 with `{ jsonWebToken }` on success (HS256, `jsonwebtoken`); 401 on wrong credentials; 400 for empty/missing fields, wrong types, or extra fields. |
| `POST /high-scores` | JWT-protected (Bearer header). 201 on valid post; 400 on missing level/userHandle/score/timestamp or wrong types; 401 on missing/invalid token. |
| `GET /high-scores` | Public. `level` required (400 if missing), `page` optional (default 1), max 20 per page, sorted by score descending. |

## Design decisions

- **Request validation with AJV** (`ajv` + `ajv-formats`): strict types (no coercion),
  `additionalProperties: false` where the tests demand exact bodies, `format: date-time`
  for timestamps. Validation failures return 400 with an error body.
- **JWT**: signed HS256 with a configurable secret (`JWT_SECRET` env, default for local
  runs); verified in a shared middleware for protected routes; malformed/expired/invalid
  tokens all yield 401.
- **Passwords**: stored as SHA-256 hashes, never plaintext. (For a production system I
  would use bcrypt/argon2; that would require adding a native dependency, so the exercise
  uses the standard library instead — happy to discuss the trade-off.)
- **In-memory storage**: per the exercise scope. One subtlety: the module is required
  once and shared across all three mocha test files in a single run, so `DukeNukem` is
  signed up twice — the signup handler is deliberately idempotent so the second signup
  still returns 201 while preserving the original credentials.
- **Timestamp required on POST**: the tests require it even though the spec's required
  list omits it — implementation follows the executable specification.

## Verification

```
npm install
npm test          # 30 passing
node index.js     # server on :3000

# quick manual check
curl -s -X POST localhost:3000/signup -H 'Content-Type: application/json' \
     -d '{"userHandle":"demo1","password":"secret1"}'
TOKEN=$(curl -s -X POST localhost:3000/login -H 'Content-Type: application/json' \
     -d '{"userHandle":"demo1","password":"secret1"}' | sed -E 's/.*"jsonWebToken":"([^"]+)".*/\1/')
curl -s -X POST localhost:3000/high-scores -H "Authorization: Bearer $TOKEN" \
     -H 'Content-Type: application/json' \
     -d '{"level":"A1","userHandle":"demo1","score":12345,"timestamp":"2026-10-08T10:00:00Z"}'
curl -s "localhost:3000/high-scores?level=A1&page=1"
curl -si -X POST localhost:3000/high-scores -H 'Content-Type: application/json' \
     -d '{"level":"A1","userHandle":"demo1","score":1,"timestamp":"2026-10-08T10:00:00Z"}' | head -1   # -> HTTP/1.1 401
```

## Possible follow-ups

- GitHub Actions workflow running `npm test` on every push (can be added on request).
- Swapping in-memory storage for SQLite/Postgres would be the first step toward production.
