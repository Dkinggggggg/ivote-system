<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Simple key-value store for system-wide configuration
 * (e.g. organization name shown on printed ballots).
 */
class Setting extends Model
{
    public $timestamps = false;

    protected $fillable = ['setting_key', 'setting_value'];

    public static function get(string $key, mixed $default = null): mixed
    {
        return static::where('setting_key', $key)->value('setting_value') ?? $default;
    }

    public static function set(string $key, mixed $value): void
    {
        static::updateOrCreate(['setting_key' => $key], ['setting_value' => $value]);
    }
}
