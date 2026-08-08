# Backend security configuration

Passwords are never encrypted or stored in plaintext. New passwords are HMAC-SHA-384 pre-hashed with a server-only pepper and then bcrypt-hashed with cost 12. Existing unpeppered bcrypt hashes are upgraded after a successful login.

Set these values in the production secret manager or the backend's ignored `.env` file:

```dotenv
NODE_ENV=production
PASSWORD_PEPPER=<at-least-32-random-characters>
PASSWORD_BCRYPT_ROUNDS=12
JWT_ACCESS_SECRET=<independent-random-secret>
JWT_REFRESH_SECRET=<different-independent-random-secret>
```

Do not commit, log, return, or copy these values into the Admin or Flutter projects. Back up the password pepper securely: losing it prevents verification of peppered password hashes, while disclosure requires rotating it and forcing password resets.

Production traffic must terminate TLS at the API or a trusted reverse proxy. Port 8080 can remain private behind that proxy. Account creation uses a MongoDB transaction, so the deployment must use a replica set or MongoDB Atlas; standalone MongoDB servers do not support transactions.
