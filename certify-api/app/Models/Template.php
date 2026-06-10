<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Template extends Model
{
    use HasUuids;

    protected $fillable = [
        'organization_id', 'name', 'description', 'category', 'design_data',
        'orientation', 'dimensions', 'language', 'is_public', 'thumbnail_url', 'created_by',
    ];

    protected $casts = [
        'design_data' => 'array',
        'dimensions' => 'array',
        'is_public' => 'boolean',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function certificates(): HasMany
    {
        return $this->hasMany(Certificate::class);
    }
}
