"""BLE transport with a restricted command channel. JSONL stdout is reserved for the Node parent."""
import asyncio
import json
import re
import sys
import threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).with_name('python-deps')))
from bleak import BleakClient, BleakScanner

UART = '0000ffe1-0000-1000-8000-00805f9b34fb'

def emit(event):
    print(json.dumps(event, ensure_ascii=True), flush=True)

async def scan():
    devices = await BleakScanner.discover(timeout=5, return_adv=True)
    ports = []
    for device, advert in devices.values():
        name = advert.local_name or device.name or ''
        if name.lower() == 'glove' or 'hc-08' in name.lower() or 'hc08' in name.lower():
            ports.append({'path': 'BLE:' + device.address, 'manufacturer': name,
                          'transport': 'ble', 'rssi': advert.rssi})
    emit({'type': 'ports', 'ports': ports})

async def connect(address):
    device = await BleakScanner.find_device_by_address(address, timeout=6)
    if device is None:
        raise RuntimeError('没有发现手套，请确认电源和电脑蓝牙已开启')
    loop = asyncio.get_running_loop()
    stop = asyncio.Event()
    commands = asyncio.Queue()
    def input_worker():
        for line in sys.stdin:
            if line.strip() == 'stop':
                break
            try:
                message = json.loads(line)
                loop.call_soon_threadsafe(commands.put_nowait, message)
            except (ValueError, RuntimeError):
                pass
        loop.call_soon_threadsafe(stop.set)
    threading.Thread(target=input_worker, daemon=True).start()
    def disconnected(_client):
        loop.call_soon_threadsafe(stop.set)
    async with BleakClient(device, timeout=12, disconnected_callback=disconnected) as client:
        char = client.services.get_characteristic(UART)
        if char is None or 'notify' not in char.properties:
            raise RuntimeError('该设备没有本次已验证的手套通知通道')
        await client.start_notify(char, lambda _, data: emit({'type': 'data', 'hex': data.hex()}))
        emit({'type': 'ready', 'name': device.name})
        async def write_commands():
            while not stop.is_set():
                message = await commands.get()
                command = message.get('command')
                allowed = isinstance(command, str) and re.fullmatch(r'(?:HELP|STATUS|MODE [01]|CALIB_MIN|CALIB_MAX|SAVE|LOAD|RECORD [0-9] (?:[1-9][0-9]{0,2}|1000))', command)
                if not allowed:
                    emit({'type': 'write-error', 'id': message.get('id'), 'message': '此无线命令尚未开放'})
                    continue
                try:
                    # Firmware consumes uppercase U (0x55) as a binary header.
                    # Its text executor accepts lowercase names and normalizes them.
                    await client.write_gatt_char(char, (command.lower() + '\n').encode('ascii'), response=False)
                    emit({'type': 'written', 'id': message.get('id')})
                except Exception as error:
                    emit({'type': 'write-error', 'id': message.get('id'), 'message': str(error)})
        writes = asyncio.create_task(write_commands())
        try:
            await stop.wait()
        finally:
            writes.cancel()
            try:
                await writes
            except asyncio.CancelledError:
                pass
        if client.is_connected:
            await client.stop_notify(char)
    emit({'type': 'closed'})

async def main():
    if len(sys.argv) == 2 and sys.argv[1] == 'scan':
        await scan()
    elif len(sys.argv) == 3 and sys.argv[1] == 'connect':
        await connect(sys.argv[2])
    else:
        raise RuntimeError('无效蓝牙操作')

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except Exception as error:
        emit({'type': 'error', 'message': str(error)})
        sys.exit(1)
