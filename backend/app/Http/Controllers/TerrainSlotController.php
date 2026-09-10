<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Terrain;
use App\Models\TerrainSlot;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class TerrainSlotController extends Controller
{
    public function store(Request $request, Terrain $terrain)
    {
        $data = $this->validated($request);
        $data['terrain_id'] = $terrain->id;

        $slot = TerrainSlot::create($data);

        return response()->json($slot, 201);
    }

    public function update(Request $request, Terrain $terrain, TerrainSlot $slot)
    {
        abort_unless($slot->terrain_id === $terrain->id, 404);

        $slot->update($this->validated($request, true));

        return response()->json($slot->fresh());
    }

    public function destroy(Terrain $terrain, TerrainSlot $slot)
    {
        abort_unless($slot->terrain_id === $terrain->id, 404);
        $slot->delete();

        return response()->json(['message' => 'Créneau supprimé.']);
    }

    private function validated(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        $data = $request->validate([
            'day_of_week' => [$required, 'integer', 'between:1,7'],
            'start_time' => [$required, 'date_format:H:i'],
            'end_time' => [$required, 'date_format:H:i'],
            'price' => [$required, 'integer', 'min:1', 'max:1000000'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (isset($data['start_time'], $data['end_time']) && $data['start_time'] === $data['end_time']) {
            throw ValidationException::withMessages(['end_time' => 'L’heure de fin doit être différente de l’heure de début.']);
        }

        return $data;
    }
}
