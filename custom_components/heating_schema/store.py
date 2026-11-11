"""Saved schemas, kept in Home Assistant's own storage.

A schema is a drawing: the elements of a heating system placed on a grid, the
pipes between their ports, and which entity drives each live value. What an
element *is* — its ports, parameters and symbol — belongs to the frontend
library; the backend checks only the shape of the document and its size, so a
new element type needs no backend change.
"""

from __future__ import annotations

import re
import secrets
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

import voluptuous as vol
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store

from .const import (
    MAX_NODES,
    MAX_PIPES,
    MAX_POINTS,
    MAX_SCHEMAS,
    MAX_TEXT,
    STORAGE_KEY,
    STORAGE_VERSION,
)

#: Ids are made by the editor; this keeps them usable as keys and in markup.
ID = vol.All(str, vol.Match(re.compile(r"^[A-Za-z0-9_-]{1,64}$")))
TEXT = vol.All(str, vol.Length(max=MAX_TEXT))
COORD = vol.All(vol.Coerce(float), vol.Range(min=-1e6, max=1e6))
#: A binding names one entity; the editor checks that it is of the right kind.
ENTITY_ID = vol.All(str, vol.Match(re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")))
SCALAR = vol.Any(None, bool, int, float, TEXT)
#: The sizes an element may be drawn at, as the editor offers them.
SCALES = (0.5, 0.75, 1.0, 1.25, 1.5, 2.0)

BINDINGS = vol.Schema({ID: vol.Any(None, "", ENTITY_ID)})
PARAMS = vol.Schema({ID: SCALAR})

NODE = vol.Schema(
    {
        vol.Required("id"): ID,
        vol.Required("type"): ID,
        vol.Required("x"): COORD,
        vol.Required("y"): COORD,
        vol.Optional("rotation", default=0): vol.In([0, 90, 180, 270]),
        vol.Optional("flip", default=False): bool,
        vol.Optional("flip_y", default=False): bool,
        vol.Optional("scale", default=1): vol.All(vol.Coerce(float), vol.In(SCALES)),
        vol.Optional("label", default=""): TEXT,
        vol.Optional("params", default=dict): PARAMS,
        vol.Optional("bindings", default=dict): BINDINGS,
    }
)

END = vol.Schema({vol.Required("node"): ID, vol.Required("port"): ID})

PIPE = vol.Schema(
    {
        vol.Required("id"): ID,
        vol.Required("from"): END,
        vol.Required("to"): END,
        vol.Optional("medium", default="heating_supply"): ID,
        vol.Optional("dn", default=""): TEXT,
        vol.Optional("label", default=""): TEXT,
        vol.Optional("points", default=list): vol.All(
            [vol.ExactSequence([COORD, COORD])], vol.Length(max=MAX_POINTS)
        ),
        vol.Optional("bindings", default=dict): BINDINGS,
    }
)

SCHEMA = vol.Schema(
    {
        vol.Required("id"): ID,
        vol.Required("name"): vol.All(TEXT, vol.Length(min=1)),
        vol.Optional("version", default=1): int,
        vol.Optional("nodes", default=list): vol.All([NODE], vol.Length(max=MAX_NODES)),
        vol.Optional("pipes", default=list): vol.All([PIPE], vol.Length(max=MAX_PIPES)),
        vol.Optional("settings", default=dict): PARAMS,
        # Written by the store, never trusted from a client.
        vol.Remove("updated"): object,
    }
)


def new_id() -> str:
    """A short random id for a schema."""
    return secrets.token_hex(6)


def validate(document: dict[str, Any]) -> dict[str, Any]:
    """The document as stored, or vol.Invalid saying what is wrong with it."""
    clean = SCHEMA(document)
    nodes = {node["id"] for node in clean["nodes"]}
    if len(nodes) != len(clean["nodes"]):
        raise vol.Invalid("node ids must be unique")
    pipes = set()
    for pipe in clean["pipes"]:
        if pipe["id"] in pipes:
            raise vol.Invalid("pipe ids must be unique")
        pipes.add(pipe["id"])
        for end in ("from", "to"):
            if pipe[end]["node"] not in nodes:
                raise vol.Invalid(f"pipe {pipe['id']} ends at a missing node")
    return clean


class SchemaStore:
    """Every schema of this Home Assistant, loaded once and saved on change."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._schemas: dict[str, dict[str, Any]] = {}
        self._listeners: list[Callable[[str, dict[str, Any] | None], None]] = []

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self._schemas = dict(data.get("schemas", {}))

    @callback
    def summaries(self) -> list[dict[str, Any]]:
        """Id, name and size of each schema, for a picker."""
        return sorted(
            (
                {
                    "id": schema["id"],
                    "name": schema["name"],
                    "updated": schema.get("updated"),
                    "nodes": len(schema.get("nodes", [])),
                }
                for schema in self._schemas.values()
            ),
            key=lambda item: item["name"].casefold(),
        )

    @callback
    def get(self, schema_id: str) -> dict[str, Any] | None:
        return self._schemas.get(schema_id)

    async def async_save(self, document: dict[str, Any]) -> dict[str, Any]:
        """Validate and store a schema, new or changed; returns what was stored."""
        clean = validate(document)
        if clean["id"] not in self._schemas and len(self._schemas) >= MAX_SCHEMAS:
            raise vol.Invalid(f"at most {MAX_SCHEMAS} schemas")
        clean["updated"] = datetime.now(UTC).isoformat()
        self._schemas[clean["id"]] = clean
        await self._persist()
        self._notify(clean["id"], clean)
        return clean

    async def async_delete(self, schema_id: str) -> bool:
        if self._schemas.pop(schema_id, None) is None:
            return False
        await self._persist()
        self._notify(schema_id, None)
        return True

    @callback
    def async_listen(
        self, listener: Callable[[str, dict[str, Any] | None], None]
    ) -> Callable[[], None]:
        """Call listener(schema_id, schema or None) on every save and delete."""
        self._listeners.append(listener)

        @callback
        def remove() -> None:
            self._listeners.remove(listener)

        return remove

    async def _persist(self) -> None:
        await self._store.async_save({"schemas": self._schemas})

    @callback
    def _notify(self, schema_id: str, schema: dict[str, Any] | None) -> None:
        for listener in list(self._listeners):
            listener(schema_id, schema)
