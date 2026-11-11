"""WebSocket commands the panel and the card use.

Reading is open to every user, because the card shows a schema on any
dashboard. Saving and deleting change what everyone sees, so they need an
administrator; the panel shows its editing tools to administrators only.
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN
from .store import SchemaStore, new_id


def _store(hass: HomeAssistant) -> SchemaStore | None:
    return hass.data.get(DOMAIN)


@callback
def async_register_websocket_api(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_list)
    websocket_api.async_register_command(hass, ws_get)
    websocket_api.async_register_command(hass, ws_subscribe)
    websocket_api.async_register_command(hass, ws_save)
    websocket_api.async_register_command(hass, ws_delete)


def _not_loaded(connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    connection.send_error(msg["id"], "not_loaded", "Heating Schema is not set up")


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/list"})
@callback
def ws_list(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Every schema's id and name."""
    if (store := _store(hass)) is None:
        return _not_loaded(connection, msg)
    connection.send_result(msg["id"], {"schemas": store.summaries()})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/get", vol.Required("schema_id"): str}
)
@callback
def ws_get(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """One schema, whole."""
    if (store := _store(hass)) is None:
        return _not_loaded(connection, msg)
    if (schema := store.get(msg["schema_id"])) is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Schema not found")
        return
    connection.send_result(msg["id"], {"schema": schema})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/subscribe", vol.Required("schema_id"): str}
)
@callback
def ws_subscribe(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """One schema now, and again every time it is saved or deleted.

    A dashboard card stays open for days; without this it would keep the
    drawing it loaded until the page is reloaded.
    """
    if (store := _store(hass)) is None:
        return _not_loaded(connection, msg)
    wanted = msg["schema_id"]

    @callback
    def changed(schema_id: str, schema: dict[str, Any] | None) -> None:
        if schema_id == wanted:
            connection.send_message(websocket_api.event_message(msg["id"], {"schema": schema}))

    connection.subscriptions[msg["id"]] = store.async_listen(changed)
    connection.send_result(msg["id"])
    connection.send_message(websocket_api.event_message(msg["id"], {"schema": store.get(wanted)}))


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/save", vol.Required("schema"): dict}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_save(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Store a schema; one without an id is a new one."""
    if (store := _store(hass)) is None:
        return _not_loaded(connection, msg)
    document = dict(msg["schema"])
    document.setdefault("id", new_id())
    try:
        stored = await store.async_save(document)
    except vol.Invalid as err:
        connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, str(err))
        return
    connection.send_result(msg["id"], {"schema": stored})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/delete", vol.Required("schema_id"): str}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_delete(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    if (store := _store(hass)) is None:
        return _not_loaded(connection, msg)
    if not await store.async_delete(msg["schema_id"]):
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Schema not found")
        return
    connection.send_result(msg["id"])
