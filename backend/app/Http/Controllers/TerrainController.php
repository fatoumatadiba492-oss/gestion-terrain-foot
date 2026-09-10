<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Terrain;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class TerrainController extends Controller
{
    public function index(Request $request)
    {
        $query = Terrain::query()
            ->where('status', 'active')
            ->with('slots');

        if ($request->filled('city')) {
            $query->where('city', $request->string('city')->toString());
        }

        if ($request->filled('quartier')) {
            $query->where('quartier', $request->string('quartier')->toString());
        }

        if ($request->filled('type')) {
            $query->where('type', $request->string('type')->toString());
        }

        return response()->json($query->latest()->paginate(12));
    }

    public function show(Terrain $terrain)
    {
        if ($terrain->status !== 'active') {
            return response()->json(['message' => 'Terrain indisponible.'], 404);
        }

        return response()->json($terrain->load('slots'));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:150'],
            'description' => ['nullable', 'string', 'max:5000'],
            'address' => ['required', 'string', 'max:255'],
            'quartier' => ['required', 'string', 'max:100'],
            'city' => ['required', 'string', 'max:100'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'phone' => ['nullable', 'string', 'max:30'],
            'image' => ['nullable', 'string', 'max:500'],
            'type' => ['required', 'string', 'max:50'],
            'capacity' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'owner_id' => ['nullable', 'exists:users,id'],
        ]);

        $data['slug'] = $this->uniqueSlug($data['name']);

        $terrain = Terrain::create($data);

        return response()->json($terrain, 201);
    }

    public function update(Request $request, Terrain $terrain)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:150'],
            'description' => ['nullable', 'string', 'max:5000'],
            'address' => ['sometimes', 'required', 'string', 'max:255'],
            'quartier' => ['sometimes', 'required', 'string', 'max:100'],
            'city' => ['sometimes', 'required', 'string', 'max:100'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'phone' => ['nullable', 'string', 'max:30'],
            'image' => ['nullable', 'string', 'max:500'],
            'type' => ['sometimes', 'required', 'string', 'max:50'],
            'capacity' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'owner_id' => ['nullable', 'exists:users,id'],
        ]);

        if (isset($data['name']) && $data['name'] !== $terrain->name) {
            $data['slug'] = $this->uniqueSlug($data['name'], $terrain->id);
        }

        $terrain->update($data);

        return response()->json($terrain->fresh());
    }

    public function destroy(Terrain $terrain)
    {
        $terrain->update(['status' => 'inactive']);

        return response()->json(['message' => 'Terrain désactivé avec succès.']);
    }

    private function uniqueSlug(string $name, ?int $ignoreId = null): string
    {
        $base = Str::slug($name);
        $slug = $base;
        $counter = 2;

        while (Terrain::query()
            ->where('slug', $slug)
            ->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))
            ->exists()) {
            $slug = $base.'-'.$counter++;
        }

        return $slug;
    }
}
