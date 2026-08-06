# Docker Compose progress flag fix

Fixed startup error:

`--progress is a global compose flag`

Old command shape:

```text
docker compose --env-file .env build --progress plain app
```

Correct command shape:

```text
docker compose --env-file .env --progress plain build app
```

No application source, database schema, or Docker service definition was changed.
