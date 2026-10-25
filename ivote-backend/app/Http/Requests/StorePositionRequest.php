<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePositionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'vote_for_count' => ['required', 'integer', 'min:1', 'max:20'],
            'display_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }
}
