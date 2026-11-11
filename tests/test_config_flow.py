"""Setting the integration up, and the sidebar item's options."""

from __future__ import annotations

from unittest.mock import patch

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.heating_schema.const import CONF_ICON, CONF_TITLE, DOMAIN, panel_title

FRONTEND = (
    patch("homeassistant.components.panel_custom.async_register_panel"),
    patch("homeassistant.components.frontend.add_extra_js_url"),
    patch("custom_components.heating_schema._async_register_static"),
)


def test_the_sidebar_name_follows_the_installation_language() -> None:
    assert panel_title("uk") == "Схема опалення"
    assert panel_title("en-GB") == "Heating schema"
    assert panel_title("de") == "Heating schema"
    assert panel_title(None) == "Heating schema"


async def test_one_entry_only(hass: HomeAssistant) -> None:
    with FRONTEND[0], FRONTEND[1], FRONTEND[2]:
        result = await hass.config_entries.flow.async_init(
            DOMAIN, context={"source": config_entries.SOURCE_USER}
        )
        assert result["type"] is FlowResultType.FORM
        result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
        assert result["type"] is FlowResultType.CREATE_ENTRY
        await hass.async_block_till_done()

        again = await hass.config_entries.flow.async_init(
            DOMAIN, context={"source": config_entries.SOURCE_USER}
        )
    assert again["type"] is FlowResultType.ABORT
    assert again["reason"] == "single_instance_allowed"


async def test_options_rename_the_sidebar_item(hass: HomeAssistant) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="Heating schema")
    entry.add_to_hass(hass)
    with FRONTEND[0] as register, FRONTEND[1], FRONTEND[2]:
        assert await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()
        assert register.call_args.kwargs["sidebar_title"] == "Heating schema"

        result = await hass.config_entries.options.async_init(entry.entry_id)
        assert result["type"] is FlowResultType.FORM
        result = await hass.config_entries.options.async_configure(
            result["flow_id"], {CONF_TITLE: "Котельня", CONF_ICON: "mdi:fire"}
        )
        assert result["type"] is FlowResultType.CREATE_ENTRY
        await hass.async_block_till_done()

    # The panel was registered again with the new name and icon.
    assert register.call_args.kwargs["sidebar_title"] == "Котельня"
    assert register.call_args.kwargs["sidebar_icon"] == "mdi:fire"
