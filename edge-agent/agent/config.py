"""
config.py — Load and validate agent configuration.
Resolves ${ENV_VAR} placeholders in config values.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml


_ENV_VAR_PATTERN = re.compile(r"\$\{([^}]+)\}")


def _resolve_env_vars(value: str) -> str:
    """Replace ${VAR_NAME} with os.environ value."""
    def replacer(match: re.Match) -> str:
        var = match.group(1)
        resolved = os.environ.get(var)
        if resolved is None:
            raise EnvironmentError(f"Environment variable '{var}' is not set")
        return resolved
    return _ENV_VAR_PATTERN.sub(replacer, value)


@dataclass
class MSSQLConfig:
    host: str
    port: int
    user: str
    password: str
    reporting_db: str
    radiology_db: str
    odbc_driver: str = "ODBC Driver 17 for SQL Server"
    connect_timeout: int = 15
    query_timeout: int = 120

    @property
    def connection_string(self) -> str:
        return (
            f"DRIVER={{{self.odbc_driver}}};"
            f"SERVER={self.host},{self.port};"
            f"DATABASE={self.reporting_db};"
            f"UID={self.user};PWD={self.password};"
            f"TrustServerCertificate=yes;"
            f"ApplicationIntent=ReadOnly;"
            f"Connection Timeout={self.connect_timeout};"
        )


@dataclass
class PollingConfig:
    finished_reports_seconds: int = 30
    reference_data_hours: int = 1
    procedures_hours: int = 6


@dataclass
class BackfillConfig:
    enabled: bool = False
    from_date: str = ""
    to_date: str = ""
    batch_size: int = 1000


@dataclass
class NetworkConfig:
    proxy_url: str = ""
    proxy_username: str = ""
    proxy_password: str = ""
    connect_timeout_seconds: int = 15
    request_timeout_seconds: int = 60

    @property
    def proxy_map(self) -> Optional[dict]:
        if not self.proxy_url:
            return None
        url = self.proxy_url
        if self.proxy_username and self.proxy_password:
            proto, rest = url.split("://", 1)
            url = f"{proto}://{self.proxy_username}:{self.proxy_password}@{rest}"
        return {"https://": url, "http://": url}


@dataclass
class LoggingConfig:
    level: str = "INFO"
    max_file_size_mb: int = 5
    backup_count: int = 3


@dataclass
class AgentConfig:
    instance_id: str
    api_endpoint: str
    api_key: str
    mssql: MSSQLConfig
    polling: PollingConfig = field(default_factory=PollingConfig)
    backfill: BackfillConfig = field(default_factory=BackfillConfig)
    network: NetworkConfig = field(default_factory=NetworkConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)


def load_config(path: Path) -> AgentConfig:
    """Load and parse config.yaml, resolving env vars."""
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")

    with path.open("r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    # Resolve env vars in string values recursively
    raw = _resolve_all(raw)

    mssql_raw = raw["mssql"]
    return AgentConfig(
        instance_id=raw["instance_id"],
        api_endpoint=raw["api_endpoint"].rstrip("/"),
        api_key=raw["api_key"],
        mssql=MSSQLConfig(**mssql_raw),
        polling=PollingConfig(**raw.get("polling", {})),
        backfill=_parse_backfill(raw.get("backfill", {})),
        network=NetworkConfig(**raw.get("network", {})),
        logging=LoggingConfig(**raw.get("logging", {})),
    )


def _parse_backfill(raw: dict) -> BackfillConfig:
    if not raw:
        return BackfillConfig(enabled=False)
    return BackfillConfig(
        enabled=raw.get("enabled", False),
        from_date=raw.get("from_date", ""),
        to_date=raw.get("to_date", ""),
        batch_size=int(raw.get("batch_size", 1000)),
    )


def _resolve_all(obj):
    """Recursively resolve env vars in all string values."""
    if isinstance(obj, str):
        return _resolve_env_vars(obj)
    if isinstance(obj, dict):
        return {k: _resolve_all(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_resolve_all(i) for i in obj]
    return obj
