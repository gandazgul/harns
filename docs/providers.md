# Providers and Models

RunWield uses Pi's provider and model infrastructure with RunWield-owned config paths.

For complete provider-specific setup, OAuth/API-key options, environment variables, and custom provider details, see
[Pi Providers](https://pi.dev/docs/latest/providers), [Pi Custom Models](https://pi.dev/docs/latest/models), and
[Pi Custom Providers](https://pi.dev/docs/latest/custom-provider).

## RunWield storage paths

| Data                  | RunWield path          |
| --------------------- | ---------------------- |
| Credentials           | `~/.wld/auth.json`     |
| Model registry/config | `~/.wld/models.json`   |
| Settings              | `~/.wld/settings.json` |

If a RunWield file does not exist, RunWield may import the matching Pi file from `~/.pi/agent/` once. After that,
RunWield reads and writes the RunWield-owned file.

## Login commands

Inside the TUI:

```text
/login
/logout
/status
```

`/login` can store subscription or API-key credentials. `/status` shows configured providers and available model count.

## Model selection

Use:

```text
/model
```

or from the CLI:

```bash
wld model <provider>/<model_id>
```

RunWield expects strict `provider/model_id` references for explicit model settings and per-agent overrides.

## Agent model overrides

RunWield can assign different models to different agents:

```jsonc
{
    "agents": {
        "router": {
            "model": "openai/gpt-5-mini",
            "thinkingLevel": "minimal",
            "temperature": 0.1
        },
        "engineer": {
            "model": "anthropic/claude-sonnet-4-5",
            "thinkingLevel": "high",
            "temperature": 0.4
        }
    }
}
```

See [Settings Reference](settings.md) for `agents`, `activeModelPreset`, and `modelPresets`.
