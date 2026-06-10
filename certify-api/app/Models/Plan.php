<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    protected $fillable = [
        'name', 'slug', 'price_monthly', 'price_yearly', 'certificates_per_month',
        'templates_limit', 'team_members_limit', 'features', 'has_api',
        'has_white_label', 'is_active',
    ];

    protected $casts = [
        'features' => 'array',
        'has_api' => 'boolean',
        'has_white_label' => 'boolean',
        'is_active' => 'boolean',
        'price_monthly' => 'decimal:2',
        'price_yearly' => 'decimal:2',
    ];

    public function organizations(): HasMany
    {
        return $this->hasMany(Organization::class);
    }
}
