"""Shared fixtures: a Home Assistant with the integration set up."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Home Assistant looks for custom integrations in custom_components at the root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

pytest_plugins = "pytest_homeassistant_custom_component"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield
