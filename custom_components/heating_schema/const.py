"""Constants for the Heating Schema integration."""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "heating_schema"

#: Where the schemas live in .storage, and the layout version of that file.
STORAGE_KEY: Final = f"{DOMAIN}.schemas"
STORAGE_VERSION: Final = 1

#: The frontend files: the panel, the card and the modules they share.
FRONTEND_URL: Final = f"/{DOMAIN}_static"
PANEL_URL: Final = "heating-schema"
PANEL_ICON: Final = "mdi:radiator"

#: The sidebar item's name. Home Assistant shows a custom panel's title as it
#: is, without translating it per user, so it is an option, and its default
#: follows the language of the installation.
PANEL_TITLES: Final = {"uk": "Схема опалення", "en": "Heating schema"}
PANEL_ELEMENT: Final = "heating-schema-panel"

CONF_TITLE: Final = "sidebar_title"
CONF_ICON: Final = "sidebar_icon"


def panel_title(language: str | None) -> str:
    """The default sidebar name for a language such as "uk" or "en-GB"."""
    code = (language or "en").replace("_", "-").split("-")[0]
    return PANEL_TITLES.get(code, PANEL_TITLES["en"])


#: Limits a saved schema must stay within. A schema is a drawing, not a
#: database: these are far beyond any real plant room and only stop a broken
#: or hostile client from filling the storage file.
MAX_SCHEMAS: Final = 100
MAX_NODES: Final = 2000
MAX_PIPES: Final = 4000
MAX_POINTS: Final = 200
MAX_TEXT: Final = 200
