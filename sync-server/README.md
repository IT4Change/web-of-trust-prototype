# Automerge Sync Server

Self-hosted Automerge sync server with automatic HTTPS via Caddy.

## Setup

1. Edit `Caddyfile` and replace `sync.example.com` with your domain

2. Make sure your domain's DNS points to this server

3. Start the services:
   ```bash
   docker compose up -d
   ```

4. Caddy will automatically obtain and renew SSL certificates from Let's Encrypt

## Usage in Apps

Update the sync server URL in your app:

```typescript
const repo = useRepository({
  syncServer: 'wss://sync.yourdomain.com',
  enableBroadcastChannel: true,
});
```

## Local Development (without SSL)

For local testing, use this Caddyfile:

```
:80 {
    reverse_proxy automerge-sync:3030
}
```

And access via `ws://localhost` (not `wss://`).

## Monitoring

View logs:
```bash
docker compose logs -f
```

Check status:
```bash
docker compose ps
```

## Persistence

The sync server stores documents in memory by default. For persistence, you can mount a volume:

```yaml
services:
  automerge-sync:
    volumes:
      - sync_data:/data
    environment:
      - STORAGE_DIR=/data
```

Note: Check the official automerge-repo-sync-server documentation for current environment variable names.
