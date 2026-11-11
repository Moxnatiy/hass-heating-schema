"""Heating Schema: technical diagrams of a heating system, drawn and watched live."""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .const import (
    CONF_ICON,
    CONF_TITLE,
    DOMAIN,
    FRONTEND_URL,
    PANEL_ELEMENT,
    PANEL_ICON,
    PANEL_URL,
    panel_title,
)
from .store import SchemaStore
from .websocket import async_register_websocket_api

_LOGGER = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).parent / "frontend"
CARD_FILE = "heating-schema-card.js"
PANEL_FILE = "heating-schema-panel.js"

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    async_register_websocket_api(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    store = SchemaStore(hass)
    await store.async_load()
    hass.data[DOMAIN] = store

    # Browsers keep ES modules cached and do not ask again without a change in
    # the address. The version is part of the path rather than a query, so the
    # modules the panel and the card import by relative path carry it as well:
    # an update reaches the browser without clearing its cache.
    version = await hass.async_add_executor_job(_frontend_version)
    await _async_register_static(hass, version)

    # The card is loaded on every page, so it can be picked from the card list
    # without adding a dashboard resource by hand.
    frontend.add_extra_js_url(hass, _card_url(version))

    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL,
        webcomponent_name=PANEL_ELEMENT,
        module_url=f"{_base(version)}/{PANEL_FILE}",
        sidebar_title=entry.options.get(CONF_TITLE) or panel_title(hass.config.language),
        sidebar_icon=entry.options.get(CONF_ICON) or PANEL_ICON,
        # Open to every user: everyone may look at the schemas. Saving and
        # deleting need an administrator, which the server enforces.
        require_admin=False,
        embed_iframe=False,
    )
    entry.async_on_unload(lambda: _remove_frontend(hass, version))
    entry.async_on_unload(entry.add_update_listener(_async_options_changed))
    return True


async def _async_options_changed(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """A new sidebar name or icon: register the panel again."""
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.pop(DOMAIN, None)
    return True


def _base(version: str) -> str:
    return f"{FRONTEND_URL}/{version}"


def _card_url(version: str) -> str:
    return f"{_base(version)}/{CARD_FILE}"


def _remove_frontend(hass: HomeAssistant, version: str) -> None:
    frontend.remove_extra_js_url(hass, _card_url(version))
    frontend.async_remove_panel(hass, PANEL_URL)


async def _async_register_static(hass: HomeAssistant, version: str) -> None:
    """Serve the frontend directory under its version; each path only once."""
    registered: set[str] = hass.data.setdefault(f"{DOMAIN}_static", set())
    if version in registered:
        return
    await hass.http.async_register_static_paths(
        [StaticPathConfig(_base(version), str(FRONTEND_DIR), cache_headers=True)]
    )
    registered.add(version)


def _frontend_version() -> str:
    stamps = [int(path.stat().st_mtime) for path in FRONTEND_DIR.rglob("*.js")]
    return str(max(stamps, default=0))
