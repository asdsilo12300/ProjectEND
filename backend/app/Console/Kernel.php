<?php

namespace App\Console;

use Illuminate\Foundation\Console\Kernel as ConsoleKernel;
use App\Console\Commands\ImportModels;

class Kernel extends ConsoleKernel
{
    protected $commands = [
        ImportModels::class,
    ];

    protected function schedule(\Illuminate\Console\Scheduling\Schedule $schedule): void
    {
        //
    }

    protected function commands(): void
    {
        //
    }
}
