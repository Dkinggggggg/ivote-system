<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'category_id' => [
                'nullable',
                'integer',
                Rule::exists('position_categories', 'id')
                    ->where('election_id', $this->route('election')),
            ],
        ];
    }
}
