"""The backend: what a schema may look like, and who may change it."""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.heating_schema.const import DOMAIN, MAX_SCHEMAS
from custom_components.heating_schema.store import validate


def schema(**extra: Any) -> dict[str, Any]:
    return {
        "id": "abc123",
        "name": "Boiler room",
        "nodes": [
            {
                "id": "hp",
                "type": "heat_pump",
                "x": 0,
                "y": 0,
                "bindings": {"flow_temp": "sensor.flow"},
            },
            {"id": "pump", "type": "pump", "x": 200, "y": 0, "rotation": 90},
        ],
        "pipes": [
            {
                "id": "p1",
                "from": {"node": "hp", "port": "supply_out"},
                "to": {"node": "pump", "port": "in"},
                "medium": "heating_supply",
                "points": [[100, 0], [100, 40]],
            }
        ],
        **extra,
    }


# ---- validation ----------------------------------------------------------------


def test_a_schema_validates_and_gains_defaults() -> None:
    clean = validate(schema())
    assert clean["nodes"][0]["rotation"] == 0
    assert clean["nodes"][0]["params"] == {}
    assert clean["pipes"][0]["dn"] == ""
    assert (clean["nodes"][0]["scale"], clean["nodes"][0]["flip_y"]) == (1, False)


def test_an_element_keeps_its_scale_and_vertical_mirror() -> None:
    nodes = [{"id": "a", "type": "pump", "x": 0, "y": 0, "scale": 1.5, "flip_y": True}]
    clean = validate(schema(nodes=nodes, pipes=[]))
    assert (clean["nodes"][0]["scale"], clean["nodes"][0]["flip_y"]) == (1.5, True)


def test_the_server_writes_the_update_time_itself() -> None:
    assert "updated" not in validate(schema(updated="1999-01-01"))


@pytest.mark.parametrize(
    "broken",
    [
        {
            "nodes": [
                {"id": "a", "type": "pump", "x": 0, "y": 0},
                {"id": "a", "type": "pump", "x": 0, "y": 0},
            ]
        },
        {
            "pipes": [
                {
                    "id": "p",
                    "from": {"node": "nowhere", "port": "x"},
                    "to": {"node": "hp", "port": "y"},
                }
            ]
        },
        {"nodes": [{"id": "a b", "type": "pump", "x": 0, "y": 0}]},
        {"nodes": [{"id": "a", "type": "pump", "x": 0, "y": 0, "rotation": 45}]},
        {"nodes": [{"id": "a", "type": "pump", "x": 0, "y": 0, "scale": 7}]},
        {
            "nodes": [
                {
                    "id": "a",
                    "type": "pump",
                    "x": 0,
                    "y": 0,
                    "bindings": {"running": "not an entity"},
                }
            ]
        },
        {"name": ""},
    ],
)
def test_broken_schemas_are_refused(broken: dict[str, Any]) -> None:
    with pytest.raises(vol.Invalid):
        validate({**schema(), **broken})


# ---- through Home Assistant ------------------------------------------------------


@pytest.fixture
async def setup(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="Heating schema")
    entry.add_to_hass(hass)
    # The panel and the card are frontend matters; their registration is not under test.
    with (
        patch("homeassistant.components.panel_custom.async_register_panel"),
        patch("homeassistant.components.frontend.add_extra_js_url"),
        patch("custom_components.heating_schema._async_register_static"),
    ):
        assert await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()
    return entry


async def test_save_list_get_delete(hass: HomeAssistant, setup, hass_ws_client) -> None:
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {"type": f"{DOMAIN}/save", "schema": schema(id=None) | {"id": "abc123"}}
    )
    saved = await client.receive_json()
    assert saved["success"], saved
    assert saved["result"]["schema"]["updated"]

    await client.send_json_auto_id({"type": f"{DOMAIN}/list"})
    listed = await client.receive_json()
    assert listed["result"]["schemas"] == [
        {
            "id": "abc123",
            "name": "Boiler room",
            "updated": saved["result"]["schema"]["updated"],
            "nodes": 2,
        }
    ]

    await client.send_json_auto_id({"type": f"{DOMAIN}/get", "schema_id": "abc123"})
    got = await client.receive_json()
    assert got["result"]["schema"]["pipes"][0]["points"] == [[100, 0], [100, 40]]

    await client.send_json_auto_id({"type": f"{DOMAIN}/delete", "schema_id": "abc123"})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": f"{DOMAIN}/get", "schema_id": "abc123"})
    assert (await client.receive_json())["error"]["code"] == "not_found"


async def test_a_new_schema_gets_an_id(hass: HomeAssistant, setup, hass_ws_client) -> None:
    client = await hass_ws_client(hass)
    document = schema()
    del document["id"]
    await client.send_json_auto_id({"type": f"{DOMAIN}/save", "schema": document})
    result = await client.receive_json()
    assert result["success"]
    assert len(result["result"]["schema"]["id"]) == 12


async def test_an_invalid_schema_is_answered_with_an_error(
    hass: HomeAssistant, setup, hass_ws_client
) -> None:
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/save", "schema": schema(name="")})
    result = await client.receive_json()
    assert not result["success"]
    assert result["error"]["code"] == "invalid_format"


async def test_saving_and_deleting_need_an_administrator(
    hass: HomeAssistant, setup, hass_ws_client, hass_read_only_access_token
) -> None:
    client = await hass_ws_client(hass, hass_read_only_access_token)
    await client.send_json_auto_id({"type": f"{DOMAIN}/save", "schema": schema()})
    assert (await client.receive_json())["error"]["code"] == "unauthorized"
    await client.send_json_auto_id({"type": f"{DOMAIN}/delete", "schema_id": "abc123"})
    assert (await client.receive_json())["error"]["code"] == "unauthorized"
    # Reading stays open: the card shows schemas to everyone.
    await client.send_json_auto_id({"type": f"{DOMAIN}/list"})
    assert (await client.receive_json())["success"]


async def test_a_card_follows_saves_and_deletion(
    hass: HomeAssistant, setup, hass_ws_client
) -> None:
    writer = await hass_ws_client(hass)
    await writer.send_json_auto_id({"type": f"{DOMAIN}/save", "schema": schema()})
    await writer.receive_json()

    card = await hass_ws_client(hass)
    await card.send_json_auto_id({"type": f"{DOMAIN}/subscribe", "schema_id": "abc123"})
    assert (await card.receive_json())["success"]
    first = await card.receive_json()
    assert first["event"]["schema"]["name"] == "Boiler room"

    await writer.send_json_auto_id({"type": f"{DOMAIN}/save", "schema": schema(name="Renamed")})
    await writer.receive_json()
    assert (await card.receive_json())["event"]["schema"]["name"] == "Renamed"

    await writer.send_json_auto_id({"type": f"{DOMAIN}/delete", "schema_id": "abc123"})
    await writer.receive_json()
    assert (await card.receive_json())["event"]["schema"] is None


async def test_schemas_survive_a_restart(
    hass: HomeAssistant, setup, hass_ws_client, hass_storage
) -> None:
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/save", "schema": schema()})
    await client.receive_json()
    await hass.async_block_till_done()
    stored = hass_storage[f"{DOMAIN}.schemas"]["data"]["schemas"]
    assert stored["abc123"]["name"] == "Boiler room"


async def test_the_number_of_schemas_is_limited(hass: HomeAssistant, setup, hass_ws_client) -> None:
    store = hass.data[DOMAIN]
    for i in range(MAX_SCHEMAS):
        await store.async_save(schema(id=f"s{i}"))
    with pytest.raises(vol.Invalid):
        await store.async_save(schema(id="one_too_many"))
