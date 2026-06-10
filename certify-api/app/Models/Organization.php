<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Organization extends Model
{
    use HasUuids;

    protected $fillable = [
        'owner_id', 'name', 'slug', 'logo_url', 'primary_color', 'secondary_color',
        'signature_url', 'verify_domain', 'plan_id', 'settings',
    ];

    protected $casts = [
        'settings' => 'array',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'organization_members')
            ->withPivot('role', 'joined_at')
            ->withTimestamps();
    }

    public function templates(): HasMany
    {
        return $this->hasMany(Template::class);
    }

    public function certificates(): HasMany
    {
        return $this->hasMany(Certificate::class);
    }

    public function batches(): HasMany
    {
        return $this->hasMany(Batch::class);
    }

    public function subscription(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    /**
     * Number of certificates issued in the given month (YYYY-MM).
     */
    public function usageForMonth(string $month): int
    {
        return (int) optional(
            $this->hasMany(CertificateUsage::class)->where('month', $month)->first()
        )->certificates_issued;
    }
}
