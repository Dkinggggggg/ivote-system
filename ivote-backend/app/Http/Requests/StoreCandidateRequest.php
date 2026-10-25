<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCandidateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'party' => ['nullable', 'string', 'max:100'],
            'photo_url' => ['nullable', 'image', 'mimes:jpg,jpeg,png', 'max:2048'],
            'display_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }
}
