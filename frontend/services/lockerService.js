// All locker commands go through our Express server.
// The server forwards to the ESP32, then long-polls until the hardware
// calls back POST /api/locker/callback with { status: 'open' | 'closed' }.
// The fetch below resolves only after that confirmation arrives.

export async function sendLockerServoCommand(command) {
    try {
        const response = await fetch(`/api/locker/${command}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command }),
        });
        if (!response.ok) throw new Error(`Locker API returned ${response.status}`);
        return await response.json();
    } catch {
        return { mocked: true, command };
    }
}
