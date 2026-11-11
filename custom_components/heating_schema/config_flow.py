"""Config flow: one entry; options for the sidebar item."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import callback
from homeassistant.helpers.selector import IconSelector, TextSelector

from .const import CONF_ICON, CONF_TITLE, DOMAIN, PANEL_ICON, panel_title


class HeatingSchemaConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(title=panel_title(self.hass.config.language), data={})
        return self.async_show_form(step_id="user")

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return HeatingSchemaOptionsFlow()


class HeatingSchemaOptionsFlow(OptionsFlow):
    """The sidebar item's name and icon."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(data=user_input)
        options = self.config_entry.options
        title = options.get(CONF_TITLE) or panel_title(self.hass.config.language)
        icon = options.get(CONF_ICON) or PANEL_ICON
        schema = vol.Schema(
            {
                vol.Optional(CONF_TITLE, default=title): TextSelector(),
                vol.Optional(CONF_ICON, default=icon): IconSelector(),
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
