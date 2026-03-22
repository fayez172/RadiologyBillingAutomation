---
description: Debugging command. Activates DEBUG mode for systematic problem investigation.
---

# Debug Workflow

## Steps

1. **Identify the error**: Check terminal output, browser console, and server logs.

2. **Check database**:
```bash
npx prisma studio
```

3. **Check Docker logs**:
```bash
docker compose logs -f --tail=100
```

4. **Check PostgreSQL directly**:
```bash
docker compose exec postgres psql -U telerad -d telerad_billing -c "\dt"
```

5. **Check Redis**:
```bash
docker compose exec redis redis-cli ping
```

6. **Test MSSQL connectivity** (READ-ONLY):
```bash
npx ts-node -e "
const sql = require('mssql');
const config = {
  server: process.env.TEST_MSSQL_IP,
  port: parseInt(process.env.TEST_MSSQL_PORT || '1433'),
  user: process.env.TEST_MSSQL_USER,
  password: process.env.TEST_MSSQL_PASS,
  database: process.env.TEST_MSSQL_REPORTING_DB,
  options: { readOnlyIntent: true, encrypt: false, trustServerCertificate: true }
};
sql.connect(config).then(() => { console.log('MSSQL OK'); sql.close(); }).catch(console.error);
"
```

7. **Reset database** (development only):
```bash
npx prisma migrate reset
npm run db:seed
```
