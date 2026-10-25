<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (! $this->filled('username') && $this->filled('email')) {
            $this->merge(['username' => $this->input('email')]);
        }
    }

    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        $userId = $this->route('user');

        return [
            'name' => ['required', 'string', 'max:100'],
            'username' => ['required', 'string', 'max:150', Rule::unique('users', 'email')->ignore($userId)],
            'password' => [$userId ? 'sometimes' : 'required', 'string', 'min:8'],
            'role' => ['required', Rule::in(['admin', 'committee_officer'])],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
