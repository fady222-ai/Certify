<?php

namespace Database\Seeders;

use App\Models\Certificate;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\User;
use App\Services\CertificateHasher;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // --- Plans (from pricing model) ---
        $plans = [
            ['slug' => 'free', 'name' => 'مجاني', 'price_monthly' => 0, 'price_yearly' => 0, 'certificates_per_month' => 10, 'team_members_limit' => 1],
            ['slug' => 'starter', 'name' => 'Starter', 'price_monthly' => 19, 'price_yearly' => 179, 'certificates_per_month' => 200, 'team_members_limit' => 1],
            ['slug' => 'pro', 'name' => 'Pro', 'price_monthly' => 49, 'price_yearly' => 459, 'certificates_per_month' => 2000, 'team_members_limit' => 3, 'has_api' => true],
            ['slug' => 'business', 'name' => 'Business', 'price_monthly' => 99, 'price_yearly' => 899, 'certificates_per_month' => 10000, 'team_members_limit' => 10, 'has_api' => true, 'has_white_label' => true],
        ];
        foreach ($plans as $p) {
            Plan::updateOrCreate(['slug' => $p['slug']], $p);
        }

        $free = Plan::where('slug', 'free')->first();

        // --- Demo user + organization ---
        $user = User::updateOrCreate(
            ['email' => 'demo@certify.test'],
            ['name' => 'مدرب تجريبي', 'password' => bcrypt('password')]
        );

        $org = Organization::updateOrCreate(
            ['slug' => 'demo-academy'],
            [
                'owner_id' => $user->id,
                'name' => 'أكاديمية المسار للتدريب',
                'plan_id' => $free->id,
                'primary_color' => '#4f46e5',
            ]
        );

        // --- Demo certificate (used by the landing page "try verification" link) ---
        $hasher = new CertificateHasher();
        Certificate::where('verification_code', 'CERT-SMOK-0001')->delete();

        $cert = new Certificate([
            'recipient_name' => 'عبدالرحمن محمد الأحمدي',
            'recipient_email' => 'student@example.com',
            'course_name' => 'أساسيات إدارة المشاريع الاحترافية',
            'issue_date' => '2026-06-10',
            'status' => 'active',
            'verification_code' => 'CERT-SMOK-0001',
        ]);
        $cert->id = (string) Str::uuid();
        $cert->organization_id = $org->id;
        $cert->verification_hash = $hasher->computeFor($cert);
        $cert->save();

        $this->command->info('Seeded plans, demo org, and demo certificate (CERT-SMOK-0001).');
    }
}
