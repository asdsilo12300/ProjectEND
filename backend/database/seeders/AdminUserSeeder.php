<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        User::query()->updateOrCreate(
            ['email' => env('ADMIN_EMAIL', 'admin@plantgrowth.local')],
            [
                'username' => env('ADMIN_USERNAME', 'academy_admin'),
                'password' => env('ADMIN_PASSWORD', 'Admin@12345'),
                'role' => 'admin',
                'status' => 'active',
                'email_verified_at' => now(),
            ],
        );
    }
}
