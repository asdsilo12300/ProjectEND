<?php

use App\Models\Simulator;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $requiredColumns = ['soil_temp', 'air_temp', 'state_version', 'status'];
        foreach ($requiredColumns as $column) {
            if (! Schema::hasColumn('simulators', $column)) {
                return;
            }
        }

        // Before root temperature had its own control, greenhouse updates wrote
        // the air temperature into both fields. Repair only that unmistakably
        // linked state when air is healthy but the copied root temperature is
        // outside the plant's healthy soil-temperature range.
        Simulator::query()
            ->with('plant')
            ->where('status', 'active')
            ->orderBy('id')
            ->eachById(function (Simulator $simulator): void {
                $plant = $simulator->plant;
                if (! $plant) {
                    return;
                }

                $soilTemp = (float) $simulator->soil_temp;
                $airTemp = (float) $simulator->air_temp;
                $soilMin = (float) $plant->soil_temp_min;
                $soilMax = (float) $plant->soil_temp_max;
                $airMin = (float) $plant->air_temp_min;
                $airMax = (float) $plant->air_temp_max;
                $rootTemperatureIsCopied = abs($soilTemp - $airTemp) < 0.01;
                $airIsHealthy = $airTemp >= $airMin && $airTemp <= $airMax;
                $soilIsStressed = $soilTemp < $soilMin || $soilTemp > $soilMax;

                if (! $rootTemperatureIsCopied || ! $airIsHealthy || ! $soilIsStressed || $soilMin > $soilMax) {
                    return;
                }

                $simulator->update([
                    'soil_temp' => round(($soilMin + $soilMax) / 2, 2),
                    'state_version' => ((int) $simulator->state_version) + 1,
                ]);
            });
    }

    public function down(): void
    {
        // Repaired values must not be changed back to an unhealthy copied value.
    }
};
