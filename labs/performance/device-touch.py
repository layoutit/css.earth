"""Plays touch contacts on a USB iPhone or iPad as real touchscreen input, through pymobiledevice3's CoreDevice HID service
(https://github.com/doronz88/pymobiledevice3). ios-capture.mts writes the plan and runs this file with pymobiledevice3's own
Python; the device and macOS's no-root tunnel come from PYMOBILEDEVICE3_UDID and PYMOBILEDEVICE3_NATIVE.

    python device-touch.py plan.json

The plan is {"events": [[ms, "contact" | "release", x, y], ...]} in the HID service's 0..65535 display coordinates. Every
event runs inside one touch session at its planned time, and each is echoed as a JSON line when sent. One finger only:
the service's main touchscreen report carries a single contact.
"""

import asyncio
import json
import sys
import time
from pathlib import Path
from typing import Annotated

import typer
from pymobiledevice3.__main__ import main
from pymobiledevice3.cli.cli_common import RSDServiceProviderDep, async_command
from pymobiledevice3.cli.developer.core_device import universal_hid_service_cli
from pymobiledevice3.remote.core_device.hid_service import (
    TOUCHSCREEN_STATE_CONTACT,
    TOUCHSCREEN_STATE_RELEASE,
    touch_session,
)

STATES = {"contact": TOUCHSCREEN_STATE_CONTACT, "release": TOUCHSCREEN_STATE_RELEASE}


@universal_hid_service_cli.command("play")
@async_command
async def play(service_provider: RSDServiceProviderDep, plan: Annotated[Path, typer.Argument()]) -> None:
    """Send the plan's contacts at their planned times inside one touch session."""
    events = json.loads(plan.read_text())["events"]
    for index, event in enumerate(events):
        if len(event) != 4 or event[1] not in STATES or not all(isinstance(value, (int, float)) for value in (event[0], event[2], event[3])):
            raise typer.BadParameter(f"event {index} is not [ms, contact|release, x, y]: {event!r}")
    async with touch_session(service_provider) as service:
        start = time.monotonic()
        for at, kind, x, y in events:
            delay = start + at / 1000 - time.monotonic()
            if delay > 0:
                await asyncio.sleep(delay)
            await service.send_touchscreen(STATES[kind], round(x), round(y))
            print(json.dumps({"at": round((time.monotonic() - start) * 1000), "planned": at, "kind": kind}), flush=True)


if __name__ == "__main__":
    sys.argv = [sys.argv[0], "developer", "core-device", "universal-hid-service", "play", *sys.argv[1:]]
    sys.exit(main())
